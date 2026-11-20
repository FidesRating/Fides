import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Wallet } from 'ethers';
import {
  isValidLoginAddress, isValidSolanaAddress, normalizeLoginAddress, verifyWalletSignature, walletKind,
} from '../src/common/wallet-signature';

const MESSAGE = 'Sign in to FIDES\nNonce: abc';

function solanaWallet() {
  const kp = nacl.sign.keyPair();
  const address = bs58.encode(kp.publicKey);
  const sign = (msg: string) => nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey);
  return { address, sign };
}

test('login address: accepts EVM and Solana, rejects anything else', () => {
  const sol = solanaWallet().address;
  assert.equal(isValidLoginAddress('0x1111111111111111111111111111111111111111'), true);
  assert.equal(isValidLoginAddress(sol), true);
  assert.equal(isValidLoginAddress('not-a-wallet'), false);
  assert.equal(isValidLoginAddress('0x1234'), false);
  // Valid base58 characters but not a 32-byte key.
  assert.equal(isValidSolanaAddress('1'.repeat(20)), false);
  assert.equal(isValidSolanaAddress(''), false);
});

test('login address: EVM is lowercased, Solana keeps its case', () => {
  const sol = solanaWallet().address;
  assert.equal(normalizeLoginAddress(' 0xABCDEFabcdef0123456789ABCDEFabcdef012345 '), '0xabcdefabcdef0123456789abcdefabcdef012345');
  assert.equal(normalizeLoginAddress(` ${sol} `), sol);
  assert.equal(walletKind(sol), 'solana');
});

test('Solana signature: valid base58 and hex signatures pass', () => {
  const w = solanaWallet();
  const sig = w.sign(MESSAGE);
  assert.doesNotThrow(() => verifyWalletSignature(w.address, MESSAGE, bs58.encode(sig)));
  assert.doesNotThrow(() => verifyWalletSignature(w.address, MESSAGE, Buffer.from(sig).toString('hex')));
});

test('Solana signature: a different message, a different wallet or garbage fails', () => {
  const a = solanaWallet();
  const b = solanaWallet();
  const sig = bs58.encode(a.sign(MESSAGE));
  assert.throws(() => verifyWalletSignature(a.address, `${MESSAGE} changed`, sig), /verification failed/);
  assert.throws(() => verifyWalletSignature(b.address, MESSAGE, sig), /verification failed/);
  assert.throws(() => verifyWalletSignature(a.address, MESSAGE, 'not a signature'), /verification failed/);
});

test('EVM signature still verifies and a wrong signer fails', async () => {
  const w = Wallet.createRandom();
  const other = Wallet.createRandom();
  const sig = await w.signMessage(MESSAGE);
  assert.doesNotThrow(() => verifyWalletSignature(w.address, MESSAGE, sig));
  assert.throws(() => verifyWalletSignature(other.address, MESSAGE, sig), /verification failed/);
});
