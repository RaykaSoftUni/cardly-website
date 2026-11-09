import { Image } from 'jsr:@matmen/imagescript@3.13.1';
import { imageHeader } from '../_shared/image-validation.js';
const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4U7HgPwAHHAL0OMCbtQAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
const check=(value,label)=>{if(!value)throw new Error(label);};
const rejects=async(action,label)=>{let failed=false;try{await action();}catch{failed=true;}check(failed,label);};
Deno.test('trusted decoder verifies bytes and canonical PNG output',async()=>{
 const header=imageHeader(png,'image/png');check(header.width===1&&header.height===1,'fixture dimensions');
 const image=await Image.decode(png);check(image.width===1&&image.height===1,'decoded dimensions');
 const canonical=await image.encode();const output=imageHeader(canonical,'image/png');
 check(output.width===1&&output.height===1,'canonical PNG dimensions');await Image.decode(canonical);
});
Deno.test('mismatched, truncated and oversized images fail validation',async()=>{
 await rejects(()=>imageHeader(png,'image/jpeg'),'MIME mismatch must fail');
 await rejects(()=>imageHeader(new Uint8Array([1,2,3]),'image/png'),'truncated header must fail');
 const oversized=png.slice();new DataView(oversized.buffer).setUint32(16,8001);
 await rejects(()=>imageHeader(oversized,'image/png'),'oversized dimensions must fail');
 await rejects(()=>Image.decode(png.slice(0,24)),'truncated image must fail decoding');
});
