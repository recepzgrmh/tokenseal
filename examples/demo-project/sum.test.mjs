import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum.mjs';

test('sums a list', () => {
  assert.equal(sum([1, 2, 3]), 6);
});

test('sums an empty list to 0', () => {
  // This fails until the empty-array guard is added — the demo bug.
  assert.equal(sum([]), 0);
});
