import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardReport } from '../src/cardPerformance.js';
import { makeDemoTransactions } from './fixtures.js';

const demo = makeDemoTransactions();
const rule = { name: '혼잡카드 Plus', minPrevMonthSpend: 300000, benefits: { 카페: 0.1, 배달: 0.05, 교통: 0.1 }, accounts: ['혼잡카드'] };

test('8월: 전월(7월) 실적 충족, 체크카드로 쓴 카페·교통의 혜택을 놓침', () => {
  const r = cardReport(demo, rule, '2026-08');
  assert.equal(r.met, true);
  assert.equal(r.remaining, 0);
  // 카페 12×4,800 = 57,600 → 5,760 / 교통 (20×1,400 + 4×12,000) = 76,000 → 7,600 / 배달은 혼잡카드라 놓친 것 없음
  assert.deepEqual(r.missedByCategory, { 카페: 5760, 교통: 7600 });
  assert.equal(r.missedBenefit, 13360);
});

test('7월: 전월 데이터가 없으면 실적 미달, 혜택 계산 없음', () => {
  const r = cardReport(demo, rule, '2026-07');
  assert.equal(r.met, false);
  assert.equal(r.spent, 0);
  assert.equal(r.remaining, 300000);
  assert.equal(r.missedBenefit, 0);
});

test('기준이 높으면 남은 금액을 알려 준다', () => {
  const r = cardReport(demo, { ...rule, minPrevMonthSpend: 99999999 }, '2026-08');
  assert.equal(r.met, false);
  assert.equal(r.remaining, 99999999 - r.spent);
});

import { parseBenefits, formatBenefits } from '../src/cardPerformance.js';

test('혜택 문자열 변환', () => {
  assert.deepEqual(parseBenefits('카페:10, 배달:5 , 교통:10'), { 카페: 0.1, 배달: 0.05, 교통: 0.1 });
  assert.deepEqual(parseBenefits('엉터리, 카페:abc, :5'), {});
  assert.equal(formatBenefits({ 카페: 0.1, 배달: 0.05 }), '카페:10, 배달:5');
});
