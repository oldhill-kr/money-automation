import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortRows, nextSort, DEFAULT_SORT } from '../src/sortRows.js';

const t = (date, merchant, amount, o = {}) => ({ date, merchant, amount, category: '식비', account: 'A', ...o });
const rows = [t('2026-09-03', '나', 5000), t('2026-09-10', '가', 32000, { memo: '선물' }), t('2026-09-05', '다', 18000, { account: 'B', category: null })];

test('기본은 날짜 내림차순', () => {
  assert.deepEqual(sortRows(rows).map((r) => r.merchant), ['가', '다', '나']);
});

test('금액 오름차순/내림차순', () => {
  assert.deepEqual(sortRows(rows, { key: 'amount', dir: 'asc' }).map((r) => r.amount), [5000, 18000, 32000]);
  assert.deepEqual(sortRows(rows, { key: 'amount', dir: 'desc' }).map((r) => r.amount), [32000, 18000, 5000]);
});

test('가맹점은 가나다순', () => {
  assert.deepEqual(sortRows(rows, { key: 'merchant', dir: 'asc' }).map((r) => r.merchant), ['가', '나', '다']);
});

test('메모가 없는 거래는 방향과 관계없이 아래로', () => {
  assert.equal(sortRows(rows, { key: 'memo', dir: 'asc' })[0].memo, '선물');
  assert.equal(sortRows(rows, { key: 'memo', dir: 'desc' })[0].memo, '선물');
});

test('같은 값이면 날짜 최신순으로 이어서 정렬', () => {
  const r = sortRows([t('2026-09-01', 'x', 1), t('2026-09-09', 'y', 1)], { key: 'amount', dir: 'asc' });
  assert.deepEqual(r.map((x) => x.merchant), ['y', 'x']);
});

test('같은 열을 누르면 방향이 바뀌고 다른 열은 오름차순부터', () => {
  assert.deepEqual(nextSort(DEFAULT_SORT, 'date'), { key: 'date', dir: 'asc' });
  assert.deepEqual(nextSort({ key: 'date', dir: 'asc' }, 'date'), { key: 'date', dir: 'desc' });
  assert.deepEqual(nextSort(DEFAULT_SORT, 'amount'), { key: 'amount', dir: 'asc' });
});
