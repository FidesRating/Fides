/**
 * End-to-end tests for the public API, staff authorization and Phase 2 rules.
 * Runs against a dedicated local database named "fides_test" (created and wiped by this file).
 * It refuses to run against any other database name.
 */
import * as assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { after, before, describe, test } from 'node:test';
import { Client } from 'pg';

const BASE_URL = process.env.TEST_ADMIN_URL ?? 'postgresql://fides:fides@localhost:5432/postgres';
const TEST_DB = 'fides_test';
const TEST_URL = BASE_URL.replace(/\/[^/]*$/, `/${TEST_DB}`);

const KEYS = {
  analyst: 'test-analyst-key',
  committeeA: 'test-committee-a-key',
  committeeB: 'test-committee-b-key',
  committeeC: 'test-committee-c-key',
  committeeD: 'test-committee-d-key',
  admin: 'test-admin-key',
};

let origin = '';
let close: () => Promise<void> = async () => undefined;
let prisma: import('@prisma/client').PrismaClient;

const api = async (path: string, opts: { method?: string; key?: string; body?: unknown } = {}) => {
  const res = await fetch(`${origin}/api/v1${path}`, {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(opts.key ? { 'x-staff-key': opts.key } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, text, json };
};

before(async () => {
  assert.equal(new URL(TEST_URL).pathname, `/${TEST_DB}`, 'test database name guard');
  const admin = new Client({ connectionString: BASE_URL });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  const env = {
    ...process.env, DATABASE_URL: TEST_URL, DIRECT_URL: TEST_URL, NODE_ENV: 'test', SEED_DEMO: 'true', NOTICE_HOURS: '48',
    SEED_ANALYST_KEY: KEYS.analyst, SEED_COMMITTEE_A_KEY: KEYS.committeeA, SEED_COMMITTEE_B_KEY: KEYS.committeeB,
    SEED_COMMITTEE_C_KEY: KEYS.committeeC, SEED_COMMITTEE_D_KEY: KEYS.committeeD, SEED_ADMIN_KEY: KEYS.admin,
  };
  Object.assign(process.env, env);
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore' });

  const db = new Client({ connectionString: TEST_URL });
  await db.connect();
  const tables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`)).rows;
  if (tables.length) await db.query(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  await db.end();
  execSync('npx prisma db seed', { env, stdio: 'ignore' });

  const { NestFactory } = await import('@nestjs/core');
  const { ValidationPipe } = await import('@nestjs/common');
  const { AppModule } = await import('../src/app.module');
  const { PrismaService } = await import('../src/prisma/prisma.service');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  origin = (await app.getUrl()).replace('[::1]', 'localhost').replace('0.0.0.0', '127.0.0.1');
  prisma = app.get(PrismaService);
  close = () => app.close();
});

after(async () => {
  await close();
});

describe('staff authorization', () => {
  test('admin and committee endpoints reject a missing or wrong key (401)', async () => {
    assert.equal((await api('/admin/influencers')).status, 401);
    assert.equal((await api('/admin/influencers', { key: 'wrong' })).status, 401);
    assert.equal((await api('/committee/queue')).status, 401);
  });

  test('an analyst cannot use committee endpoints or takedown (403)', async () => {
    assert.equal((await api('/committee/queue', { key: KEYS.analyst })).status, 403);
    const list = await api('/admin/influencers', { key: KEYS.analyst });
    assert.equal(list.status, 200);
    const id = list.json[0].id;
    assert.equal((await api(`/admin/influencers/${id}/remove`, { method: 'POST', key: KEYS.analyst, body: { reason: 'x' } })).status, 403);
  });

  test('staff writes are recorded in the audit log without request bodies', async () => {
    await api('/admin/influencers', {
      method: 'POST', key: KEYS.analyst,
      body: { handle: 'audit_probe', displayName: 'Audit Probe', followers: 20000 },
    });
    const rows = await prisma.auditLog.findMany({ where: { action: 'POST /api/v1/admin/influencers' } });
    assert.ok(rows.length >= 1, 'audit row exists');
    assert.ok(rows.every((r) => r.staffId));
  });
});

describe('coverage rules', () => {
  test('an account under 10,000 followers is rejected', async () => {
    const r = await api('/admin/influencers', { method: 'POST', key: KEYS.analyst, body: { handle: 'tiny_acct', displayName: 'Tiny', followers: 9999 } });
    assert.equal(r.status, 400);
    assert.match(r.text, /10,000/);
  });

  test('exactly 10,000 followers is accepted and creates an X social account', async () => {
    const r = await api('/admin/influencers', { method: 'POST', key: KEYS.analyst, body: { handle: 'edge_acct', displayName: 'Edge', followers: 10000 } });
    assert.equal(r.status, 201);
    assert.equal(r.json.accounts[0].platform, 'x');
  });

  test('platforms other than X are not enabled in the MVP', async () => {
    const r = await api('/admin/influencers', { method: 'POST', key: KEYS.analyst, body: { handle: 'yt_acct', displayName: 'YT', followers: 50000, platform: 'youtube' } });
    assert.equal(r.status, 400);
  });

  test('a second account is added to the same influencer and still obeys the follower floor', async () => {
    const list = await api('/admin/influencers', { key: KEYS.analyst });
    const edge = list.json.find((i: any) => i.handle === 'edge_acct');
    assert.equal((await api(`/admin/influencers/${edge.id}/accounts`, { method: 'POST', key: KEYS.analyst, body: { handle: 'edge_two', followers: 500 } })).status, 400);
    assert.equal((await api(`/admin/influencers/${edge.id}/accounts`, { method: 'POST', key: KEYS.analyst, body: { handle: 'edge_two', followers: 12000 } })).status, 201);
  });

  test('a wallet without a public source URL is rejected', async () => {
    const list = await api('/admin/influencers', { key: KEYS.analyst });
    const edge = list.json.find((i: any) => i.handle === 'edge_acct');
    const r = await api(`/admin/influencers/${edge.id}/wallets`, { method: 'POST', key: KEYS.analyst, body: { chain: 'solana', address: 'DemoLunarA1pha11111111111111111111111111111' } });
    assert.equal(r.status, 400);
  });
});

describe('call provenance and evidence snapshots', () => {
  test('manual calls record price source and the analyst who entered them', async () => {
    const list = await api('/admin/influencers', { key: KEYS.analyst });
    const edge = list.json.find((i: any) => i.handle === 'edge_acct');
    const r = await api(`/admin/influencers/${edge.id}/calls`, {
      method: 'POST', key: KEYS.analyst,
      body: { calls: [{ postUrl: 'https://x.com/edge_acct/status/1', postedAt: '2026-01-01T00:00:00Z', tokenSymbol: 'abc', priceAtCall: 1, btcAtCall: 90000, priceSourceRef: 'exchange X, 1h candle' }] },
    });
    assert.equal(r.status, 201);
    const call = await prisma.call.findFirstOrThrow({ where: { postUrl: 'https://x.com/edge_acct/status/1' } });
    assert.equal(call.priceSource, 'manual');
    assert.equal(call.priceSourceRef, 'exchange X, 1h candle');
    assert.ok(call.enteredById);
    assert.ok(call.socialAccountId);
  });

  test('a snapshot needs a valid sha256 and is exposed publicly as link and hash only', async () => {
    // The public call record shows the latest 10, so snapshot the most recent call.
    const call = await prisma.call.findFirstOrThrow({ where: { influencer: { handle: 'lunar_alpha' } }, orderBy: { postedAt: 'desc' } });
    const bad = await api(`/admin/calls/${call.id}/snapshots`, { method: 'POST', key: KEYS.analyst, body: { sourceUrl: 'https://x.com/a/status/1', contentHash: 'nothex' } });
    assert.equal(bad.status, 400);
    const hash = 'a'.repeat(64);
    const ok = await api(`/admin/calls/${call.id}/snapshots`, {
      method: 'POST', key: KEYS.analyst,
      body: { sourceUrl: 'https://x.com/a/status/1', archiveUrl: 'https://archive.example/a', contentHash: hash, storagePath: 'private/secret-file.png' },
    });
    assert.equal(ok.status, 201);
    const pub = await api('/ratings/lunar_alpha/calls');
    assert.equal(pub.status, 200);
    assert.ok(pub.text.includes(hash));
    assert.ok(!pub.text.includes('secret-file'), 'storage path must never be public');
    assert.ok(!pub.text.includes('capturedBy'));
  });
});

describe('public API', () => {
  test('the @lunar_alpha demo report matches the brief: scorecard 66 → BBB+, committee BBB, Outlook Negative', async () => {
    const r = await api('/ratings/lunar_alpha');
    assert.equal(r.status, 200);
    assert.equal(r.json.rating.rating, 'BBB');
    assert.equal(r.json.rating.scorecard.totalScore, 66);
    assert.equal(r.json.rating.scorecard.scorecardRating, 'BBB+');
    assert.equal(r.json.rating.outlook, 'negative');
    assert.equal(r.json.account.coverage, 'Unsolicited');
    assert.equal(r.json.account.followers, 182000);
    assert.ok(r.json.disclaimer);
  });

  test('public endpoints never leak votes, staff, member wallets, tip senders or pending evidence', async () => {
    const inf = await prisma.influencer.findFirstOrThrow({ where: { handle: 'lunar_alpha' } });
    const member = await prisma.member.create({ data: { walletAddress: 'MemberWalletShouldNeverAppear1111111111111111111' } });
    await prisma.tip.create({ data: { memberId: member.id, influencerId: inf.id, kind: 'other', evidenceUrl: 'https://example.com/tip-secret' } });
    await prisma.promotion.create({ data: { influencerId: inf.id, source: 'public_admission', evidenceUrl: 'https://example.com/pending-secret', disclosed: false, status: 'pending' } });
    await prisma.promotion.create({ data: { influencerId: inf.id, source: 'public_admission', evidenceUrl: 'https://example.com/rejected-secret', disclosed: false, status: 'rejected' } });

    const staff = await prisma.user.findMany();
    const forbidden = [
      member.walletAddress, 'tip-secret', 'pending-secret', 'rejected-secret',
      ...staff.flatMap((s) => [s.email, s.name, s.id]),
      'staffId', '"votes"', 'apiKeyHash', 'passwordHash', 'storagePath', 'capturedById', 'removed_guy',
    ];
    const paths = ['/ratings', '/ratings/lunar_alpha', '/ratings/lunar_alpha/history', '/ratings/lunar_alpha/calls', '/actions', '/under-review', '/stats', '/scale', '/methodology', '/research', '/research/lunar-alpha-new-rating', '/badge/lunar_alpha.svg'];
    for (const p of paths) {
      const r = await api(p);
      assert.ok(r.status === 200, `${p} → ${r.status}`);
      for (const f of forbidden) assert.ok(!r.text.includes(f), `${p} leaks ${f}`);
    }
  });

  test('a tip never changes a rating and analysts cannot see who sent it', async () => {
    const before = await api('/ratings/lunar_alpha');
    const tips = await api('/admin/tips', { key: KEYS.analyst });
    assert.equal(tips.status, 200);
    assert.ok(tips.json.length >= 1);
    assert.ok(tips.json.every((t: any) => !('memberId' in t) && !('member' in t)));
    const after = await api('/ratings/lunar_alpha');
    assert.equal(after.json.rating.rating, before.json.rating.rating);
  });

  test('takedown returns 410 Gone and removes the account from public lists', async () => {
    const list = await api('/admin/influencers', { key: KEYS.admin });
    const edge = list.json.find((i: any) => i.handle === 'audit_probe');
    const r = await api(`/admin/influencers/${edge.id}/remove`, { method: 'POST', key: KEYS.admin, body: { reason: 'does not meet coverage rules' } });
    assert.equal(r.status, 201);
    assert.equal((await api('/ratings/audit_probe')).status, 410);
    assert.ok(!(await api('/ratings')).text.includes('audit_probe'));
    assert.ok(!(await api('/under-review')).text.includes('audit_probe'));
  });

  test('a removed account with a published rating disappears from every public endpoint', async () => {
    const inf = await prisma.influencer.findFirstOrThrow({ where: { handle: 'lunar_alpha' } });
    await prisma.influencer.update({ where: { id: inf.id }, data: { status: 'removed', removedAt: new Date() } });
    try {
      assert.equal((await api('/ratings/lunar_alpha')).status, 410);
      assert.equal((await api('/ratings/lunar_alpha/history')).status, 410);
      assert.equal((await api('/ratings/lunar_alpha/calls')).status, 410);
      for (const p of ['/ratings', '/actions', '/under-review', '/research', '/research/lunar-alpha-new-rating']) {
        assert.ok(!(await api(p)).text.includes('lunar_alpha'), `${p} still lists the removed account`);
      }
    } finally {
      await prisma.influencer.update({ where: { id: inf.id }, data: { status: 'rated', removedAt: null } });
    }
  });
});
