/**
 * End-to-end tests for the public API, staff authorization and Phase 2 rules.
 * Runs against a dedicated local database named "fides_test" (created and wiped by this file).
 * It refuses to run against any other database name.
 */
import * as assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { after, before, describe, test } from 'node:test';
import { createHash } from 'node:crypto';
import { Wallet } from 'ethers';
import { Client } from 'pg';

const BASE_URL = process.env.TEST_ADMIN_URL ?? 'postgresql://fides:fides@localhost:5432/postgres';
const TEST_DB = 'fides_test';
const TEST_URL = BASE_URL.replace(/\/[^/]*$/, `/${TEST_DB}`);

// Staff sign in with a wallet session. Each role gets a throwaway Solana wallet and a session token.
const ROLE_OF: Record<string, 'analyst' | 'committee' | 'admin'> = {
  analyst: 'analyst', committeeA: 'committee', committeeB: 'committee', committeeC: 'committee', committeeD: 'committee', admin: 'admin',
};
const KEYS: Record<keyof typeof ROLE_OF, string> = {
  analyst: 'test-analyst-token', committeeA: 'test-committee-a-token', committeeB: 'test-committee-b-token',
  committeeC: 'test-committee-c-token', committeeD: 'test-committee-d-token', admin: 'test-admin-token',
};
type Signer = { address: string; signMessage(message: string): Promise<string> };
const SIGNERS = Object.fromEntries(Object.keys(ROLE_OF).map((k) => [k, Wallet.createRandom()])) as unknown as Record<keyof typeof ROLE_OF, Signer>;
const WALLETS = Object.fromEntries(Object.entries(SIGNERS).map(([k, w]) => [k, w.address.toLowerCase()])) as Record<keyof typeof ROLE_OF, string>;
const randomAddress = () => Wallet.createRandom().address.toLowerCase();

let origin = '';
let close: () => Promise<void> = async () => undefined;
let prisma: import('@prisma/client').PrismaClient;
let appRef: import('@nestjs/common').INestApplication;

const api = async (path: string, opts: { method?: string; key?: string; body?: unknown } = {}) => {
  const res = await fetch(`${origin}/api/v1${path}`, {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}) },
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
    STAFF_WALLETS: Object.entries(WALLETS).map(([k, w]) => `${w}:${ROLE_OF[k]}`).join(','),
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
  appRef = app;
  for (const k of Object.keys(ROLE_OF) as (keyof typeof ROLE_OF)[]) {
    const member = await prisma.member.create({ data: { walletAddress: WALLETS[k] } });
    await prisma.memberSession.create({
      data: { memberId: member.id, tokenHash: createHash('sha256').update(KEYS[k]).digest('hex'), expiresAt: new Date(Date.now() + 86400_000) },
    });
  }
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

