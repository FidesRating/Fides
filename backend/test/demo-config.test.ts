import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertDemoConfig, isLocalUrl } from '../src/common/demo-config';
import { assertProductionConfig } from '../src/common/production-config';
import { MOCK_X_PROFILES, MockXOAuth, isXMockEnabled, xOAuthFactory, HttpXOAuth } from '../src/claims/x-oauth';

const local = {
  X_OAUTH_MOCK: 'true', NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://fides:fides@localhost:5432/fides', DIRECT_URL: 'postgresql://fides:fides@127.0.0.1:5432/fides', REDIS_URL: 'redis://localhost:6379',
};

test('demo config: only local database and queue hosts are accepted', () => {
  assert.equal(isLocalUrl('postgresql://u:p@localhost:5432/db'), true);
  assert.equal(isLocalUrl('redis://127.0.0.1:6379'), true);
  assert.equal(isLocalUrl('postgresql://u:p@aws-1-us-west-1.pooler.supabase.com:5432/postgres'), false);
  assert.equal(isLocalUrl('not a url'), false);
  assert.equal(isLocalUrl(undefined), false);
});

test('demo config: the mock login boots with a local setup and is skipped when it is off', () => {
  assert.doesNotThrow(() => assertDemoConfig(local));
  assert.doesNotThrow(() => assertDemoConfig({ ...local, DIRECT_URL: undefined }));
  assert.doesNotThrow(() => assertDemoConfig({ DATABASE_URL: 'postgresql://u:p@db.example.com/x' }));
});

test('demo config: refuses a remote database, a remote queue or a missing URL', () => {
  assert.throws(() => assertDemoConfig({ ...local, DATABASE_URL: 'postgresql://u:p@db.example.com:5432/x' }), /DATABASE_URL/);
  assert.throws(() => assertDemoConfig({ ...local, DIRECT_URL: 'postgresql://u:p@db.example.com:5432/x' }), /DIRECT_URL/);
  assert.throws(() => assertDemoConfig({ ...local, REDIS_URL: 'redis://cache.example.com:6379' }), /REDIS_URL/);
  assert.throws(() => assertDemoConfig({ ...local, REDIS_URL: undefined }), /REDIS_URL/);
});

test('mock login can never be on in production', () => {
  const safe = { NODE_ENV: 'production', CORS_ORIGINS: 'https://example.com', STAFF_WALLETS: '' };
  assert.throws(() => assertProductionConfig({ ...safe, X_OAUTH_MOCK: 'true' }), /X_OAUTH_MOCK/);
  assert.throws(() => assertDemoConfig({ ...local, NODE_ENV: 'production' }), /production/);
  assert.equal(isXMockEnabled({ X_OAUTH_MOCK: 'true', NODE_ENV: 'production' }), false);
  assert.equal(isXMockEnabled({ X_OAUTH_MOCK: 'true', NODE_ENV: 'development' }), true);
  assert.equal(isXMockEnabled({ NODE_ENV: 'development' }), false);
});

test('adapter factory: real X unless the demo switch is on', () => {
  const before = { mock: process.env.X_OAUTH_MOCK, env: process.env.NODE_ENV };
  try {
    delete process.env.X_OAUTH_MOCK;
    assert.ok(xOAuthFactory() instanceof HttpXOAuth);
    process.env.X_OAUTH_MOCK = 'true';
    process.env.NODE_ENV = 'production';
    assert.ok(xOAuthFactory() instanceof HttpXOAuth, 'production never gets the mock');
    process.env.NODE_ENV = 'development';
    assert.ok(xOAuthFactory() instanceof MockXOAuth);
  } finally {
    if (before.mock === undefined) delete process.env.X_OAUTH_MOCK; else process.env.X_OAUTH_MOCK = before.mock;
    if (before.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before.env;
  }
});

test('mock X: returns only the fictional demo profiles and rejects any other code', async () => {
  const x = new MockXOAuth();
  const p = await x.verifiedProfile('mock-demo_small');
  assert.equal(p.username, 'demo_small');
  assert.ok(p.followers < 5_000);
  assert.ok(MOCK_X_PROFILES.some((m) => m.followers >= 5_000 && m.username !== 'lunar_alpha'));
  await assert.rejects(x.verifiedProfile('mock-someone_real'), /did not confirm/);
  await assert.rejects(x.verifiedProfile('real-code-from-x'), /did not confirm/);
});

test('demo login page: 404 unless the demo is on, and it links back with a code and the same state', async () => {
  const { DemoXController } = await import('../src/claims/demo-x.controller');
  const state = 'a'.repeat(32);
  const keys = ['X_OAUTH_MOCK', 'NODE_ENV', 'X_REDIRECT_URI'] as const;
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    const c = new DemoXController();
    delete process.env.X_OAUTH_MOCK;
    process.env.X_REDIRECT_URI = 'http://localhost:3000/claim';
    assert.throws(() => c.authorize(state), /Not Found/);
    process.env.X_OAUTH_MOCK = 'true';
    process.env.NODE_ENV = 'development';
    assert.throws(() => c.authorize('not-a-state'), /Not Found/);
    const html = c.authorize(state);
    assert.match(html, /code=mock-demo_small&amp;state=a{32}/);
    assert.match(html, /@lunar_alpha/);
    process.env.NODE_ENV = 'production';
    assert.throws(() => c.authorize(state), /Not Found/);
  } finally {
    for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
  }
});
