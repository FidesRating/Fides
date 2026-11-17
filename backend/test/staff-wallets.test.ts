import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStaffWallets } from '../src/common/staff-wallets';

const A = '0x1111111111111111111111111111111111111111';
const B = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01';

test('staff wallets: unset or empty means no staff (fail closed)', () => {
  assert.equal(parseStaffWallets(undefined).size, 0);
  assert.equal(parseStaffWallets('  ').size, 0);
});

test('staff wallets: parses address and role pairs and matches addresses in lowercase', () => {
  const m = parseStaffWallets(` ${A}:analyst , ${B}:committee `);
  assert.equal(m.get(A), 'analyst');
  assert.equal(m.get(B.toLowerCase()), 'committee');
  assert.equal(m.get(B), undefined, 'keys are stored lowercase');
});

test('staff wallets: rejects a bad role, a bad address, a Solana address and a duplicate', () => {
  assert.throws(() => parseStaffWallets(`${A}:owner`), /invalid role/);
  assert.throws(() => parseStaffWallets(`${A}`), /invalid role/);
  assert.throws(() => parseStaffWallets('not-a-wallet:analyst'), /invalid wallet address/);
  assert.throws(() => parseStaffWallets('11111111111111111111111111111112:analyst'), /invalid wallet address/);
  assert.throws(() => parseStaffWallets(`${A}:analyst,${A.toUpperCase().replace('0X', '0x')}:admin`), /twice/);
});