describe('committee flow, notice, appeal and watch (Phase 3)', () => {
  const ok = (s: number) => s === 200 || s === 201;
  let infId = '';
  let actionId = '';
  let scorecard = '';

  test('draft → committee: a rated account goes through a scorecard and is submitted', async () => {
    const inf = await api('/admin/influencers', { method: 'POST', key: KEYS.analyst, body: { handle: 'flow_acct', displayName: 'Flow Account', followers: 20000 } });
    assert.equal(inf.status, 201);
    infId = inf.json.id;
    const a = await api(`/admin/influencers/${infId}/actions`, { method: 'POST', key: KEYS.analyst });
    assert.ok(ok(a.status), a.text);
    actionId = a.json.id;
    scorecard = a.json.scorecardRating;
    assert.ok(scorecard);
    assert.ok(ok((await api(`/admin/actions/${actionId}/submit`, { method: 'POST', key: KEYS.analyst })).status));
  });

  test('votes: an analyst cannot vote, and a vote more than one notch from the scorecard is rejected', async () => {
    assert.equal((await api(`/committee/actions/${actionId}/vote`, { method: 'PUT', key: KEYS.analyst, body: { rating: scorecard, outlook: 'stable' } })).status, 403);
    assert.equal((await api(`/committee/actions/${actionId}/vote`, { method: 'PUT', key: KEYS.committeeA, body: { rating: 'AAA', outlook: 'stable' } })).status, 400);
  });

  test('quorum: finalize needs 3 non-recused votes, and a conflicted member cannot vote', async () => {
    const vote = (key: string) => api(`/committee/actions/${actionId}/vote`, { method: 'PUT', key, body: { rating: scorecard, outlook: 'stable' } });
    assert.ok(ok((await vote(KEYS.committeeA)).status));
    assert.ok(ok((await vote(KEYS.committeeB)).status));
    const early = await api(`/committee/actions/${actionId}/finalize`, { method: 'POST', key: KEYS.committeeA, body: {} });
    assert.equal(early.status, 400);
    assert.match(early.text, /At least 3/);

    assert.ok(ok((await api('/committee/conflicts', { method: 'POST', key: KEYS.committeeD, body: { influencerId: infId, reason: 'paid by this account' } })).status));
    assert.equal((await vote(KEYS.committeeD)).status, 403);
    assert.ok(ok((await vote(KEYS.committeeC)).status));
  });

  test('notice: an unclaimed account cannot be published without proof, nor before 48 hours', async () => {
    const fin = await api(`/committee/actions/${actionId}/finalize`, { method: 'POST', key: KEYS.committeeA, body: {} });
    assert.ok(ok(fin.status), fin.text);
    const row = await prisma.ratingAction.findUniqueOrThrow({ where: { id: actionId } });
    assert.equal(row.status, 'notice');
    assert.equal(row.noticeChannel, 'x_mention');
    assert.equal(row.publishAfter, null, 'the clock must not start before the mention is recorded');

    const noProof = await api(`/committee/actions/${actionId}/publish`, { method: 'POST', key: KEYS.committeeA });
    assert.equal(noProof.status, 400);
    assert.match(noProof.text, /record the X mention/);

    assert.equal((await api(`/committee/actions/${actionId}/notice-proof`, { method: 'POST', key: KEYS.analyst, body: { url: 'https://evil.example/a/status/1' } })).status, 400);
    const proof = await api(`/committee/actions/${actionId}/notice-proof`, { method: 'POST', key: KEYS.analyst, body: { url: 'https://x.com/FidesDesk/status/999000111' } });
    assert.ok(ok(proof.status), proof.text);
    assert.equal((await api(`/committee/actions/${actionId}/notice-proof`, { method: 'POST', key: KEYS.analyst, body: { url: 'https://x.com/FidesDesk/status/999000112' } })).status, 409);

    const after = await prisma.ratingAction.findUniqueOrThrow({ where: { id: actionId } });
    const hours = (after.publishAfter!.getTime() - Date.now()) / 3600_000;
    assert.ok(hours > 47.9 && hours <= 48, `notice window is ${hours} hours`);
    const early = await api(`/committee/actions/${actionId}/publish`, { method: 'POST', key: KEYS.committeeA });
    assert.equal(early.status, 400);
    assert.match(early.text, /flag factual errors/);
  });

  test('publish: after the notice period the rating is published, and the proof URL stays internal', async () => {
    await prisma.ratingAction.update({ where: { id: actionId }, data: { publishAfter: new Date(Date.now() - 1000) } });
    const pub = await api(`/committee/actions/${actionId}/publish`, { method: 'POST', key: KEYS.committeeA });
    assert.ok(ok(pub.status), pub.text);
    const report = await api('/ratings/flow_acct');
    assert.equal(report.status, 200);
    assert.ok(!report.text.includes('999000111'));
  });

  test('appeal: rejecting needs 3 non-conflicted members; a conflicted member is refused', async () => {
    const appeal = await prisma.appeal.create({ data: { actionId, reason: 'The facts in the scorecard are incomplete for this account.' } });
    const reject = (key: string) => api(`/committee/appeals/${appeal.id}/decide`, { method: 'POST', key, body: { decision: 'reject', note: 'Rating stands' } });
    assert.equal((await reject(KEYS.committeeD)).status, 403);
    assert.equal((await reject(KEYS.analyst)).status, 403);
    const first = await reject(KEYS.committeeA);
    assert.equal(first.json.status, 'open');
    assert.equal((await reject(KEYS.committeeA)).json.rejectVotes, 1, 'the same member counts once');
    assert.equal((await reject(KEYS.committeeB)).json.status, 'open');
    assert.equal((await reject(KEYS.committeeC)).json.status, 'rejected');
  });

  test('watch: needs a public reason, hides after 90 days, and cannot be set again on the same action', async () => {
    const watch = (body: object) => api(`/committee/actions/${actionId}/watch`, { method: 'PATCH', key: KEYS.committeeA, body });
    assert.equal((await watch({ watch: 'watch_negative' })).status, 400);
    assert.ok(ok((await watch({ watch: 'watch_negative', reason: 'A specific event is under review' })).status));
    assert.equal((await api('/ratings/flow_acct')).json.rating.watch, 'watch_negative');

    await prisma.ratingAction.update({ where: { id: actionId }, data: { watchSetAt: new Date(Date.now() - 91 * 86400_000) } });
    assert.equal((await api('/ratings/flow_acct')).json.rating.watch, null);
    const again = await watch({ watch: 'watch_negative', reason: 'Still under review' });
    assert.equal(again.status, 400);
    assert.match(again.text, /has ended/);
  });

  test('appeal: one non-conflicted member can reopen it, and the account is flagged for a new review', async () => {
    await prisma.appeal.update({ where: { actionId }, data: { status: 'open', decision: null, decidedAt: null } });
    const appeal = await prisma.appeal.findUniqueOrThrow({ where: { actionId } });
    const reopen = (key: string) => api(`/committee/appeals/${appeal.id}/decide`, { method: 'POST', key, body: { decision: 'reopen', note: 'New facts' } });
    assert.equal((await reopen(KEYS.committeeD)).status, 403, 'a conflicted member cannot decide');
    const r = await reopen(KEYS.committeeA);
    assert.ok(ok(r.status), r.text);
    assert.equal(r.json.status, 'reopened');
    assert.equal((await prisma.influencer.findUniqueOrThrow({ where: { id: infId } })).reviewDue, true);
  });
});

