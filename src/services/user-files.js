import { supabaseClient as client } from './supabase-client.js';
import { imageHeader, inputLimit, allowedTypes } from '../../supabase/functions/_shared/image-validation.js';

export const userImageLimit = inputLimit;
const invalid = message => Object.assign(new Error(message), { code:'validation' });
export async function validateUserImage(file) {
  if(!file||!allowedTypes.includes(file.type))throw invalid('Choose a JPEG, PNG or WebP image.');
  if(!file.size||file.size>inputLimit)throw invalid('Choose an image no larger than 2 MiB.');
  try{imageHeader(new Uint8Array(await file.arrayBuffer()),file.type);}catch(error){throw invalid(error.message);}
  let bitmap;
  try{bitmap=await createImageBitmap(file);}catch{throw invalid('Choose a valid, decodable image.');}
  finally{bitmap?.close();}
}
async function requireUser() {
  const {data,error}=await client.auth.getUser();
  if(error||!data.user)throw invalid('Your session has expired. Please sign in again.');
  return data.user;
}
export async function privateImageBlob(path) {
  const user=await requireUser();
  if(typeof path!=='string'||!path.startsWith(`${user.id}/`)||path.includes('..')||!/^[-a-f0-9]+\/(avatars|drafts)\//.test(path))throw invalid('This image does not belong to your account.');
  const {data,error}=await client.storage.from('user-uploads').download(path);
  if(error)throw invalid('Your private image could not be loaded. Please sign in and try again.');
  return data;
}
export async function privateImageData(path) {
  const blob=await privateImageBlob(path);
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(invalid('The private image could not be decoded.'));reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob([blob],{type:'image/png'}));
  });
}
export async function userFilesAvailable() {
  try{const {data,error}=await client.rpc('user_file_storage_available');return !error&&data===true;}catch{return false;}
}
export async function cardPhotoAvailable(cardId) {
  try{const {data,error}=await client.rpc('card_photo_available',{p_card_id:cardId});return !error&&data===true;}catch{return false;}
}
async function fileAction(purpose,draftId,file) {
  await requireUser();
  const form=new FormData();form.set('purpose',purpose);if(draftId)form.set('draft_id',draftId);
  if(file)form.set('file',file);else form.set('action','remove');
  const {data,error}=await client.functions.invoke('user-file-upload',{body:form});
  if(error){
    let message='The image could not be saved. Your other personalization has been kept.';
    try{message=(await error.context.json()).error||message;}catch{}
    throw invalid(message);
  }
  return data;
}
export async function uploadUserImage(file,{purpose,draftId=null}) {
  await validateUserImage(file);return fileAction(purpose,draftId,file);
}
export const removeUserImage=({purpose,draftId=null})=>fileAction(purpose,draftId,null);

export async function flushUserFileCleanup() {
  await requireUser();const body=new FormData();body.set('purpose','avatar');body.set('action','cleanup');
  const {data,error}=await client.functions.invoke('user-file-upload',{body});
  return !error&&!data?.cleanupFailed;
}
