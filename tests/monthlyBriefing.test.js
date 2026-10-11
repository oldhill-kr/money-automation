import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyBriefing, briefingMonths } from '../src/monthlyBriefing.js';

const tx = (date, merchant, amount, category, extra = {}) =>
  ({ date, merchant, amount, category, account: '삼성카드', kind: 'expense', canceled: false, ...extra });

const data = [
  tx('2026-08-03', '스타벅스', 5000, '카페'),
  tx('2026-08-10', '이마트', 100000, '식비'),
  tx('2026-08-15', '넷플릭스', 17000, '구독'),
  tx('2026-09-03', '스타벅스', 8000, '카페'),
  tx('2026-09-04', '이마트', 150000, '식비'),
  tx('2026-09-15', '넷플릭스', 17000, '구독'),
  tx('2026-09-20', '새로운가게', 40000, null),
  tx('2026-09-21', '이마트', -20000, '식비'),
  tx('2026-09-25', '카드대금', 500000, null, { kind: 'cardPayment' }),
];

test('월 목록은 지출이 있는 달만, 오름차순', () => {
  assert.deepEqual(briefingMonths(data), ['2026-08', '2026-09']);
});

test('총액·전월 대비: 취소(마이너스)는 차감하고 카드대금은 제외', () => {
  const b = monthlyBriefing(data, '2026-09');
  assert.equal(b.total, 8000 + 150000 + 17000 + 40000 - 20000);
  assert.equal(b.prevTotal, 122000);
  assert.equal(b.diff, b.total - 122000);
  assert.equal(b.prevMonth, '2026-08');
  assert.equal(b.refunds.count, 1);
  assert.equal(b.refunds.amount, 20000);
});

test('카테고리 증감과 가장 큰 카테고리', () => {
  const b = monthlyBriefing(data, '2026-09');
  const food = b.categories.find((c) => c.category === '식비');
  assert.equal(food.value, 130000);
  assert.equal(food.prev, 100000);
  assert.equal(food.delta, 30000);
  assert.equal(b.categories[0].category, '식비');
  assert.ok(b.insights.some((s) => s.includes('식비')));
});

test('분류 안 된 지출·이번 달 처음 나온 가맹점·고정비', () => {
  const b = monthlyBriefing(data, '2026-09');
  assert.equal(b.unclassified.count, 1);
  assert.equal(b.unclassified.amount, 40000);
  assert.ok(b.newMerchants.some((m) => m.name === '새로운가게'));
  assert.equal(b.fixed, 17000);
});

test('첫 달은 비교 대상이 없다', () => {
  const b = monthlyBriefing(data, '2026-08');
  assert.equal(b.prevTotal, null);
  assert.equal(b.diff, null);
  assert.equal(b.newMerchants.length, 0);
  assert.ok(b.insights[0].includes('비교할 이전 달'));
});

test('거래 없는 달도 오류 없이 빈 브리핑', () => {
  const b = monthlyBriefing(data, '2026-12');
  assert.equal(b.total, 0);
  assert.deepEqual(b.insights, ['이 달에는 지출 거래가 없습니다.']);
});
