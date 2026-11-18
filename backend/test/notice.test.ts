import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { isXStatusUrl, publishBlocker } from '../src/committee/notice';

const now = new Date('2026-11-20T12:00:00Z');
const hours = (h: number) => new Date(now.getTime() + h * 3600_000);

test('publish gate: publish before 48 hours is rejected, after is allowed (claimed account)', () => {
  const base = { status: 'notice', noticeChannel: 'profile' as const, noticeProofUrl: null };
  assert.match(publishBlocker({ ...base, publishAfter: hours(47) }, now)!, /until/);
  assert.equal(publishBlocker({ ...base, publishAfter: hours(0) }, now), null);
  assert.equal(publishBlocker({ ...base, publishAfter: hours(-1) }, now), null);
});

test('publish gate: an unclaimed account needs proof of the X mention first', () => {
  const base = { status: 'notice', noticeChannel: 'x_mention' as const, publishAfter: null };
  assert.match(publishBlocker({ ...base, noticeProofUrl: null }, now)!, /record the X mention/);
  // Proof recorded but the clock has not run out yet
  assert.match(publishBlocker({ ...base, noticeProofUrl: 'https://x.com/a/status/1', publishAfter: hours(10) }, now)!, /until/);
  assert.equal(publishBlocker({ ...base, noticeProofUrl: 'https://x.com/a/status/1', publishAfter: hours(-1) }, now), null);
});

test('publish gate: only actions in the notice period can be published', () => {
  for (const status of ['draft', 'committee', 'published', 'superseded']) {
    assert.match(publishBlocker({ status, noticeChannel: 'profile', noticeProofUrl: null, publishAfter: hours(-100) }, now)!, /notice period/);
  }
});

test('pre-launch mode: publishing skips the proof and the waiting time, but still needs the notice stage', () => {
  const unclaimed = { status: 'notice', noticeChannel: 'x_mention' as const, noticeProofUrl: null, publishAfter: null };
  assert.match(publishBlocker(unclaimed, now)!, /record the X mention/);
  assert.equal(publishBlocker(unclaimed, now, true), null);
  assert.equal(publishBlocker({ ...unclaimed, noticeChannel: 'profile', publishAfter: hours(40) }, now, true), null);
  // A draft or an already published action is never publishable, even in pre-launch mode
  for (const status of ['draft', 'committee', 'published', 'superseded']) {
    assert.match(publishBlocker({ ...unclaimed, status }, now, true)!, /notice period/);
  }
});

test('notice proof: accepts public X post URLs only', () => {
  assert.ok(isXStatusUrl('https://x.com/FidesRating/status/1234567890'));
  assert.ok(isXStatusUrl('https://twitter.com/FidesRating/status/1234567890'));
  for (const bad of ['http://x.com/a/status/1', 'https://x.com/a', 'https://evil.com/a/status/1', 'https://x.com.evil.com/a/status/1', 'not a url', 'https://x.com/a/status/abc']) {
    assert.equal(isXStatusUrl(bad), false, bad);
  }
});
