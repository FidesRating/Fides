import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { afterEach, test } from 'node:test';
import { HttpXOAuth, makePkce } from '../src/claims/x-oauth';

const saved = { id: process.env.X_CLIENT_ID, uri: process.env.X_REDIRECT_URI };
afterEach(() => {
  process.env.X_CLIENT_ID = saved.id;
  process.env.X_REDIRECT_URI = saved.uri;
});

test('x oauth: PKCE challenge is the S256 hash of the verifier', () => {
  const { verifier, challenge } = makePkce();
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
  assert.notEqual(makePkce().verifier, verifier);
});

test('x oauth: the claim flow fails closed without credentials', () => {
  delete process.env.X_CLIENT_ID;
  delete process.env.X_REDIRECT_URI;
  assert.throws(() => new HttpXOAuth().authorizeUrl('s', 'c'), /not open yet/);
});

test('x oauth: authorize URL carries state, S256 challenge and minimal scopes', () => {
  process.env.X_CLIENT_ID = 'client-123';
  process.env.X_REDIRECT_URI = 'https://example.test/claim';
  const url = new URL(new HttpXOAuth().authorizeUrl('state-1', 'chal-1'));
  assert.equal(url.searchParams.get('state'), 'state-1');
  assert.equal(url.searchParams.get('code_challenge'), 'chal-1');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('scope'), 'users.read tweet.read');
});