describe('wallet login with an EVM wallet', () => {
  const login = async (signer: Signer, opts: { address?: string; signWith?: Signer } = {}) => {
    const address = opts.address ?? signer.address;
    const n = await api('/auth/nonce', { method: 'POST', body: { walletAddress: address } });
    if (n.status >= 400) return { nonce: n, verify: null as null | Awaited<ReturnType<typeof api>> };
    const signature = await (opts.signWith ?? signer).signMessage(n.json.message);
    return { nonce: n, verify: await api('/auth/verify', { method: 'POST', body: { walletAddress: address, nonce: n.json.nonce, signature } }), signature };
  };
  const authed = (token: string, path: string) =>
    fetch(`${origin}/api/v1${path}`, { headers: { authorization: `Bearer ${token}` } }).then(async (r) => ({ status: r.status, text: await r.text() }));

  test('a signature from the wallet opens a session, whatever case the address is written in', async () => {
    const signer = Wallet.createRandom();
    const r = await login(signer, { address: signer.address.toLowerCase() });
    assert.ok(r.verify && (r.verify.status === 200 || r.verify.status === 201), r.verify?.text);
    const me = await authed(r.verify!.json.token, '/me');
    assert.equal(me.status, 200);
    assert.equal(JSON.parse(me.text).walletAddress, signer.address.toLowerCase());
    // The same wallet in checksum case is the same member, not a second row.
    const again = await login(signer);
    assert.ok(again.verify && (again.verify.status === 200 || again.verify.status === 201));
    assert.equal(await prisma.member.count({ where: { walletAddress: signer.address.toLowerCase() } }), 1);
  });

  test('a Solana address, a wrong signer, a used nonce and a made-up signature are all refused', async () => {
    assert.equal((await api('/auth/nonce', { method: 'POST', body: { walletAddress: '11111111111111111111111111111112' } })).status, 400);
    const signer = Wallet.createRandom();
    const wrong = await login(signer, { signWith: Wallet.createRandom() });
    assert.equal(wrong.verify?.status, 400);

    const ok = await login(signer);
    assert.ok(ok.verify && (ok.verify.status === 200 || ok.verify.status === 201));
    const replay = await api('/auth/verify', { method: 'POST', body: { walletAddress: signer.address, nonce: ok.nonce.json.nonce, signature: ok.signature } });
    assert.equal(replay.status, 401, 'a nonce works once');
    const fake = await api('/auth/verify', { method: 'POST', body: { walletAddress: signer.address, nonce: 'nope', signature: '0x00' } });
    assert.equal(fake.status, 401);
  });

  test('staff: a wallet on the allowlist signs in for real and reaches the committee queue; other wallets get 403', async () => {
    const staff = await login(SIGNERS.committeeA);
    assert.ok(staff.verify && (staff.verify.status === 200 || staff.verify.status === 201), staff.verify?.text);
    assert.equal((await authed(staff.verify!.json.token, '/committee/queue')).status, 200);

    const outsider = await login(Wallet.createRandom());
    assert.equal((await authed(outsider.verify!.json.token, '/committee/queue')).status, 403);
    assert.equal((await authed(outsider.verify!.json.token, '/admin/influencers')).status, 403);
  });

  test('the holder gate stays closed while the token contract is not configured', async () => {
    const { json } = (await login(Wallet.createRandom())).verify!;
    assert.equal(json.member.isHolder, false);
    assert.equal((await api('/tips', { method: 'POST', key: json.token, body: { handle: 'lunar_alpha', kind: 'other', evidenceUrl: 'https://example.com/x' } })).status, 403);
  });
});

