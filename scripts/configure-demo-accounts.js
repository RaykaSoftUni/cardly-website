// Trusted local operator only. Never import this file from browser code.
import { createClient } from '@supabase/supabase-js';
const url=process.env.VITE_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const entries=[['alex.demo@example.test','CARDLY_DEMO_ALEX_PASSWORD'],['sam.demo@example.test','CARDLY_DEMO_SAM_PASSWORD'],['admin.demo@example.test','CARDLY_DEMO_ADMIN_PASSWORD']];
if(!url||!key||entries.some(([,name])=>(process.env[name]?.length??0)<16))throw new Error('Set the project URL, server-only service key and all three demo passwords (at least 16 characters) in the operator environment.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
for(let page=1;;page++){
 const {data,error}=await client.auth.admin.listUsers({page,perPage:100});
 if(error)throw new Error('Unable to inspect demo accounts. Check trusted operator configuration.');
 users.push(...data.users);if(data.users.length<100)break;
}
for(const[email,name]of entries){
 const user=users.find(u=>u.email===email&&u.user_metadata.demo_seed==='cardly-v1');
 if(!user)throw new Error(`Seeded account missing: ${email}. Apply demo-accounts.sql first.`);
 const {error}=await client.auth.admin.updateUserById(user.id,{password:process.env[name],email_confirm:true});
 if(error)throw new Error(`Could not configure ${email}; no credential values were logged.`);
 console.log(`Configured demo password for ${email}.`);
}
