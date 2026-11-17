import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { rejectQuorumReached } from '../src/committee/appeal-quorum';

test('appeal quorum: three distinct non-conflicted members reject an appeal', () => {
  assert.equal(rejectQuorumReached(['a', 'b'], new Set(), 3), false);
  assert.equal(rejectQuorumReached(['a', 'b', 'c'], new Set(), 3), true);
});

test('appeal quorum: conflicted members never count', () => {
  assert.equal(rejectQuorumReached(['a', 'b', 'c'], new Set(['c']), 3), false);
  assert.equal(rejectQuorumReached(['a', 'b', 'c', 'd'], new Set(['c']), 3), true);
});

test('appeal quorum: the same member counts once', () => {
  assert.equal(rejectQuorumReached(['a', 'a', 'a'], new Set(), 3), false);
});