describe('profile claim through Login with X', () => {
  const ok = (s: number) => s === 200 || s === 201;
  let xUsername = 'claim_acct';
  let xServer: import('node:http').Server;
  const saved = { id: process.env.X_CLIENT_ID, uri: process.env.X_REDIRECT_URI, api: process.env.X_API_URL };

  const newMember = async (label: string) => {
    const member = await prisma.member.create({ data: { walletAddress: randomAddress() } });
    const token = `test-member-${label}`;
    await prisma.memberSession.create({ data: { memberId: member.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 86400_000) } });
    return { member, token };
  };
  const startClaim = async (token: string) => {
    const r = await api('/claim/x/start', { method: 'POST', key: token, body: {} });
    return { ...r, state: r.json?.authorizeUrl ? new URL(r.json.authorizeUrl).searchParams.get('state')! : '' };
  };

  before(async () => {
    const { createServer } = await import('node:http');
    // A stand-in for the X API: it confirms any code and reports the configured username.
    xServer = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/2/oauth2/token') res.end(JSON.stringify({ access_token: 'mock-token' }));
      else if (req.url === '/2/users/me') res.end(JSON.stringify({ data: { username: xUsername } }));
      else { res.statusCode = 404; res.end('{}'); }
    });
    await new Promise<void>((resolve) => xServer.listen(0, '127.0.0.1', resolve));
    process.env.X_API_URL = `http://127.0.0.1:${(xServer.address() as import('node:net').AddressInfo).port}`;
    const created = await api('/admin/influencers', { method: 'POST', key: KEYS.analyst, body: { handle: 'claim_acct', displayName: 'Claim Account', followers: 30000 } });
    assert.equal(created.status, 201);
  });

  after(async () => {
    await new Promise((resolve) => xServer.close(resolve));
    for (const [k, v] of [['X_CLIENT_ID', saved.id], ['X_REDIRECT_URI', saved.uri], ['X_API_URL', saved.api]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  test('without X credentials the claim flow is closed (503), and it needs a signed-in wallet (401)', async () => {
    delete process.env.X_CLIENT_ID;
    delete process.env.X_REDIRECT_URI;
    const { token } = await newMember('closed');
    assert.equal((await api('/claim/x/start', { method: 'POST', body: {} })).status, 401);
    assert.equal((await api('/claim/x/start', { method: 'POST', key: token, body: {} })).status, 503);
  });

  test('a state belongs to one wallet and works once; the verified X username decides the account', async () => {
    process.env.X_CLIENT_ID = 'test-client';
    process.env.X_REDIRECT_URI = 'https://example.test/claim';
    const a = await newMember('a');
    const b = await newMember('b');
    const complete = (token: string, state: string) => api('/claim/x/complete', { method: 'POST', key: token, body: { code: 'any-code', state } });

    const sa = await startClaim(a.token);
    assert.ok(ok(sa.status), sa.text);
    assert.equal((await complete(a.token, 'made-up-state')).status, 401, 'unknown state');
    assert.equal((await complete(b.token, sa.state)).status, 401, 'state of another wallet');

    xUsername = 'not_covered_by_fides';
    assert.equal((await complete(a.token, sa.state)).status, 404, 'account not covered');
    assert.equal((await complete(a.token, sa.state)).status, 401, 'the state is used up even when the claim fails');

    xUsername = 'Claim_Acct';
    const sa2 = await startClaim(a.token);
    const done = await complete(a.token, sa2.state);
    assert.ok(ok(done.status), done.text);
    assert.equal(done.json.handle, 'claim_acct');
    assert.equal((await prisma.influencer.findFirstOrThrow({ where: { handle: 'claim_acct' } })).participating, true);
    assert.equal((await complete(a.token, sa2.state)).status, 401, 'replay');

    const sb = await startClaim(b.token);
    assert.equal((await complete(b.token, sb.state)).status, 409, 'already claimed by another wallet');
    assert.equal((await startClaim(a.token)).status, 409, 'this wallet already manages an account');

    const me = await api('/claim/me', { key: a.token });
    assert.equal(me.status, 200);
    assert.equal(me.json.handle, 'claim_acct');
  });
});

describe('Desk watchlist (in-app, holders only)', () => {
  const ok = (s: number) => s === 200 || s === 201;
  const saved = { c: process.env.TOKEN_CONTRACT, r: process.env.TOKEN_RPC_URL, m: process.env.MEMBER_MIN_BALANCE };
  let holder = '';
  let nonHolder = '';

  const session = async (label: string, balance: number) => {
    const member = await prisma.member.create({ data: { walletAddress: randomAddress(), tokenBalance: balance } });
    const token = `test-watch-${label}`;
    await prisma.memberSession.create({ data: { memberId: member.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 86400_000) } });
    return token;
  };

  before(async () => {
    // The holder gate is configured; the member row carries the balance the gate compares with the threshold.
    process.env.TOKEN_CONTRACT = '0x3333333333333333333333333333333333333333';
    process.env.TOKEN_RPC_URL = 'https://rpc.example.test';
    process.env.MEMBER_MIN_BALANCE = '100';
    holder = await session('holder', 500);
    nonHolder = await session('nonholder', 5);
  });

  after(() => {
    for (const [k, v] of [['TOKEN_CONTRACT', saved.c], ['TOKEN_RPC_URL', saved.r], ['MEMBER_MIN_BALANCE', saved.m]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  const call = (path: string, key: string | undefined, method = 'GET') => api(`/me/watchlist${path}`, { method, key });

  test('login is required (401) and a member below the threshold is refused (403)', async () => {
    assert.equal((await call('', undefined)).status, 401);
    assert.equal((await call('', nonHolder)).status, 403);
    assert.equal((await call('/lunar_alpha', nonHolder, 'PUT')).status, 403);
  });

  test('a holder saves an account once, sees its published rating, and can remove it', async () => {
    assert.equal((await call('/no_such_account', holder, 'PUT')).status, 404);
    assert.ok(ok((await call('/lunar_alpha', holder, 'PUT')).status));
    assert.ok(ok((await call('/@Lunar_Alpha', holder, 'PUT')).status), 'adding twice is harmless');
    const list = await call('', holder);
    assert.equal(list.status, 200);
    assert.equal(list.json.length, 1);
    assert.equal(list.json[0].handle, 'lunar_alpha');
    assert.equal(list.json[0].current.rating, 'BBB');
    assert.equal((await call('/lunar_alpha', holder, 'DELETE')).status, 200);
    assert.equal((await call('', holder)).json.length, 0);
  });

  test('the feed only shows published actions: an account in draft shows no rating and no action', async () => {
    const edge = (await api('/admin/influencers', { key: KEYS.analyst })).json.find((i: any) => i.handle === 'edge_acct');
    const draft = await api(`/admin/influencers/${edge.id}/actions`, { method: 'POST', key: KEYS.analyst });
    assert.ok(ok(draft.status), draft.text);
    await call('/edge_acct', holder, 'PUT');
    await call('/lunar_alpha', holder, 'PUT');

    const list = await call('', holder);
    assert.equal(list.json.find((i: any) => i.handle === 'edge_acct').current, null, 'no rating before publication');
    const feed = await call('/feed', holder);
    assert.equal(feed.status, 200);
    assert.ok(feed.json.length >= 1);
    assert.ok(feed.json.every((a: any) => a.handle !== 'edge_acct'), 'a draft action never appears');
    assert.ok(feed.json.every((a: any) => ['handle', 'actionId', 'rating', 'outlook', 'type', 'displayName', 'previousRating', 'publishedAt'].every((k) => k in a)));
    for (const forbidden of ['votes', 'staffId', 'inputs', 'analystId', 'scorecardRating']) assert.ok(!feed.text.includes(forbidden), `feed leaks ${forbidden}`);

    const raw = await fetch(`${origin}/api/v1/me/watchlist/feed`, { headers: { authorization: `Bearer ${holder}` } });
    assert.equal(raw.headers.get('cache-control'), 'private, no-store');
  });

  test('a removed (taken down) account disappears from the watchlist', async () => {
    const inf = await prisma.influencer.findFirstOrThrow({ where: { handle: 'claim_acct' } });
    assert.ok(ok((await call('/claim_acct', holder, 'PUT')).status));
    await prisma.influencer.update({ where: { id: inf.id }, data: { status: 'removed', removedAt: new Date() } });
    assert.ok(!(await call('', holder)).text.includes('claim_acct'));
    assert.equal((await call('/claim_acct', holder, 'PUT')).status, 404, 'a removed account cannot be added');
  });

  test('API keys: only holders create them, a key opens the full call record, and a revoked key does not', async () => {
    assert.equal((await api('/me/api-keys', { method: 'POST', key: nonHolder, body: { label: 'x' } })).status, 403);
    const made = await api('/me/api-keys', { method: 'POST', key: holder, body: { label: 'test key' } });
    assert.ok(ok(made.status), made.text);
    const calls = (apiKey?: string) => fetch(`${origin}/api/v1/ratings/lunar_alpha/calls`, { headers: apiKey ? { 'x-api-key': apiKey } : {} }).then((r) => r.json());

    assert.equal((await calls()).fullAccess, false, 'anonymous readers get the latest 10 calls');
    assert.equal((await calls(made.json.key)).fullAccess, true, 'a holder key opens the full record');
    assert.ok(ok((await api(`/me/api-keys/${made.json.id}`, { method: 'DELETE', key: holder })).status));
    assert.equal((await calls(made.json.key)).fullAccess, false, 'a revoked key is refused');
  });

  test('tips: a holder sends evidence, analysts see it without the sender, and a non-holder is refused', async () => {
    process.env.TOKEN_GATE_MOCK_BALANCE = '500';
    try {
      const body = { handle: 'lunar_alpha', kind: 'other', evidenceUrl: 'https://example.com/desk-tip-evidence', note: 'desk tip probe' };
      assert.equal((await api('/tips', { method: 'POST', key: nonHolder, body })).status, 403);
      const sent = await api('/tips', { method: 'POST', key: holder, body });
      assert.ok(ok(sent.status), sent.text);
      const queue = await api('/admin/tips?status=new', { key: KEYS.analyst });
      const tip = queue.json.find((t: any) => t.evidenceUrl === body.evidenceUrl);
      assert.ok(tip, 'the tip is in the analyst queue');
      assert.ok(!('memberId' in tip) && !('member' in tip), 'the sender is hidden from analysts');
    } finally {
      delete process.env.TOKEN_GATE_MOCK_BALANCE;
    }
  });

  test('the watchlist is capped at 50 accounts', async () => {
    const capped = await session('capped', 500);
    await prisma.influencer.createMany({ data: Array.from({ length: 51 }, (_, i) => ({ handle: `cap_acct_${i}`, displayName: `Cap ${i}` })) });
    for (let i = 0; i < 50; i++) assert.ok(ok((await call(`/cap_acct_${i}`, capped, 'PUT')).status));
    const over = await call('/cap_acct_50', capped, 'PUT');
    assert.equal(over.status, 400);
    assert.match(over.text, /up to 50/);
  });
});

describe('takedown request form', () => {
  const ok = (s: number) => s === 200 || s === 201;
  const post = (body: unknown) => api('/takedown-requests', { method: 'POST', body });
  const reason = 'takedown-secret-reason: this person does not act as an influencer';

  test('a request needs a valid handle and a reason (400), and nothing is stored for invalid input', async () => {
    const before = await prisma.takedownRequest.count();
    assert.equal((await post({ handle: 'not a handle!', reason })).status, 400);
    assert.equal((await post({ handle: 'lunar_alpha', reason: 'short' })).status, 400);
    assert.equal(await prisma.takedownRequest.count(), before);
  });

  test('the answer is identical for a covered and an unknown account, and a duplicate stores one row', async () => {
    const covered = await post({ handle: '@Lunar_Alpha', reason, contact: 'takedown-secret-contact@example.test' });
    const unknown = await post({ handle: 'nobody_here', reason });
    assert.equal(covered.status, 201);
    assert.equal(unknown.status, 201);
    assert.deepEqual(covered.json, unknown.json, 'the form must not reveal who is rated');

    const again = await post({ handle: 'lunar_alpha', reason: `${reason} (second request)` });
    assert.equal(again.status, 201);
    assert.equal(await prisma.takedownRequest.count({ where: { handle: 'lunar_alpha', status: 'new' } }), 1);
  });

  test('the form is rate limited after 5 requests per hour', async () => {
    assert.equal((await post({ handle: 'another_one', reason })).status, 429);
  });

  test('staff see the requests with the matching account; anonymous callers and non-staff cannot', async () => {
    assert.equal((await api('/admin/takedown-requests')).status, 401);
    const list = await api('/admin/takedown-requests?status=new', { key: KEYS.analyst });
    assert.equal(list.status, 200);
    const covered = list.json.find((r: any) => r.handle === 'lunar_alpha');
    assert.equal(covered.account.handle, 'lunar_alpha');
    assert.equal(list.json.find((r: any) => r.handle === 'nobody_here').account, null);
  });

  test('a review records the decision once and does not remove the account by itself', async () => {
    const row = await prisma.takedownRequest.findFirstOrThrow({ where: { handle: 'lunar_alpha' } });
    const r = await api(`/admin/takedown-requests/${row.id}/review`, { method: 'POST', key: KEYS.analyst, body: { status: 'rejected', note: 'Meets the coverage rules' } });
    assert.ok(ok(r.status), r.text);
    assert.equal(r.json.status, 'rejected');
    assert.equal((await api(`/admin/takedown-requests/${row.id}/review`, { method: 'POST', key: KEYS.analyst, body: { status: 'accepted' } })).status, 400);
    assert.equal((await api('/ratings/lunar_alpha')).status, 200, 'the account is still public until an admin removes it');
  });
});

describe('free-plan guardrails (Supabase and Railway)', () => {
  const raw = (path: string, headers: Record<string, string> = {}) => fetch(`${origin}/api/v1${path}`, { headers });

  test('every table has row level security enabled and no policy opens it to the public', async () => {
    const db = new Client({ connectionString: TEST_URL });
    await db.connect();
    try {
      const open = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' AND NOT rowsecurity`);
      assert.deepEqual(open.rows, [], 'tables without RLS');
      const policies = await db.query(`SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'`);
      assert.deepEqual(policies.rows, [], 'public policies must not exist');
    } finally {
      await db.end();
    }
  });

  test('anonymous public responses are cacheable, personalised ones are not, and the health check is not cached', async () => {
    const anon = await raw('/ratings');
    assert.match(anon.headers.get('cache-control') ?? '', /s-maxage=60/);
    const holder = await raw('/ratings/lunar_alpha', { authorization: 'Bearer anything' });
    assert.equal(holder.headers.get('cache-control'), 'private, no-store');
    const health = await raw('/health');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('cache-control'), 'no-store');
  });

  test('the daily job prunes expired nonces and sessions and old audit rows, and keeps recent ones', async () => {
    const { SurveillanceService } = await import('../src/queue/surveillance');
    const day = 86400_000;
    const member = await prisma.member.create({ data: { walletAddress: randomAddress() } });
    const mk = (nonce: string, ageDays: number) => ({ walletAddress: member.walletAddress, nonce, purpose: 'login', message: 'm', expiresAt: new Date(Date.now() - ageDays * day) });
    await prisma.authNonce.createMany({ data: [mk('prune-old-nonce', 3), mk('prune-new-nonce', 0)] });
    await prisma.memberSession.createMany({
      data: [
        { memberId: member.id, tokenHash: 'prune-old-session', expiresAt: new Date(Date.now() - day) },
        { memberId: member.id, tokenHash: 'prune-new-session', expiresAt: new Date(Date.now() + day) },
      ],
    });
    await prisma.auditLog.createMany({
      data: [{ action: 'prune-old-audit', createdAt: new Date(Date.now() - 400 * day) }, { action: 'prune-new-audit' }],
    });

    const result = await appRef.get(SurveillanceService, { strict: false }).prune();
    assert.ok(result.nonces >= 1 && result.sessions >= 1 && result.audit >= 1);
    assert.equal(await prisma.authNonce.count({ where: { nonce: 'prune-old-nonce' } }), 0);
    assert.equal(await prisma.authNonce.count({ where: { nonce: 'prune-new-nonce' } }), 1);
    assert.equal(await prisma.memberSession.count({ where: { tokenHash: 'prune-old-session' } }), 0);
    assert.equal(await prisma.memberSession.count({ where: { tokenHash: 'prune-new-session' } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'prune-old-audit' } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { action: 'prune-new-audit' } }), 1);
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
      ...staff.flatMap((s) => [s.email, s.name, s.id, ...(s.walletAddress ? [s.walletAddress] : [])]),
      '999000111', 'noticeProofUrl', 'AppealVote', 'takedown-secret-reason', 'takedown-secret-contact',
      'staffId', '"votes"', 'apiKeyHash', 'passwordHash', 'storagePath', 'capturedById', 'removed_guy',
    ];
    const paths = ['/ratings', '/ratings/lunar_alpha', '/ratings/lunar_alpha/history', '/ratings/lunar_alpha/calls', '/actions', '/under-review', '/stats', '/scale', '/methodology', '/research', '/research/lunar-alpha-new-rating', '/badge/lunar_alpha.svg'];
    for (const p of paths) {
      const r = await api(p);
      assert.ok(r.status === 200, `${p} → ${r.status}`);
      for (const f of forbidden) assert.ok(!r.text.includes(f), `${p} leaks ${f}`);
    }
  });

  test('the share card data of a published action is public and minimal; drafts are not found; bad ids are refused', async () => {
    const seeded = await prisma.ratingAction.findFirstOrThrow({ where: { influencer: { handle: 'lunar_alpha' }, status: 'published' } });
    const id = `RA-${String(seeded.actionNumber).padStart(4, '0')}`;
    const card = await api(`/actions/${id}`);
    assert.equal(card.status, 200);
    assert.equal(card.json.handle, 'lunar_alpha');
    assert.equal(card.json.rating, 'BBB');
    assert.equal(card.json.band, 'trusted');
    assert.deepEqual(Object.keys(card.json).sort(), ['actionId', 'band', 'displayName', 'handle', 'outlook', 'previousRating', 'publishedAt', 'rating', 'type']);

    const draft = await prisma.ratingAction.findFirstOrThrow({ where: { status: 'draft' } });
    assert.equal((await api(`/actions/RA-${String(draft.actionNumber).padStart(4, '0')}`)).status, 404, 'a draft has no public card');
    assert.equal((await api('/actions/RA-9999999')).status, 404);
    assert.equal((await api('/actions/not-an-id')).status, 400);
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
