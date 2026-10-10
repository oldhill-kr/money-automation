import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyTotals, averageMonthly, splitInstallments } from '../src/ledger.js';
import { makeDemoTransactions } from './fixtures.js';

const sum = (a) => a.reduce((s, x) => s + x, 0);

test('월별 합계: 카드대금·저축·입금 제외', () => {
  const txs = makeDemoTransactions();
  const m = monthlyTotals(txs);
  assert.deepEqual(m.map((x) => x.month), ['2026-07', '2026-08', '2026-09']);
  assert.equal(m[0].byCategory['의료'], 80000);
  for (const row of m) {
    const expected = sum(txs.filter((t) => t.kind === 'expense' && t.date.startsWith(row.month)).map((t) => t.amount));
    assert.equal(row.total, expected);
  }
});

test('취소 거래는 제외', () => {
  const txs = [
    { date: '2026-07-01', amount: 1000, kind: 'expense', category: '식비', canceled: false },
    { date: '2026-07-02', amount: 5000, kind: 'expense', category: '식비', canceled: true },
  ];
  assert.equal(monthlyTotals(txs)[0].total, 1000);
});

test('averageMonthly', () => {
  const txs = makeDemoTransactions();
  const m = monthlyTotals(txs);
  assert.equal(averageMonthly(txs), Math.round(sum(m.map((x) => x.total)) / 3));
});

test('할부 나누기: 총액 보존, 8월 쇼핑이 860,000 줄고 9·10월에 430,000씩', () => {
  const txs = makeDemoTransactions();
  const before = monthlyTotals(txs);
  const after = monthlyTotals(splitInstallments(txs));
  const shop = (m, month) => m.find((x) => x.month === month)?.byCategory['쇼핑'] ?? 0;
  assert.equal(shop(after, '2026-08'), shop(before, '2026-08') - 860000);
  assert.equal(shop(after, '2026-09'), shop(before, '2026-09') + 430000);
  assert.equal(shop(after, '2026-10'), 430000);
  assert.equal(sum(after.map((x) => x.total)), sum(before.map((x) => x.total)));
});

test('할부 나머지는 첫 달에', () => {
  const out = splitInstallments([{ date: '2026-01-31', merchant: 'x', amount: 1000001, kind: 'expense', category: '쇼핑', canceled: false, installmentMonths: 3 }]);
  assert.deepEqual(out.map((t) => t.amount), [333335, 333333, 333333]);
  assert.deepEqual(out.map((t) => t.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
});
