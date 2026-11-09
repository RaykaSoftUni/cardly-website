// Shared by the trusted uploader and browser validation; no user-supplied dimensions are trusted.
export const inputLimit = 2 * 1024 * 1024;
export const pixelLimit = 16000000;
export const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
export function imageHeader(bytes, mime) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  let width, height;
  if (mime === 'image/png' && bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b) && ascii(12,16)==='IHDR') {
    width=view.getUint32(16); height=view.getUint32(20);
  } else if (mime === 'image/jpeg' && bytes[0]===255 && bytes[1]===216) {
    let offset=2;
    while(offset+4<bytes.length) {
      if(bytes[offset++]!==255) break;
      while(bytes[offset]===255) offset++;
      const marker=bytes[offset++];
      if(marker===0xd9||marker===0xda) break;
      const length=view.getUint16(offset);
      if(length<2||offset+length>bytes.length) break;
      if([0xc0,0xc1,0xc2].includes(marker)&&length>=7) {height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}
      offset+=length;
    }
  } else if(mime==='image/webp'&&bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP') {
    const kind=ascii(12,16);
    if(kind==='VP8X') {width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
    else if(kind==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a) {width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
    else if(kind==='VP8L'&&bytes[20]===0x2f) {const bits=view.getUint32(21,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
  }
  if(!width||!height) throw new Error('The image contents do not match a supported JPEG, PNG or WebP format.');
  if(width>8000||height>8000||width*height>pixelLimit) throw new Error('Choose an image with at most 16 million pixels and sides no larger than 8000 px.');
  return {width,height};
}
