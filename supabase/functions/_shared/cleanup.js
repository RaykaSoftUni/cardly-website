export async function cleanUserFiles(admin, userId = null) {
  const { data, error } = await admin.rpc('pending_user_file_cleanup', { p_user_id:userId });
  if (error) return { failed:true, removed:0 };
  let failed=false, removed=0;
  for (const job of data) {
    const result=await admin.storage.from(job.bucket_id).remove([job.storage_path]);
    if(result.error) { failed=true; continue; }
    const confirmed=await admin.rpc('confirm_user_file_cleanup',{p_path:job.storage_path,p_bucket:job.bucket_id});
    if(confirmed.error) failed=true; else removed++;
  }
  return {failed,removed};
}
