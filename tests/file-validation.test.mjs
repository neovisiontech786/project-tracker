import test from 'node:test';
import assert from 'node:assert/strict';
import {hasExpectedFileSignature} from '../src/lib/file-validation.ts';

const bytes=(...v)=>new Uint8Array(v);

test('rejects arbitrary contents disguised as supported files',()=>{
  for(const ext of ['pdf','jpg','png','doc','docx','xls','xlsx','zip']){
    assert.equal(hasExpectedFileSignature('document.'+ext,bytes(0x41,0x42,0x43)),false);
  }
});
test('recognizes expected container signatures',()=>{
  assert.equal(hasExpectedFileSignature('report.pdf',bytes(0x25,0x50,0x44,0x46,0x2d)),true);
  assert.equal(hasExpectedFileSignature('photo.jpg',bytes(0xff,0xd8,0xff)),true);
  assert.equal(hasExpectedFileSignature('photo.png',bytes(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)),true);
  assert.equal(hasExpectedFileSignature('report.docx',bytes(0x50,0x4b,0x03,0x04)),true);
  assert.equal(hasExpectedFileSignature('sheet.xlsx',bytes(0x50,0x4b,0x03,0x04)),true);
  assert.equal(hasExpectedFileSignature('archive.zip',bytes(0x50,0x4b,0x03,0x04)),true);
  assert.equal(hasExpectedFileSignature('old.xls',bytes(0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1)),true);
});
test('rejects mismatched, truncated and unsupported signatures',()=>{
  assert.equal(hasExpectedFileSignature('data.pdf',bytes(0x50,0x4b,0x03,0x04)),false);
  assert.equal(hasExpectedFileSignature('data.pdf',bytes(0x25,0x50)),false);
  assert.equal(hasExpectedFileSignature('data.exe',bytes(0x4d,0x5a)),false);
});
