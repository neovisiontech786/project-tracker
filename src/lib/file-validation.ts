// Minimal defense-in-depth file signature validation.
// This checks container signatures, not malware content or Office document structure.
export function hasExpectedFileSignature(name: string, bytes: Uint8Array): boolean {
  const ext=name.split('.').pop()?.toLowerCase();
  const starts=(sig: number[])=>sig.every((v,i)=>bytes[i]===v);
  if(ext==='pdf') return starts([0x25,0x50,0x44,0x46,0x2d]);
  if(ext==='jpg'||ext==='jpeg') return starts([0xff,0xd8,0xff]);
  if(ext==='png') return starts([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if(ext==='doc'||ext==='xls') return starts([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]);
  if(ext==='docx'||ext==='xlsx'||ext==='zip') return starts([0x50,0x4b,0x03,0x04]);
  return false;
}
