import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { cleanUserFiles } from '../_shared/cleanup.js';
Deno.serve(async request=>{
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(request.method!=='POST'||!secret||request.headers.get('Authorization')!==`Bearer ${secret}`)return new Response('Forbidden',{status:403});
  const admin=createClient(Deno.env.get('SUPABASE_URL'),secret,{auth:{persistSession:false,autoRefreshToken:false}});
  return Response.json(await cleanUserFiles(admin));
});
