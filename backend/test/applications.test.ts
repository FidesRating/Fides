import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ApplicationsService } from '../src/applications/applications';

const member: any = { id: 'm1', walletAddress: '0xabc' };
const staff: any = { id: 's1' };
const GOOD = ['https://x.com/a/status/1', 'https://x.com/a/status/2', 'https://x.com/a/status/3'];

/** In-memory stand-in for the few Prisma calls the service makes. */
function fake(opts: { draft?: any; submitted?: any; covered?: boolean; manages?: boolean } = {}) {
  const calls: { updated: any[]; created: any[]; deleted: any[] } = { updated: [], created: [], deleted: [] };
  const prisma: any = {
    application: {
      findFirst: async () => opts.draft ?? null,
      findUnique: async () => opts.submitted ?? null,
      update: async (a: any) => { calls.updated.push(a); return a; },
      deleteMany: async (a: any) => { calls.deleted.push(a); return { count: 1 }; },
    },
    socialAccount: { findUnique: async (a: any) => (a.where.claimedById ? (opts.manages ? { handle: 'other' } : null) : opts.covered ? { id: 'x' } : null) },
    influencer: { findUnique: async () => null, create: (a: any) => { calls.created.push(a); return a; } },
    $transaction: async (ops: any[]) => ops,
  };
  return { svc: new ApplicationsService(prisma), calls };
}

const draft = { id: 'a1', memberId: 'm1', handle: 'alpha', displayName: 'Alpha', avatarUrl: null, followers: 20000, status: 'draft' };

test('application: submit needs the consent checkbox', async () => {
  await assert.rejects(fake({ draft }).svc.submit(member, { evidenceUrls: GOOD, consent: false }), BadRequestException);
});

test('application: evidence must be public X post links, all different', async () => {
  const { svc } = fake({ draft });
  await assert.rejects(svc.submit(member, { evidenceUrls: ['https://example.com/a', GOOD[1], GOOD[2]], consent: true }), BadRequestException);
  await assert.rejects(svc.submit(member, { evidenceUrls: [GOOD[0], GOOD[0], GOOD[2]], consent: true }), BadRequestException);
});

test('application: submit needs a draft from an X login', async () => {
  await assert.rejects(fake().svc.submit(member, { evidenceUrls: GOOD, consent: true }), BadRequestException);
});

test('application: submit is refused when the account was added by staff meanwhile', async () => {
  await assert.rejects(fake({ draft, covered: true }).svc.submit(member, { evidenceUrls: GOOD, consent: true }), ConflictException);
});

test('application: a valid submit moves the draft to submitted', async () => {
  const { svc, calls } = fake({ draft });
  const r: any = await svc.submit(member, { evidenceUrls: GOOD, consent: true });
  assert.equal(r.status, 'submitted');
  assert.equal(calls.updated[0].data.status, 'submitted');
});

test('application: a rejection needs a note, and only submitted applications can be reviewed', async () => {
  const submitted = { ...draft, status: 'submitted' };
  await assert.rejects(fake({ submitted }).svc.review('a1', { status: 'rejected' }, staff), BadRequestException);
  await assert.rejects(fake({ submitted: draft }).svc.review('a1', { status: 'accepted' }, staff), BadRequestException);
});

test('application: accepting creates a covered account that the applicant already claimed', async () => {
  const { svc, calls } = fake({ submitted: { ...draft, status: 'submitted' } });
  const r: any = await svc.review('a1', { status: 'accepted' }, staff);
  assert.equal(r.status, 'accepted');
  const data = calls.created[0].data;
  assert.equal(data.participating, true);
  assert.equal(data.accounts.create.claimedById, 'm1');
  assert.equal(data.accounts.create.followers, 20000);
});

test('application: accepting is refused when the applicant already manages another account', async () => {
  await assert.rejects(fake({ submitted: { ...draft, status: 'submitted' }, manages: true }).svc.review('a1', { status: 'accepted' }, staff), ConflictException);
});

test('application: signing out of X drops only the unsent draft of that member', async () => {
  const { svc, calls } = fake();
  const r = await svc.discardDraft(member);
  assert.equal(r.discarded, 1);
  assert.deepEqual(calls.deleted[0].where, { memberId: 'm1', status: 'draft' });
});
