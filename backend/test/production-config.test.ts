import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertProductionConfig, isPrelaunch } from '../src/common/production-config';

const safe = { NODE_ENV: 'production', CORS_ORIGINS: 'https://fides.example', NOTICE_HOURS: '48' };

test('production config: a safe configuration boots', () => {
  assert.doesNotThrow(() => assertProductionConfig(safe));
});

test('production config: refuses missing CORS_ORIGINS', () => {
  assert.throws(() => assertProductionConfig({ ...safe, CORS_ORIGINS: '' }), /CORS_ORIGINS/);
  assert.throws(() => assertProductionConfig({ ...safe, CORS_ORIGINS: undefined }), /CORS_ORIGINS/);
});

test('production config: refuses NOTICE_HOURS below 48', () => {
  assert.throws(() => assertProductionConfig({ ...safe, NOTICE_HOURS: '47' }), /NOTICE_HOURS/);
  assert.throws(() => assertProductionConfig({ ...safe, NOTICE_HOURS: 'abc' }), /NOTICE_HOURS/);
  assert.doesNotThrow(() => assertProductionConfig({ ...safe, NOTICE_HOURS: '72' }));
});

test('production config: pre-launch mode allows a short notice, and only while the flag is true', () => {
  assert.doesNotThrow(() => assertProductionConfig({ ...safe, PRELAUNCH_MODE: 'true', NOTICE_HOURS: '0' }));
  assert.throws(() => assertProductionConfig({ ...safe, PRELAUNCH_MODE: 'false', NOTICE_HOURS: '0' }), /NOTICE_HOURS/);
  assert.throws(() => assertProductionConfig({ ...safe, NOTICE_HOURS: '0' }), /NOTICE_HOURS/);
  assert.throws(() => assertProductionConfig({ ...safe, PRELAUNCH_MODE: 'yes' }), /PRELAUNCH_MODE/);
  assert.equal(isPrelaunch({ PRELAUNCH_MODE: 'true' }), true);
  assert.equal(isPrelaunch({}), false);
});

test('production config: refuses SEED_DEMO=true and the mock balance', () => {
  assert.throws(() => assertProductionConfig({ ...safe, SEED_DEMO: 'true' }), /SEED_DEMO/);
  assert.throws(() => assertProductionConfig({ ...safe, TOKEN_GATE_MOCK_BALANCE: '1' }), /TOKEN_GATE_MOCK_BALANCE/);
});

test('production config: refuses a malformed STAFF_WALLETS', () => {
  assert.throws(() => assertProductionConfig({ ...safe, STAFF_WALLETS: 'bad:analyst' }), /STAFF_WALLETS/);
});

test('production config: ROLE must be all, api or worker', () => {
  assert.doesNotThrow(() => assertProductionConfig({ ...safe, ROLE: 'worker' }));
  assert.throws(() => assertProductionConfig({ ...safe, ROLE: 'both' }), /ROLE/);
});

test('production config: development is not restricted', () => {
  assert.doesNotThrow(() => assertProductionConfig({ NODE_ENV: 'development', NOTICE_HOURS: '1', SEED_DEMO: 'true' }));
});
