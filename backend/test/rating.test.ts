import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assertMethodology } from '../src/rating/methodology';
import {
  actionType, allowedVotes, band, committeeOutlook, committeeRating, computeScorecard, notch, scoreToRating, suggestOutlook,
} from '../src/rating/rating.engine';
import { lunarAlphaFixture } from '../src/rating/demo-fixture';

test('methodology is consistent', () => assert.doesNotThrow(assertMethodology));

test('scale mapping and bands', () => {
  assert.equal(scoreToRating(90), 'AAA');
  assert.equal(scoreToRating(66), 'BBB+');
  assert.equal(scoreToRating(60), 'BBB-');
  assert.equal(scoreToRating(59), 'BB+');
  assert.equal(scoreToRating(11), 'C');
  assert.equal(band('BBB-'), 'trusted');
  assert.equal(band('BB+'), 'speculative');
  assert.equal(band('D'), 'default');
  assert.equal(notch('D'), 21);
});

test('@lunar_alpha example from the brief: 56 / 50 / 80 / 94 → 66 → BBB+', () => {
  const r = computeScorecard(lunarAlphaFixture());
  assert.deepEqual(r.pillars, { accuracy: 56, disclosure: 50, walletAlignment: 80, conduct: 94 });
  assert.equal(r.totalScore, 66);
  assert.equal(r.scorecardRating, 'BBB+');
  assert.equal(r.measurableCalls, 60);
  assert.equal(r.inputs.hitRate, 0.55);
  assert.equal(r.inputs.medianExcess30d, 0.08);
});

test('default on trust: undisclosed paid call + dump from a declared wallet → D', () => {
  const f = lunarAlphaFixture();
  f.walletChecks.push({ callId: 'c3', heldAtCall: true, soldPct7d: 0.9 });
  const r = computeScorecard(f);
  assert.equal(r.isDefault, true);
  assert.equal(r.scorecardRating, 'D');
  assert.deepEqual(allowedVotes('D', r.appliedCaps), ['D']);
});

test('rug cap: rug within 12 months caps at CCC+', () => {
  const f = lunarAlphaFixture();
  f.calls.at(40)!.rugConfirmedAt = new Date(Date.now() - 30 * 86400_000);
  const r = computeScorecard(f);
  assert.ok(r.appliedCaps.includes('rug_cap'));
  assert.equal(r.scorecardRating, 'CCC+');
  assert.deepEqual(allowedVotes('CCC+', r.appliedCaps), ['CCC+', 'CCC']);
});

test('no verified wallet: alignment 50 and capped at A', () => {
  const f = lunarAlphaFixture();
  f.verifiedWalletCount = 0;
  f.walletChecks = [];
  f.promotions = [];
  f.calls.forEach((c, i) => { if (i < 60) c.price30d = 1.3; c.deleted = false; });
  const r = computeScorecard(f);
  assert.equal(r.pillars!.walletAlignment, 50);
  assert.equal(r.indicatedRating, 'AA+'); // 92/100/50/100 → 85
  assert.equal(r.scorecardRating, 'A');
  assert.ok(r.appliedCaps.includes('no_wallet_cap'));
});

test('fewer than 15 measurable calls → NR, and 15 is enough to be rated', () => {
  const f = lunarAlphaFixture();
  f.calls = f.calls.slice(0, 14);
  const r = computeScorecard(f);
  assert.equal(r.notRated, true);
  assert.equal(r.scorecardRating, 'NR');

  const enough = lunarAlphaFixture();
  enough.calls = enough.calls.slice(0, 15);
  assert.equal(computeScorecard(enough).notRated, false);
});

test('committee: ±1 notch, median, conservative ties, outlook', () => {
  assert.deepEqual(allowedVotes('BBB+', []), ['A-', 'BBB+', 'BBB']);
  assert.equal(committeeRating(['BBB', 'BBB', 'BBB+']), 'BBB');
  assert.equal(committeeRating(['A-', 'BBB+', 'BBB', 'BBB+']), 'BBB+');
  assert.equal(committeeRating(['A-', 'BBB']), 'BBB');
  assert.equal(committeeOutlook(['negative', 'stable', 'negative']), 'negative');
  assert.equal(committeeOutlook(['positive', 'stable']), 'stable');
  const p = { accuracy: 60, disclosure: 60, walletAlignment: 60, conduct: 60 };
  assert.equal(suggestOutlook({ totalScore: 66, pillars: p }, { totalScore: 60, pillars: p }), 'positive');
  assert.equal(suggestOutlook({ totalScore: 60, pillars: { ...p, accuracy: 75, disclosure: 45 } }, { totalScore: 60, pillars: p }), 'developing');
  assert.equal(actionType(null, 'BBB'), 'new');
  assert.equal(actionType('A', 'BBB'), 'downgrade');
  assert.equal(actionType('BBB', 'A'), 'upgrade');
  assert.equal(actionType('BBB', 'BBB'), 'affirm');
});
