import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetReport, suggestBudgets } from '../src/budget.js';
import { makeManualTx, MANUAL_SOURCE } from '../src/manual.js';
import { monthlyCashflow, cashflowTotals } from '../src/cashflow.js';

const ex = (date, merchant, amount, category, o = {}) =>
  ({ date, merchant, amount, category, account: 'A', source: 'a.csv', kind: 'expense', canceled: false, ...o });

test('예산: 카테고리별 지출·남은 돈·상태', () => {
  const txs = [ex('2026-10-02', '스벅', 30000, '카페'), ex('2026-10-03', '이마트', 50000, '식비'), ex('2026-10-04', '쿠팡', 20000, '쇼핑')];
  const r = budgetReport(txs, { 카페: 25000, 식비: 100000 }, '2026-10');
  const by = Object.fromEntries(r.rows.map((x) => [x.category, x]));
  assert.equal(by.카페.status, 'over');
  assert.equal(by.카페.remaining, -5000);
  assert.equal(by.식비.status, 'ok');
  assert.equal(by.쇼핑.status, 'none');
  assert.equal(r.totals.budget, 125000);
  assert.equal(r.totals.spentBudgeted, 80000);
  assert.equal(r.totals.spentUnbudgeted, 20000);
  assert.equal(r.totals.overCount, 1);
  assert.equal(r.pace, null);
});

test('예산: 이번 달이면 하루 예산과 월말 예상', () => {
  const txs = [ex('2026-10-02', '이마트', 100000, '식비')];
  const r = budgetReport(txs, { 식비: 310000 }, '2026-10', '2026-10-11');
  assert.equal(r.pace.daysLeft, 21);
  assert.equal(r.pace.perDay, 10000);
  assert.equal(r.pace.projected, Math.round((100000 / 11) * 31));
});

test('예산 제안: 직전 3개월 평균을 만 원 단위로 올림', () => {
  const txs = [ex('2026-07-05', 'a', 30000, '식비'), ex('2026-08-05', 'a', 40000, '식비'), ex('2026-09-05', 'a', 50000, '식비'), ex('2026-10-05', 'a', 1, '식비')];
  assert.deepEqual(suggestBudgets(txs, '2026-10'), { 식비: 40000 });
  assert.deepEqual(suggestBudgets([], '2026-10'), {});
});

test('직접 입력 거래: 지출·수입·오류', () => {
  const r = makeManualTx({ date: '2026-10-14', merchant: ' 시장 ', amount: '12,000', category: '식비', memo: '채소' });
  assert.equal(r.tx.kind, 'expense');
  assert.equal(r.tx.amount, 12000);
  assert.equal(r.tx.account, '현금');
  assert.equal(r.tx.source, MANUAL_SOURCE);
  assert.equal(r.tx.memo, '채소');
  const inc = makeManualTx({ date: '2026.10.14', merchant: '용돈', amount: 50000, type: 'income' });
  assert.equal(inc.tx.kind, 'income');
  assert.equal(inc.tx.isSalary, false);
  assert.match(makeManualTx({ date: 'x', merchant: 'a', amount: 1 }).error, /날짜/);
  assert.match(makeManualTx({ date: '2026-10-14', merchant: '', amount: 1 }).error, /가맹점/);
  assert.match(makeManualTx({ date: '2026-10-14', merchant: 'a', amount: 0 }).error, /금액/);
});

test('월별 수입·지출·저축률(수입 없는 달은 null)', () => {
  const txs = [
    { date: '2026-09-25', merchant: '급여', amount: 3000000, kind: 'income', isSalary: true },
    { date: '2026-09-26', merchant: '용돈', amount: 100000, kind: 'income', isSalary: false },
    ex('2026-09-10', 'a', 1500000, '식비'),
    { date: '2026-09-27', merchant: '적금', amount: 500000, kind: 'saving' },
    { date: '2026-09-28', merchant: '동백전충전', amount: 100000, kind: 'transfer' },
    ex('2026-10-02', 'b', 70000, '식비'),
  ];
  const rows = monthlyCashflow(txs);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].income, 3100000);
  assert.equal(rows[0].salary, 3000000);
  assert.equal(rows[0].expense, 1500000);
  assert.equal(rows[0].saving, 500000);
  assert.equal(rows[0].net, 1600000);
  assert.ok(Math.abs(rows[0].rate - 1600000 / 3100000) < 1e-9);
  assert.equal(rows[1].rate, null);
  const t = cashflowTotals(rows);
  assert.equal(t.months, 1);
  assert.equal(t.net, 1600000);
});
