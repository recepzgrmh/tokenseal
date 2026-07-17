import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BUDGET,
  wordCount,
  withinBudget,
  checkToolOutput,
} from '../../src/context/budget.ts';

test('DEFAULT_BUDGET has the expected shape and values', () => {
  assert.equal(DEFAULT_BUDGET.mainContext.explorationSummaryWords, 800);
  assert.equal(DEFAULT_BUDGET.mainContext.testFailureWords, 600);
  assert.equal(DEFAULT_BUDGET.mainContext.reviewFindingsWords, 800);
  assert.equal(DEFAULT_BUDGET.mainContext.receiptWords, 300);
  assert.equal(DEFAULT_BUDGET.subagents.explorerOutputWords, 500);
  assert.equal(DEFAULT_BUDGET.subagents.testAnalyzerOutputWords, 500);
  assert.equal(DEFAULT_BUDGET.subagents.reviewerOutputWords, 1000);
  assert.equal(DEFAULT_BUDGET.tools.inlineOutputCharacters, 12_000);
  assert.equal(DEFAULT_BUDGET.tools.failureContextCharacters, 20_000);
  assert.equal(DEFAULT_BUDGET.tools.fullOutputStorage, true);
});

test('wordCount counts whitespace-delimited words', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('   \n\t '), 0);
  assert.equal(wordCount('one'), 1);
  assert.equal(wordCount('one two   three\nfour'), 4);
});

test('withinBudget applies word logic', () => {
  assert.equal(withinBudget('a b c', 3), true);
  assert.equal(withinBudget('a b c', 2), false);
  assert.equal(withinBudget('', 0), true);
});

test('checkToolOutput flags over-limit output', () => {
  const under = checkToolOutput(100);
  assert.equal(under.overBudget, false);
  assert.equal(under.limit, 12_000);

  const over = checkToolOutput(50_000);
  assert.equal(over.overBudget, true);
  assert.equal(over.limit, 12_000);
});

test('checkToolOutput respects a custom budget', () => {
  const custom = {
    ...DEFAULT_BUDGET,
    tools: { ...DEFAULT_BUDGET.tools, inlineOutputCharacters: 10 },
  };
  const r = checkToolOutput(20, custom);
  assert.equal(r.overBudget, true);
  assert.equal(r.limit, 10);
});
