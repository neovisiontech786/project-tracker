import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const details = readFileSync(new URL('../src/app/projects/[id]/page.tsx', import.meta.url),'utf8');
const form = readFileSync(new URL('../src/components/project-finances.tsx', import.meta.url),'utf8');

test('escaped JSX newline is not rendered between Payments and Activity tabs',()=>{
  assert.ok(details.includes('viewerName={viewerName}/>'), 'Payments tab must render');
  assert.doesNotMatch(details, /\/\>}\\n\s+\{tab===\"activity\"/, 'Do not render literal escaped newline');
});

test('payment action controls open visible modal dialogs rather than below-fold forms',()=>{
  assert.ok(form.includes('openForm("receipt")'));
  assert.ok(form.includes('openForm("transfer")'));
  assert.ok(form.includes('<Modal open={!!form}'), 'Receipt and transfer form must be in a modal');
  assert.ok(form.includes('payment-quote-modal'), 'Quotation form must be in a modal');
  assert.ok(form.includes('payment-feedback error'), 'Validation errors must display in forms');
});