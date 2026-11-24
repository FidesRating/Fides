import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ZeroHash } from 'ethers';
import {
  canonicalRating, decisionContentHash, decisionRecordId, decisionSalt, evidenceContentHash, evidenceRecordId, rationaleHash,
  ratingContentHash, ratingRecordId,
} from '../src/chain/anchor-hash';
import { loadChainConfig } from '../src/chain/chain-anchor';

const fields = {
  actionNumber: 7, handle: 'SomeHandle', rating: 'BBB', outlook: 'stable', type: 'initial',
  methodologyVersion: '1.0', publishedAt: new Date('2026-11-25T10:00:00.000Z'), rationale: null,
};
const SECRET = 's'.repeat(40);
const KEY = '0x' + '11'.repeat(32);
const ADDR = '0x6BEb3A9634F9cab0bB0C225053A1bb6025eeD9f4';

test('rating hash is deterministic and changes with any public field', () => {
  assert.equal(ratingContentHash(fields), ratingContentHash({ ...fields }));
  assert.notEqual(ratingContentHash(fields), ratingContentHash({ ...fields, rating: 'BB' }));
  assert.notEqual(ratingContentHash(fields), ratingContentHash({ ...fields, rationale: 'x' }));
  assert.match(canonicalRating(fields), /^fides-rating-v1\|7\|somehandle\|BBB\|stable\|initial\|1\.0\|2026-11-25T10:00:00.000Z\|$/);
});

test('record ids carry no raw identifiers and differ per registry', () => {
  assert.notEqual(ratingRecordId(7), decisionRecordId(7));
  assert.match(ratingRecordId(7), /^0x[0-9a-f]{64}$/);
});

test('decision hash is salted: same outcome with another secret or action gives another hash', () => {
  const base = { secret: SECRET, actionNumber: 7, rating: 'BBB', outlook: 'stable', countedVotes: 3 };
  const h = decisionContentHash(base);
  assert.equal(h, decisionContentHash(base));
  assert.notEqual(h, decisionContentHash({ ...base, secret: 'z'.repeat(40) }));
  assert.notEqual(h, decisionContentHash({ ...base, actionNumber: 8 }));
  assert.notEqual(decisionSalt(SECRET, 7), decisionSalt(SECRET, 8));
});

test('rationale hash is zero when there is no rationale', () => {
  assert.equal(rationaleHash(null), ZeroHash);
  assert.notEqual(rationaleHash('why'), ZeroHash);
});

test('chain config: off when unset, fails when partly set, validates values', () => {
  assert.equal(loadChainConfig({}), null);
  assert.throws(() => loadChainConfig({ CHAIN_RPC_URL: 'https://rpc.example' }), /partly configured/);
  const full = {
    CHAIN_RPC_URL: 'https://rpc.example', ANCHOR_PUBLISHER_KEY: KEY, RATING_REGISTRY_ADDRESS: ADDR,
    COMMITTEE_LOG_ADDRESS: ADDR, ANCHOR_SALT_SECRET: SECRET,
  };
  const cfg = loadChainConfig(full)!;
  assert.equal(cfg.chainId, 4663);
  assert.throws(() => loadChainConfig({ ...full, ANCHOR_PUBLISHER_KEY: '0x12' }), /32-byte/);
  assert.throws(() => loadChainConfig({ ...full, ANCHOR_SALT_SECRET: 'short' }), /32 characters/);
  assert.throws(() => loadChainConfig({ ...full, RATING_REGISTRY_ADDRESS: 'nope' }));
});

test('evidence hash reuses the stored sha256 and rejects anything else', () => {
  assert.equal(evidenceContentHash('AB'.repeat(32)), '0x' + 'ab'.repeat(32));
  assert.throws(() => evidenceContentHash('abc'), /64 hex/);
  assert.match(evidenceRecordId('some-snapshot-id'), /^0x[0-9a-f]{64}$/);
  assert.notEqual(evidenceRecordId('a'), ratingRecordId(1));
});

test('chain config: evidence anchor address is optional and validated', () => {
  const base = {
    CHAIN_RPC_URL: 'https://rpc.example', ANCHOR_PUBLISHER_KEY: KEY, RATING_REGISTRY_ADDRESS: ADDR,
    COMMITTEE_LOG_ADDRESS: ADDR, ANCHOR_SALT_SECRET: SECRET,
  };
  assert.equal(loadChainConfig(base)!.evidenceAnchor, null);
  assert.equal(loadChainConfig({ ...base, EVIDENCE_ANCHOR_ADDRESS: ADDR })!.evidenceAnchor, ADDR);
  assert.throws(() => loadChainConfig({ ...base, EVIDENCE_ANCHOR_ADDRESS: 'nope' }));
});
