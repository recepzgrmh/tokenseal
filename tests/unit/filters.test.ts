import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterOutput } from '../../src/filters/index.ts';
import {
  classifyKind,
  hasFailureSignal,
  extractFailureRegions,
  isJson,
} from '../../src/filters/detect.ts';

function lines(n: number, prefix = 'line'): string {
  return Array.from({ length: n }, (_, i) => `${prefix} ${i}`).join('\n');
}

test('short output passes through unchanged (masked)', () => {
  const r = filterOutput({ text: 'hello world\nall good' });
  assert.equal(r.strategy, 'passthrough');
  assert.equal(r.filtered, 'hello world\nall good');
  assert.equal(r.recoverable, false);
  assert.equal(r.reductionRatio, 0);
  assert.equal(r.storedPath, undefined);
});

test('full detail mode disables filtering but still masks secrets', () => {
  const big = lines(1000);
  const secret = 'sk-ant-ABCDEFGHIJKLMNOP1234567890';
  const r = filterOutput({
    text: `${big}\nAPI_KEY=${secret}`,
    requestedDetail: 'full',
    command: 'ls -R',
  });
  assert.equal(r.strategy, 'passthrough-full');
  assert.ok(!r.filtered.includes(secret), 'secret must be masked even in full mode');
  assert.ok(r.filtered.includes('line 999'), 'full mode keeps all content');
});

test('failure output ALWAYS retains the error text and is recoverable', () => {
  const stack =
    'Traceback (most recent call last):\n' +
    '  File "app.py", line 42, in <module>\n' +
    '    raise ValueError("boom")\n' +
    'ValueError: boom';
  const noise = lines(300, 'noise');
  const r = filterOutput({
    text: `${noise}\n${stack}\n${lines(300, 'more')}`,
    command: 'python app.py',
    exitCode: 1,
  });
  assert.equal(r.strategy, 'failure-preserve');
  assert.ok(r.recoverable);
  assert.ok(r.filtered.includes('ValueError: boom'), 'error text must survive filtering');
  assert.ok(r.filtered.includes('Traceback'), 'traceback must survive filtering');
  assert.ok(r.storedPath);
  const full = readFileSync(r.storedPath as string, 'utf8');
  assert.ok(full.includes('ValueError: boom'));
});

test('non-zero exit with no failure keyword is still treated as failure', () => {
  const r = filterOutput({ text: 'done quietly', exitCode: 2 });
  assert.equal(r.strategy, 'failure-preserve');
  assert.ok(r.recoverable);
  assert.ok(r.filtered.includes('done quietly'));
});

test('long passing test output is compacted and fully recoverable', () => {
  const body = lines(200, 'ok test');
  const text = `${body}\n120 passing\n0 failing\nDone.`;
  const r = filterOutput({ text, command: 'npm test', exitCode: 0 });
  assert.equal(r.strategy, 'test-passing-compact');
  assert.ok(r.recoverable);
  assert.ok(r.filteredBytes < r.originalBytes);
  assert.ok(r.reductionRatio > 0);
  assert.ok(r.filtered.includes('120 passing'), 'summary counts should be surfaced');
  assert.ok(r.storedPath);
  const full = readFileSync(r.storedPath as string, 'utf8');
  assert.ok(full.includes('ok test 0'));
  assert.ok(full.includes('ok test 199'), 're-reading stored file returns full output');
});

test('large JSON is summarized and recoverable', () => {
  const obj = { name: 'x', items: Array.from({ length: 2000 }, (_, i) => ({ i, v: 'value' })) };
  const text = JSON.stringify(obj);
  assert.ok(text.length > 12_000);
  const r = filterOutput({ text, command: 'cat big.json' });
  assert.equal(r.strategy, 'json-summary');
  assert.ok(r.recoverable);
  assert.ok(r.filtered.includes('topLevelKeys'));
  assert.ok(r.filtered.includes('name'));
  assert.ok(r.filteredBytes < r.originalBytes);
  const full = readFileSync(r.storedPath as string, 'utf8');
  assert.equal(JSON.parse(full).items.length, 2000);
});

test('long generic bash success is truncated in the middle and recoverable', () => {
  const text = lines(600, 'file');
  const r = filterOutput({ text, command: 'find .', exitCode: 0 });
  assert.equal(r.strategy, 'bash-tail');
  assert.ok(r.recoverable);
  assert.ok(r.filtered.includes('file 0'), 'head kept');
  assert.ok(r.filtered.includes('file 599'), 'tail kept');
  assert.ok(r.filtered.includes('elided'));
  assert.ok(r.filteredBytes < r.originalBytes);
});

test('secrets are masked in filtered output', () => {
  const secret = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const r = filterOutput({ text: `token here: ${secret}` });
  assert.ok(!r.filtered.includes(secret));
  assert.ok(r.filtered.includes('redacted'));
});

test('Windows CRLF failure input is handled', () => {
  const text = ['step one', 'step two', 'Error: something broke', 'step three'].join('\r\n');
  const r = filterOutput({ text, exitCode: 1 });
  assert.equal(r.strategy, 'failure-preserve');
  assert.ok(r.filtered.includes('Error: something broke'));
  assert.ok(r.recoverable);
});

test('classifyKind infers test, json, and bash', () => {
  assert.equal(classifyKind({ text: 'x', command: 'npm test' }), 'test');
  assert.equal(classifyKind({ text: 'x', command: 'pytest -q' }), 'test');
  assert.equal(classifyKind({ text: '{"a":1}' }), 'json');
  assert.equal(classifyKind({ text: 'just some logs', command: 'ls' }), 'bash');
});

test('detect helpers behave', () => {
  assert.equal(hasFailureSignal('all Error here'), true);
  assert.equal(hasFailureSignal('everything fine'), false);
  assert.equal(isJson('  [1,2,3] '), true);
  assert.equal(isJson('{not json'), false);
  const regions = extractFailureRegions(
    ['a', 'b', 'c', 'FAILED assertion', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].join('\n'),
    1,
  );
  assert.ok(regions.includes('FAILED assertion'));
  assert.ok(regions.includes('elided'));
});
