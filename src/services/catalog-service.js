import { supabaseClient } from './supabase-client.js';
export async function rpc(name, params = {}) {
 const {data,error}=await supabaseClient.rpc(name,params);
 if(error) throw new Error(error.message);
 return data;
}
export async function catalog(params={}) {
 const rows=[];
 for(let offset=0;;offset+=100){
  const page=await rpc('get_card_catalogue',{...params,p_limit:100,p_offset:offset});
  rows.push(...page);
  if(page.length<100)return rows;
 }
}
export const cardDetail=(id)=>rpc('get_card_detail',{p_card_id:id});
