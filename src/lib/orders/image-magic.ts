/** PNG (89 50 4E 47 0D 0A 1A 0A) or JPEG (FF D8 FF) magic bytes: what a proof preview may hold (R4-11). */
export function isPngOrJpeg(b: Uint8Array): boolean {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return true;
  return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}
