// 데모 엑셀 파일 → 파싱 → 분류 → 병합 → 계산까지, 화면을 빼고 실제 업로드와 같은 경로를 통과시킨다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { parseRows } from '../src/parser.js';
import { classify } from '../src/classifier.js';
import { mergeTransactions } from '../src/store.js';
import { monthlyTotals } from '../src/ledger.js';
import { findRecurring, savings } from '../src/leaks.js';
import { cardReport } from '../src/cardPerformance.js';
import { monthlySalary } from '../src/accountSplit.js';
import { makeDemoTransactions } from './fixtures.js';

execFileSync(process.execPath, ['tests/make-demo-xlsx.js']);
const cjs = path.join(os.tmpdir(), 'money-automation-xlsx.cjs');
const XLSX = createRequire(import.meta.url)(cjs);

function upload(state, account) {
  const wb = XLSX.read(fs.readFileSync(`demo/${account}.xlsx`), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  const r = parseRows(rows, { account, source: `${account}.xlsx` });
  assert.equal(r.needsMapping, false, account);
  assert.deepEqual(r.skipped, [], account);
  const txs = r.transactions.map((t) => {
    const c = classify(t, state.rules);
    const { direction, ...rest } = t;
    return { ...rest, kind: c.kind, category: c.category, ...(c.isSalary !== undefined ? { isSalary: c.isSalary } : {}) };
  });
  const m = mergeTransactions(state.transactions, txs);
  state.transactions = m.merged;
  return m;
}

const state = { transactions: [], rules: { categories: {} } };
const results = ['혼잡카드', '체크카드', '국민은행'].map((a) => upload(state, a));
const demo = makeDemoTransactions();

test('엑셀 3개를 읽으면 원본 가상 데이터와 같은 건수·월별 지출이 나온다', () => {
  assert.equal(state.transactions.length, demo.length);
  const month = (txs) => monthlyTotals(txs).map((r) => [r.month, r.total]);
  assert.deepEqual(month(state.transactions), month(demo));
});

test('분류기가 종류(지출/카드대금/저축/입금)와 월급을 정확히 구분한다', () => {
  const kinds = (txs) => txs.map((t) => t.kind).sort().join();
  assert.equal(kinds(state.transactions), kinds(demo));
  assert.equal(monthlySalary(state.transactions), 3100000);
});

test('할부개월 열이 읽힌다', () => {
  const t = state.transactions.find((x) => x.merchant === '하이마트');
  assert.equal(t.installmentMonths, 3);
});

test('엑셀에서 읽은 데이터로도 새는 돈 합계가 월 84,850원', () => {
  const items = findRecurring(state.transactions);
  const s = savings(items, new Set(['Body P 피트니스', 'PhotoLab', '멜론', 'Google One', '벨소리서비스']));
  assert.deepEqual(s, { monthly: 84850, yearly: 1018200 });
});

test('엑셀에서 읽은 데이터로도 놓친 카드 혜택이 8월 13,360원', () => {
  const rule = { name: 'x', minPrevMonthSpend: 300000, benefits: { 카페: 0.1, 배달: 0.05, 교통: 0.1 }, accounts: ['혼잡카드'] };
  assert.equal(cardReport(state.transactions, rule, '2026-08').missedBenefit, 13360);
});

test('같은 파일을 다시 올려도 거래가 늘지 않는다', () => {
  const before = state.transactions.length;
  const again = upload(state, '혼잡카드');
  assert.equal(again.added, 0);
  assert.equal(state.transactions.length, before);
  assert.ok(results.every((r) => r.duplicates === 0));
});
