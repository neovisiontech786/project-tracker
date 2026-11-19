import test from 'node:test';
import assert from 'node:assert/strict';
import {
  money, moneyInput, duePaise, heldBy, activeReceipts, activeTransfers,
  sumPaise, transactionDate, PAYMENT_METHODS
} from '../src/lib/finance.ts';

const receipt = (amountPaise, receivedBy, voidedAt = null) => ({amountPaise,receivedBy,voidedAt});
const transfer = (amountPaise, fromFounder, toFounder, voidedAt = null) => ({amountPaise,fromFounder,toFounder,voidedAt});

test('INR amounts preserve two decimal places and Indian grouping', () => {
  assert.equal(money(12345678), '₹1,23,456.78');
  assert.equal(moneyInput(5005), '50.05');
  assert.equal(moneyInput(null), '');
});

test('outstanding dues and overpayments are bounded to zero', () => {
  assert.equal(duePaise(10000000, 2500000), 7500000);
  assert.equal(duePaise(10000000, 10000000), 0);
  assert.equal(duePaise(10000000, 12500000), 0);
  assert.equal(duePaise(null, 12500000), 0);
});

test('client payments affect company income, founder transfers only redistribute holdings', () => {
  const receipts = [receipt(500000,'Kabir'),receipt(300000,'Naushad')];
  const transfers = [transfer(100000,'Kabir','Naushad')];
  assert.equal(sumPaise(activeReceipts(receipts)), 800000);
  assert.deepEqual(heldBy('Kabir',receipts,transfers), {clients:500000,incoming:0,outgoing:100000,balance:400000});
  assert.deepEqual(heldBy('Naushad',receipts,transfers), {clients:300000,incoming:100000,outgoing:0,balance:400000});
  assert.equal(heldBy('Kabir',receipts,transfers).balance + heldBy('Naushad',receipts,transfers).balance, 800000);
});

test('bidirectional transfers conserve total received income', () => {
  const receipts=[receipt(1000000,'Kabir')];
  const transfers=[transfer(200000,'Kabir','Naushad'),transfer(50000,'Naushad','Kabir')];
  assert.equal(heldBy('Kabir',receipts,transfers).balance,850000);
  assert.equal(heldBy('Naushad',receipts,transfers).balance,150000);
});

test('voided receipts and transfers do not affect balances but remain visible in history', () => {
  const receipts = [receipt(500000,'Kabir'),receipt(1000000,'Naushad','2026-11-19T10:00:00.000Z')];
  const transfers = [transfer(200000,'Kabir','Naushad'),transfer(100000,'Kabir','Naushad','2026-11-19T10:00:00.000Z')];
  assert.equal(activeReceipts(receipts).length,1);
  assert.equal(activeTransfers(transfers).length,1);
  assert.equal(heldBy('Kabir',receipts,transfers).balance,300000);
  assert.equal(heldBy('Naushad',receipts,transfers).balance,200000);
});

test('transaction dates are displayed in India timezone',()=>{
  assert.match(transactionDate('2026-11-19T00:00:00.000Z'),/5:30\s*am/i);
});

test('payment sources include wallet, bank, card and cash',()=>{
  for(const value of ['Google Pay','PhonePe','UPI','Bank Transfer','Cash','Card']){
    assert.ok(PAYMENT_METHODS.includes(value));
  }
});