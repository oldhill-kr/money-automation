import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, learn, merchantKey } from '../src/classifier.js';

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

test('휴게소·이용료·관공서·아울렛 규칙', () => {
  assert.equal(c('덕평휴게소').category, '여행');
  assert.equal(c('바로알람서비스').category, '구독');
  assert.equal(c('9월 이용료').category, '구독');
  assert.equal(c('부산기장군').category, '주거·공과금');
  assert.equal(c('서울강남구청').category, '주거·공과금');
  assert.equal(c('롯데아울렛 김포').category, '쇼핑');
  assert.equal(c('한우리주유소').category, '교통');
  // 오탐 방지
  assert.equal(c('대구탕').category, null);
  assert.equal(c('서울 맛집').category, null);
});

test('merchantKey: 지점명을 떼어 같은 가맹점으로 묶는다', () => {
  assert.equal(merchantKey('스타벅스 강남점'), merchantKey('스타벅스 역삼점'));
  assert.equal(merchantKey('(주)쿠팡'), '쿠팡');
  assert.equal(merchantKey('GS25 서초본점'), 'gs25');
  const next = learn({ categories: {} }, '오렌지마트 강남점', '식비');
  assert.equal(classify({ merchant: '오렌지마트 역삼점', direction: 'out' }, next).category, '식비');
});

test('키워드 규칙은 가맹점별 규칙 다음, 기본 키워드 앞에 맞는다', () => {
  const rules = { categories: { 'sk주유소': '쇼핑' }, keywords: { 주유소: '교통', 알파: '교육' } };
  const r = (m) => classify({ merchant: m, direction: 'out' }, rules).category;
  assert.equal(r('SK주유소'), '쇼핑');
  assert.equal(r('한우리주유소'), '교통');
  assert.equal(r('알파마트'), '교육');
});
