import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertProductionConfig } from '../src/common/production-config';

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

test('production config: refuses SEED_DEMO=true and the mock balance', () => {
  assert.throws(() => assertProductionConfig({ ...safe, SEED_DEMO: 'true' }), /SEED_DEMO/);
  assert.throws(() => assertProductionConfig({ ...safe, TOKEN_GATE_MOCK_BALANCE: '1' }), /TOKEN_GATE_MOCK_BALANCE/);
});

test('production config: development is not restricted', () => {
  assert.doesNotThrow(() => assertProductionConfig({ NODE_ENV: 'development', NOTICE_HOURS: '1', SEED_DEMO: 'true' }));
});
