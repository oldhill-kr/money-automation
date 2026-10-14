import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyCashback, cashbackTotals, hasCashback } from '../src/cashback.js';
import { migrateCards, emptyCard } from '../src/cardPerformance.js';
import { classify, isTransfer } from '../src/classifier.js';
import { mergeTransactions, threeWayMerge } from '../src/store.js';
import { parseRows } from '../src/parser.js';
import { renameGroup, uploadGroups } from '../src/ui/filesCard.js';

const ex = (date, merchant, amount, category, o = {}) =>
  ({ date, merchant, amount, category, account: 'A', source: 'a.csv', kind: 'expense', canceled: false, ...o });

test('동백전 파일: 적립·사용 캐시백 열을 읽고 취소는 회수로 계산', () => {
  const rows = [
    ['거래일련번호', '거래구분', '거래일', '거래시간', '거래금액', '사용캐시백', '사용지원금', '적립캐시백', '본인부담액', '가맹점명'],
    ['0101', '결제', '2026.01.01', '17:50', '59,900', '-', '-', '5,990', '59,900', '땡겨요'],
    ['0102', '결제취소', '2026.01.01', '18:22', '59,900', '5,990', '-', '-', '59,900', '땡겨요'],
    ['0103', '결제', '2026.01.02', '14:01', '15,000', '-', '2,000', '1,500', '13,000', '수영김밥'],
  ];
  const r = parseRows(rows, { account: '동백전', source: 'd.xlsx' });
  assert.deepEqual(r.transactions.map((t) => [t.cashback, t.cashbackUsed, t.subsidyUsed]),
    [[5990, 0, 0], [-5990, 0, 0], [1500, 0, 2000]]);
  const txs = r.transactions.map((t) => ({ ...t, kind: 'expense' }));
  assert.equal(hasCashback(txs), true);
  const m = monthlyCashback(txs);
  assert.equal(m.length, 1);
  assert.equal(m[0].earned, 1500);
  assert.equal(m[0].subsidy, 2000);
  assert.equal(cashbackTotals(m).earned, 1500);
  assert.equal(hasCashback([ex('2026-01-01', 'a', 1000, '식비')]), false);
});

test('카드 목록 옮기기: 예전 cardRule 한 장 → cards', () => {
  assert.deepEqual(migrateCards({}), []);
  assert.deepEqual(migrateCards({ cardRule: { name: '', accounts: [] } }), []);
  const one = migrateCards({ cardRule: { name: '혼잡카드', minPrevMonthSpend: 300000, benefits: { 카페: 0.1 }, accounts: ['혼잡'] } });
  assert.equal(one.length, 1);
  assert.equal(one[0].name, '혼잡카드');
  assert.deepEqual(one[0].accounts, ['혼잡']);
  assert.deepEqual(migrateCards({ cards: [], cardRule: { name: 'x', accounts: ['y'] } }), []);
  assert.deepEqual(emptyCard().accounts, []);
});

test('충전·본인 이체는 transfer, 교통카드 충전·일반 송금은 지출', () => {
  assert.equal(isTransfer('동백전충전'), true);
  assert.equal(isTransfer('토스머니 충전'), true);
  assert.equal(isTransfer('본인 이체'), true);
  assert.equal(isTransfer('티머니 충전'), false);
  assert.equal(isTransfer('김철수'), false);
  assert.equal(classify({ merchant: '동백전충전', direction: 'in' }, {}).kind, 'transfer');
  assert.equal(classify({ merchant: '티머니 충전' }, {}).kind, 'expense');
});

test('그룹 이름을 바꾼 뒤 옛 이름으로 같은 파일을 다시 올려도 늘지 않는다', () => {
  const first = [ex('2026-09-03', '스타벅스', 5000, '카페', { account: '삼성카드', source: 'a.csv' })];
  const renamed = renameGroup(first, uploadGroups(first)[0], '내 삼성');
  assert.equal(renamed[0].account, '내 삼성');
  assert.equal(renamed[0].origAccount, '삼성카드');
  const again = mergeTransactions(renamed, first.map((t) => ({ ...t })));
  assert.equal(again.added, 0);
  assert.equal(again.duplicates, 1);
  const twice = renameGroup(renamed, uploadGroups(renamed)[0], '삼성');
  assert.equal(twice[0].origAccount, '삼성카드');
});

test('3-way 병합: 여기서 지운 거래는 되살아나지 않고, 저쪽에서 올린 거래는 남는다', () => {
  const a = ex('2026-09-01', 'a', 1000, '식비'), b = ex('2026-09-02', 'b', 2000, '식비'), c = ex('2026-09-03', 'c', 3000, '식비');
  const d = ex('2026-09-04', 'd', 4000, '식비'), e = ex('2026-09-05', 'e', 5000, '식비');
  const r = threeWayMerge([a, b, c], [a, c, d], [a, b, c, e]);
  assert.deepEqual(r.merged.map((t) => t.merchant).sort(), ['a', 'c', 'd', 'e']);
  assert.equal(r.added, 1);
});

test('3-way 병합: 이 컴퓨터에서 고친 카테고리·메모를 따른다', () => {
  const a = ex('2026-09-01', 'a', 1000, null), b = ex('2026-09-02', 'b', 2000, '식비');
  const local = [{ ...a, category: '카페', memo: '모임' }, b];
  const remote = [a, b, ex('2026-09-05', 'e', 5000, '식비')];
  const r = threeWayMerge([a, b], local, remote);
  const got = r.merged.find((t) => t.merchant === 'a');
  assert.equal(got.category, '카페');
  assert.equal(got.memo, '모임');
  assert.equal(r.merged.length, 3);
});
