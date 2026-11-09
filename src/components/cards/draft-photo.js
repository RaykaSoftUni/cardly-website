import { el } from '../../utils/dom.js';
import { createForm } from '../forms/fields.js';
import { button } from '../ui.js';
import { uploadUserImage, removeUserImage, validateUserImage, userImageHint } from '../../services/user-files.js';

export function createDraftPhoto({ getDraftId, maxBytes, hasPhoto=false, onSaved, onRemoved }) {
  let selectedURL=null;
  let selection=0;
  const image=el('img',{className:'draft-photo-selection',alt:'Selected photo preview',hidden:true});
  const feedback=el('p',{role:'status','aria-live':'polite',className:'field-hint'});
  const clear=()=>{selection++;if(selectedURL)URL.revokeObjectURL(selectedURL);selectedURL=null;image.hidden=true;image.removeAttribute('src');};
  window.addEventListener('pagehide',clear,{once:true});
  const remove=button({label:'Remove card photo',variant:'quiet',disabled:!hasPhoto,onClick:async()=>{
    remove.disabled=true;
    try{const draftId=await getDraftId(true);if(!draftId)return;const result=await removeUserImage({purpose:'draft',draftId});await onRemoved();hasPhoto=false;clear();form.reset();feedback.textContent=result.cleanupFailed?'Photo removed. File cleanup is queued for retry.':'Photo removed.';}
    catch(error){feedback.textContent=error.message;}finally{remove.disabled=!hasPhoto;}
  }});
  const form=createForm({fields:[{name:'photo',label:'Recipient photo',type:'file',required:true,accept:'image/jpeg,image/png,image/webp',hint:userImageHint(maxBytes)+' Uploading saves an owned draft first.'}],submitLabel:'Upload card photo',onChange:async({photo})=>{
    clear();const attempt=selection;
    if(!photo)return;
    try{await validateUserImage(photo);if(attempt!==selection)return;selectedURL=URL.createObjectURL(photo);image.src=selectedURL;image.hidden=false;form.setError('');}
    catch(error){if(attempt===selection)form.setError(error.message);}
  },onSubmit:async({photo})=>{
    feedback.textContent='Uploading and validating your private photo…';
    const input=form.element.querySelector('input');input.disabled=true;remove.disabled=true;
    try{
      const draftId=await getDraftId();if(!draftId){feedback.textContent='Complete the required personalization before uploading.';return;}
      const result=await uploadUserImage(photo,{purpose:'draft',draftId});
      hasPhoto=true;remove.disabled=false;form.reset();clear();
      try{await onSaved(result.path);}catch{feedback.textContent='Photo saved, but its preview could not be loaded. Please retry the preview before downloading.';return;}
      feedback.textContent=result.cleanupFailed?'Photo saved. Previous-file cleanup is queued for retry.':'Private photo saved to your draft.';
    }catch(error){form.setError(error.message);feedback.textContent='Upload failed. Your other personalization is unchanged.';remove.disabled=!hasPhoto;}
    finally{input.disabled=false;remove.disabled=!hasPhoto;}
  }});
  return el('section',{className:'draft-photo surface-panel mt-3'},[el('h2',{},'Make it picture personal'),form.element,image,remove,feedback]);
}
