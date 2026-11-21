import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFounderEmails, founderForVerifiedEmails } from '../src/lib/founder-access.ts';

const server = readFileSync(new URL('../src/lib/server.ts', import.meta.url), 'utf8');
const approvals = readFileSync(new URL('../src/app/api/founders/route.ts', import.meta.url), 'utf8');

test('founder allowlist requires exactly two unique valid emails',()=>{
  assert.equal(parseFounderEmails(undefined), null);
  assert.equal(parseFounderEmails('a@x.com'), null);
  assert.equal(parseFounderEmails('a@x.com,a@x.com'), null);
  assert.equal(parseFounderEmails('broken,a@x.com'), null);
  assert.deepEqual(parseFounderEmails(' A@X.com , B@X.com '), ['a@x.com','b@x.com']);
});
test('only verified-email inputs can identify the correct founder',()=>{
  const allowlist=parseFounderEmails('mdkabir3350@gmail.com,naushadmohd74@gmail.com');
  assert.ok(allowlist);
  assert.equal(founderForVerifiedEmails([],allowlist),null);
  assert.equal(founderForVerifiedEmails(['naushadmohd470@gmail.com'],allowlist),null);
  assert.equal(founderForVerifiedEmails(['NAUSHADMOHD74@gmail.com'],allowlist),'Naushad');
  assert.equal(founderForVerifiedEmails(['mdkabir3350@gmail.com'],allowlist),'Kabir');
});
test('founder approval and email activation remain atomic and audited',()=>{
  assert.match(server,/sql\.transaction\(\[/);
  assert.match(server,/founder_access_events/);
  assert.match(approvals,/sql\.transaction\(\[/);
  assert.match(approvals,/manual_approval/);
});
test('approval requires a Kabir session and onboarding requires verified email',()=>{
  assert.match(server,/verification\?\.status==='verified'/);
  assert.match(approvals,/await requireKabir\(\)/);
  assert.match(server,/Founder access pending/);
});
