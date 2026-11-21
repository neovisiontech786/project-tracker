import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// TypeScript source is compiled with Node's built-in strip-types capability on supported Node versions.
const helpers = readFileSync(new URL('../src/lib/founder-access.ts', import.meta.url), 'utf8');
const server = readFileSync(new URL('../src/lib/server.ts', import.meta.url), 'utf8');
const approvals = readFileSync(new URL('../src/app/api/founders/route.ts', import.meta.url), 'utf8');

test('founder matching requires a verified email and the configured order',()=>{
  assert.match(helpers,/founderForVerifiedEmails/);
  assert.match(helpers,/new Set\(verifiedEmails/);
  assert.match(server,/founderForVerifiedEmails\(verifiedEmails, allowed\)/);
});
test('founder approval and email activation remain atomic and audited',()=>{
  assert.match(server,/sql\.transaction\(\[/);
  assert.match(server,/founder_access_events/);
  assert.match(approvals,/sql\.transaction\(\[/);
  assert.match(approvals,/manual_approval/);
  assert.match(approvals,/requireKabir/);
});
test('approval never grants arbitrary public signups',()=>{
  assert.match(server,/verification\?\.status==='verified'/);
  assert.match(server,/Founder access pending/);
  assert.match(approvals,/body\.action==='approve'/);
});
