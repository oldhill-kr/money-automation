import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoTransactions } from './fixtures.js';

test('demo data: ~330 txs over Jul-Sep, one salary per month', () => {
  const txs = makeDemoTransactions();
  assert.ok(txs.length >= 300 && txs.length <= 360, `got ${txs.length}`);
  for (const m of ['2026-07', '2026-08', '2026-09']) {
    assert.ok(txs.some((t) => t.date.startsWith(m)), m);
  }
  assert.equal(txs.filter((t) => t.isSalary === true).length, 3);
  assert.ok(txs.every((t) => t.amount > 0));
});
