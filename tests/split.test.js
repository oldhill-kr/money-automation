import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlySalary, splitPlan } from '../src/accountSplit.js';
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

test('생활비 절감 %와 비상금 개월 수를 바꿀 수 있다', () => {
  const base = { salary: 3100000, fixedCosts: 900000, avgLiving: 1700000, leakSavings: 0, emergencyNow: 0 };
  const p = splitPlan({ ...base, cutRate: 0.2, emergencyMonths: 6 });
  assert.equal(p.living, 1360000);
  assert.equal(p.emergencyGoal, (900000 + 1360000) * 6);
  assert.equal(splitPlan(base).living, 1530000); // 기본값은 10%, 3개월
});
