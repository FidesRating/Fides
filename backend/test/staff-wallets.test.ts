import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStaffWallets } from '../src/common/staff-wallets';

const A = '11111111111111111111111111111112';
const B = '22222222222222222222222222222223';

test('staff wallets: unset or empty means no staff (fail closed)', () => {
  assert.equal(parseStaffWallets(undefined).size, 0);
  assert.equal(parseStaffWallets('  ').size, 0);
});

test('staff wallets: parses address and role pairs', () => {
  const m = parseStaffWallets(` ${A}:analyst , ${B}:committee `);
  assert.equal(m.get(A), 'analyst');
  assert.equal(m.get(B), 'committee');
});

test('staff wallets: rejects a bad role, a bad address, and a duplicate', () => {
  assert.throws(() => parseStaffWallets(`${A}:owner`), /invalid role/);
  assert.throws(() => parseStaffWallets(`${A}`), /invalid role/);
  assert.throws(() => parseStaffWallets('not-a-wallet:analyst'), /invalid wallet address/);
  assert.throws(() => parseStaffWallets(`${A}:analyst,${A}:admin`), /twice/);
});
