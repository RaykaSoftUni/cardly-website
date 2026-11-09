import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { Image } from 'jsr:@matmen/imagescript@3.13.1';
import { allowedTypes, imageHeader, inputLimit } from '../_shared/image-validation.js';
import { cleanUserFiles } from '../_shared/cleanup.js';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request=>{
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return response({error:'Use POST.'},405);
  const authorization=request.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return response({error:'Sign in before uploading.'},401);
  const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_ANON_KEY'), secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const auth={persistSession:false,autoRefreshToken:false};
  const caller=createClient(url,key,{auth,global:{headers:{Authorization:authorization}}});
  const {data:{user},error:authError}=await caller.auth.getUser();
  if(authError||!user)return response({error:'Your session has expired. Please sign in again.'},401);
  const admin=createClient(url,secret,{auth});
  let reservation=null;
  try {
    if(Number(request.headers.get('content-length')||0)>inputLimit+65536)throw new Error('Choose an image no larger than 2 MiB.');
    const reader=request.body?.getReader(); if(!reader)throw new Error('Select an image.');
    const chunks=[];let length=0;
    for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>inputLimit+65536){await reader.cancel();throw new Error('Choose an image no larger than 2 MiB.');}chunks.push(value);}
    const body=new Uint8Array(length);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.length;}
    const form=await new Response(body,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
    const purpose=form.get('purpose'), draftId=form.get('draft_id')||null, file=form.get('file');
    if(!['avatar','draft'].includes(purpose))throw new Error('Invalid upload purpose.');
    if(form.get('action')==='cleanup'){
      const cleanup=await cleanUserFiles(admin,user.id);return response({cleanupFailed:cleanup.failed});
    }
    if(form.get('action')==='remove'){
      const removed=await caller.rpc('remove_user_file',{p_purpose:purpose,p_draft_id:draftId});
      if(removed.error)throw new Error('This image could not be removed from your account or draft.');
      const cleanup=await cleanUserFiles(admin,user.id);
      return response({path:null,cleanupFailed:cleanup.failed});
    }
    if(!(file instanceof File)||!allowedTypes.includes(file.type)||!file.size||file.size>inputLimit)throw new Error('Choose a JPEG, PNG or WebP image no larger than 2 MiB.');
    // All record ownership and template checks derive identity from the verified caller JWT.
    const prepared=await caller.rpc('prepare_user_upload',{p_purpose:purpose,p_draft_id:draftId});
    if(prepared.error)throw new Error('This upload is not permitted for your account or draft.');
    reservation=prepared.data;
    if(reservation.user_id!==user.id)throw new Error('Upload authorization failed.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const dimensions=imageHeader(bytes,file.type);
    let decoded;
    try{decoded=await Image.decode(bytes);}catch{throw new Error('The selected image could not be decoded.');}
    if(!((decoded.width===dimensions.width&&decoded.height===dimensions.height)||(decoded.width===dimensions.height&&decoded.height===dimensions.width)))throw new Error('Image dimensions could not be verified.');
    // Canonical PNG strips source metadata and rejects unsupported/undecodable content.
    const png=await decoded.encode();
    if(png.byteLength>10485760)throw new Error('The decoded image is too large. Choose a smaller image.');
    const uploaded=await admin.storage.from('user-uploads').upload(reservation.storage_path,png,{contentType:'image/png',upsert:false,cacheControl:'0'});
    if(uploaded.error)throw new Error('The image could not be uploaded. Please try again.');
    const finished=await admin.rpc('finish_user_upload',{p_id:reservation.id,p_bytes:png.byteLength,p_width:decoded.width,p_height:decoded.height});
    if(finished.error)throw new Error('The image could not be attached. Your previous image has been kept.');
    reservation=null;
    const cleanup=await cleanUserFiles(admin,user.id);
    return response({path:finished.data.storage_path,cleanupFailed:cleanup.failed});
  }catch(error){
    if(reservation){await admin.rpc('abort_user_upload',{p_id:reservation.id});await cleanUserFiles(admin,user.id);}
    return response({error:error.message||'Upload failed. Please try again.'},400);
  }
});
