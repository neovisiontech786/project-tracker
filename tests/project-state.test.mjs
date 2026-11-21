import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedProjectProgress} from '../src/lib/project-state.ts';
test('completed status always has 100 percent',()=>{
 assert.equal(normalizedProjectProgress('completed',35),100);
 assert.equal(normalizedProjectProgress('completed',0,15),100);
});
test('not started always has zero percent',()=>{
 assert.equal(normalizedProjectProgress('not_started',100),0);
 assert.equal(normalizedProjectProgress('not_started',70,25),0);
});
test('reopened completed projects lose 100 percent',()=>{
 assert.equal(normalizedProjectProgress('in_progress',100),99);
 assert.equal(normalizedProjectProgress('on_hold',100),99);
});
test('explicit 100 percent is invalid outside completed',()=>{
 assert.throws(()=>normalizedProjectProgress('in_progress',30,100));
 assert.throws(()=>normalizedProjectProgress('cancelled',30,100));
});
test('reject noninteger, negative and out of range progress',()=>{
 for(const value of [-1,101,2.5,NaN,Infinity])assert.throws(()=>normalizedProjectProgress('in_progress',0,value));
});
