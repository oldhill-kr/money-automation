import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadGroups, removeGroup, renameGroup, followRename } from '../src/ui/filesCard.js';
import { mergeTransactions } from '../src/store.js';

const tx = (date, merchant, amount, account, source, extra = {}) =>
  ({ date, merchant, amount, account, source, kind: 'expense', category: null, ...extra });

test('업로드 묶음: 파일·계좌별 건수, 기간, 지출 합계, 메모 수', () => {
  const txs = [
    tx('2026-09-03', '스타벅스', 5000, '삼성카드', 'a.csv'),
    tx('2026-09-10', '쿠팡', 32000, '삼성카드', 'a.csv', { memo: '선물' }),
    tx('2026-09-05', '배달의민족', 18000, '현대카드', 'b.csv'),
    tx('2026-09-06', '급여', 3000000, '국민은행', 'c.csv', { kind: 'income' }),
  ];
  const g = uploadGroups(txs);
  assert.equal(g.length, 3);
  const a = g.find((x) => x.source === 'a.csv');
  assert.equal(a.count, 2);
  assert.equal(a.spend, 37000);
  assert.equal(a.memos, 1);
  assert.deepEqual([a.from, a.to], ['2026-09-03', '2026-09-10']);
  assert.equal(g.find((x) => x.source === 'c.csv').spend, 0); // 입금은 지출 합계에 넣지 않는다
});

test('파일 삭제는 그 파일·계좌의 거래만 지운다', () => {
  const txs = [
    tx('2026-09-03', '스타벅스', 5000, '삼성카드', 'a.csv'),
    tx('2026-09-05', '배달의민족', 18000, '현대카드', 'b.csv'),
    tx('2026-09-07', '이마트', 9000, '삼성카드', 'b.csv'),
  ];
  const group = uploadGroups(txs).find((x) => x.source === 'b.csv' && x.account === '현대카드');
  const rest = removeGroup(txs, group);
  assert.equal(rest.length, 2);
  assert.ok(rest.every((t) => !(t.source === 'b.csv' && t.account === '현대카드')));
});

test('같은 파일을 다시 올리면 새로 추가되는 거래가 0건이다', () => {
  const existing = [tx('2026-09-03', '스타벅스', 5000, '삼성카드', 'a.csv'), tx('2026-09-10', '쿠팡', 32000, '삼성카드', 'a.csv')];
  const again = existing.map((t) => ({ ...t }));
  const r = mergeTransactions(existing, again);
  assert.equal(r.added, 0);
  assert.equal(r.duplicates, 2);
});

test('출처 정보가 없는 예전 거래도 한 묶음으로 보인다', () => {
  const g = uploadGroups([{ date: '2026-09-03', merchant: 'x', amount: 1, account: '혼잡카드', kind: 'expense' }]);
  assert.equal(g[0].source, '(파일 정보 없음)');
});

test('그룹 수정은 그 파일·계좌의 거래 계좌명만 바꾼다', () => {
  const txs = [
    tx('2026-09-03', '스타벅스', 5000, '삼성카드', 'a.csv', { memo: '회의' }),
    tx('2026-09-05', '배달의민족', 18000, '현대카드', 'b.csv'),
    tx('2026-09-07', '이마트', 9000, '삼성카드', 'b.csv'),
  ];
  const g = uploadGroups(txs).find((x) => x.source === 'a.csv');
  const next = renameGroup(txs, g, '내 삼성');
  assert.deepEqual(next.map((t) => t.account), ['내 삼성', '현대카드', '삼성카드']);
  assert.equal(next[0].memo, '회의');
  assert.equal(next[0].merchant, '스타벅스');
  assert.equal(txs[0].account, '삼성카드'); // 원본은 건드리지 않는다
});

test('카드 규칙의 계좌는 옛 이름 거래가 남지 않을 때만 새 이름을 따라간다', () => {
  const left = [tx('2026-09-07', '이마트', 9000, '삼성카드', 'b.csv')];
  assert.deepEqual(followRename(['삼성카드'], '삼성카드', '내 삼성', left), ['삼성카드']);
  assert.deepEqual(followRename(['삼성카드', '현대카드'], '삼성카드', '내 삼성', []), ['내 삼성', '현대카드']);
  assert.deepEqual(followRename(['현대카드'], '삼성카드', '내 삼성', []), ['현대카드']);
});
