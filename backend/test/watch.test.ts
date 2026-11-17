import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeWatch, watchStart } from '../src/rating/watch';

const now = new Date('2026-12-01T00:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000);

test('rating watch: shown for under 90 days, hidden from day 90', () => {
  assert.equal(activeWatch({ watch: 'watch_negative', watchSetAt: daysAgo(89) }, now), 'watch_negative');
  assert.equal(activeWatch({ watch: 'watch_negative', watchSetAt: daysAgo(90) }, now), null);
  assert.equal(activeWatch({ watch: 'watch_negative', watchSetAt: daysAgo(200) }, now), null);
});

test('rating watch: no watch, or a watch without a start time, is never shown', () => {
  assert.equal(activeWatch({ watch: null, watchSetAt: null }, now), null);
  assert.equal(activeWatch({ watch: 'watch_positive', watchSetAt: null }, now), null);
});

test('rating watch: a new watch starts now, a running one keeps its start, an ended one cannot be set again', () => {
  assert.equal(watchStart({ watch: null, watchSetAt: null }, now)!.getTime(), now.getTime());
  const start = daysAgo(30);
  assert.equal(watchStart({ watch: 'watch_evolving', watchSetAt: start }, now)!.getTime(), start.getTime());
  assert.equal(watchStart({ watch: 'watch_evolving', watchSetAt: daysAgo(91) }, now), null);
});
