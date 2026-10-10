import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRecurring, annualCost, savings, habitSpend, monthsCovered } from '../src/leaks.js';
import { makeDemoTransactions } from './fixtures.js';

const demo = makeDemoTransactions();
const by = (items, name) => items.find((i) => i.merchant === name);

test('annualCost = ×12', () => assert.equal(annualCost(9900), 118800));

test('데모: 해지 후보 5개의 합계가 월 84,850원 / 연 1,018,200원', () => {
  const items = findRecurring(demo);
  const cancelled = new Set(['Body P 피트니스', 'PhotoLab', '멜론', 'Google One', '벨소리서비스']);
  assert.deepEqual(savings(items, cancelled), { monthly: 84850, yearly: 1018200 });
  assert.deepEqual(savings(items, new Set()), { monthly: 0, yearly: 0 });
  assert.deepEqual(savings(items, new Set(['멜론'])), { monthly: 11900, yearly: 142800 });
});

test('신호: 갑작스런 시작 / 가격 인상 / 중복 / 소액', () => {
  const items = findRecurring(demo);
  assert.ok(by(items, 'PhotoLab').signals.includes('newlyStarted'));
  assert.equal(by(items, 'PhotoLab').months, 2);
  assert.ok(by(items, '멜론').signals.includes('priceUp'));
  assert.ok(by(items, 'Google One').signals.includes('duplicate'));
  assert.ok(by(items, 'iCloud 저장공간').signals.includes('duplicate'));
  assert.ok(by(items, '벨소리서비스').signals.includes('small'));
  assert.equal(by(items, 'Body P 피트니스').months, 3);
  assert.equal(by(items, 'Netflix').signals.length, 0);
});

test('회귀: 할부·병원·쇼핑·습관 지출은 정기결제가 아니다', () => {
  const items = findRecurring(demo);
  for (const name of ['하이마트', '서울내과', '온누리약국', '쿠팡', '배달의민족', '스타벅스']) {
    assert.equal(by(items, name), undefined, name);
  }
  assert.equal(by(items, 'Claude subscription').monthlyAmount, 29000);
  assert.equal(by(items, 'Claude subscription').signals.includes('priceUp'), false);
});

test('회귀: 매달 찍히는 할부는 정기결제로 보지 않는다', () => {
  const rows = ['07', '08', '09'].map((m) => ({
    date: `2026-${m}-10`, merchant: '삼성전자할부', amount: 430000, kind: 'expense', category: '구독', canceled: false, installmentMonths: 3,
  }));
  assert.deepEqual(findRecurring(rows), []);
});

test('데이터가 1개월뿐이면 빈 결과 (오탐 없음)', () => {
  const one = demo.filter((t) => t.date.startsWith('2026-07'));
  assert.equal(monthsCovered(one), 1);
  assert.deepEqual(findRecurring(one), []);
  assert.equal(monthsCovered(demo), 3);
});

test('습관 지출: 배달 월 13회', () => {
  assert.deepEqual(habitSpend(demo, '배달'), { countPerMonth: 13, yearly: 13 * 22300 * 12 });
});
