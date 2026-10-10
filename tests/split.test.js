import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlySalary, splitPlan } from '../src/accountSplit.js';
import { weeklyBriefing } from '../src/briefing.js';
import { makeDemoTransactions } from './fixtures.js';

const demo = makeDemoTransactions();

test('회귀: 더치페이 입금은 월급에 섞이지 않는다', () => {
  assert.equal(monthlySalary(demo), 3100000);
});

test('통장 4개: 합계 = 월급, 비상금 목표 729만 원, 10개월', () => {
  const p = splitPlan({ salary: 3100000, fixedCosts: 900000, avgLiving: 1700000, leakSavings: 84850, emergencyNow: 4800000 });
  assert.equal(p.living, 1530000);
  assert.equal(p.livingPerWeek, 353077);
  assert.equal(p.emergency, 268000);
  assert.equal(p.fixed + p.living + p.emergency + p.invest, 3100000);
  assert.equal(p.invest, 402000 + 84850);
  assert.equal(p.emergencyGoal, 7290000);
  assert.equal(p.monthsToGoal, 10);
});

test('적자면 비상금 0, 부족액 표시', () => {
  const p = splitPlan({ salary: 1000000, fixedCosts: 900000, avgLiving: 1700000, leakSavings: 0, emergencyNow: 0 });
  assert.equal(p.emergency, 0);
  assert.equal(p.invest, 0);
  assert.equal(p.deficit, 1430000);
  assert.equal(p.monthsToGoal, null);
});

test('이미 목표를 넘었으면 0개월', () => {
  const p = splitPlan({ salary: 3100000, fixedCosts: 900000, avgLiving: 1700000, leakSavings: 0, emergencyNow: 9000000 });
  assert.equal(p.monthsToGoal, 0);
});

test('주간 브리핑: 9/28(월) 기준 지난주 생활비와 다음 7일 고정 지출', () => {
  const fixedItems = [
    { merchant: '월세', amount: 600000, day: 1 },
    { merchant: 'Body P 피트니스', amount: 59000, day: 5 },
    { merchant: 'Claude subscription', amount: 29000, day: 30 },
  ];
  const b = weeklyBriefing(demo, '2026-09-28', { weeklyBudget: 358000, fixedItems });
  assert.equal(b.lastWeekLiving, 208800);
  assert.equal(b.budgetDiff, 358000 - 208800);
  assert.deepEqual(b.upcomingFixed.map((x) => [x.merchant, x.date]), [['Claude subscription', '2026-09-30'], ['월세', '2026-10-01']]);
  assert.equal(b.upcomingTotal, 629000);
});
