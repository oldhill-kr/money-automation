import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, learn } from '../src/classifier.js';

const c = (merchant, o = {}) => classify({ merchant, direction: 'out', ...o }, { categories: {} });

test('기본 키워드', () => {
  assert.equal(c('스타벅스 강남점').category, '카페');
  assert.equal(c('배달의민족').category, '배달');
  assert.equal(c('지하철').category, '교통');
  assert.equal(c('Body P 피트니스').category, '문화·여가');
  assert.equal(c('스타벅스').unknown, false);
});

test('카드대금/저축/입금 구분', () => {
  assert.equal(c('카드대금').kind, 'cardPayment');
  assert.equal(c('적금').kind, 'saving');
  const salary = c('급여', { direction: 'in' });
  assert.equal(salary.kind, 'income');
  assert.equal(salary.isSalary, true);
  const dutch = c('홍길동 더치페이', { direction: 'in' });
  assert.equal(dutch.kind, 'income');
  assert.equal(dutch.isSalary, false);
});

test('모르는 가맹점은 unknown, learn 뒤에는 묻지 않는다', () => {
  assert.equal(c('29CM').unknown, true);
  const rules = { categories: {} };
  const next = learn(rules, '29CM', '쇼핑');
  assert.notEqual(next, rules);
  assert.deepEqual(rules.categories, {});
  const r = classify({ merchant: '29CM', direction: 'out' }, next);
  assert.equal(r.category, '쇼핑');
  assert.equal(r.unknown, false);
});

test('회귀: subscription 속 PT 글자 때문에 헬스로 분류되지 않는다', () => {
  assert.equal(c('Claude subscription').category, '구독');
  assert.notEqual(c('Adaptive Shop').category, '문화·여가');
});
