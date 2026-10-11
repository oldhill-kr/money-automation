import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDate, normalizeAmount, detectHeader, parseRows, negateCancel } from '../src/parser.js';

test('normalizeDate: 여러 형식', () => {
  assert.equal(normalizeDate('2026.04.03'), '2026-04-03');
  assert.equal(normalizeDate('2026-04-03 14:22'), '2026-04-03');
  assert.equal(normalizeDate('2026.04.03 14:22:10'), '2026-04-03');
  assert.equal(normalizeDate('26/04/03'), '2026-04-03');
  assert.equal(normalizeDate('20260403'), '2026-04-03');
  assert.equal(normalizeDate(46115), '2026-04-03'); // 엑셀 일련번호
  assert.equal(normalizeDate(new Date(2026, 3, 3)), '2026-04-03');
  assert.equal(normalizeDate('합계'), null);
});

test('normalizeAmount: 여러 형식', () => {
  assert.equal(normalizeAmount('12,000원'), 12000);
  assert.equal(normalizeAmount('-3,500'), -3500);
  assert.equal(normalizeAmount('₩1,200'), 1200);
  assert.equal(normalizeAmount(4800), 4800);
  assert.equal(normalizeAmount('abc'), null);
  assert.equal(normalizeAmount(''), null);
});

const card = [
  ['신한카드 이용내역'],
  ['조회기간: 2026.04.01 ~ 2026.06.30'],
  [],
  ['이용일', '가맹점명', '이용금액', '취소여부'],
  ['2026.04.03 14:22', '스타벅스', '4,800원', ''],
  ['2026.04.05', '배달의민족', '22,300원', ''],
  ['2026.04.06', '쿠팡', '25,000원', '취소'],
  ['2026.04.07', 'Apple.com USD', '$10.00', ''],
  ['', '합계', '52,100원', ''],
  ['날짜없음', '이상한행', '1,000원', ''],
];

test('detectHeader: 제목 3줄이 위에 있어도 헤더 행을 찾는다', () => {
  const h = detectHeader(card);
  assert.equal(h.headerRow, 3);
  assert.deepEqual([h.columns.date, h.columns.merchant, h.columns.amount, h.columns.cancel], [0, 1, 2, 3]);
});

test('detectHeader: 못 찾으면 null', () => {
  assert.equal(detectHeader([['a', 'b'], ['1', '2']]), null);
});

test('parseRows: 취소/외화/읽지 못한 행', () => {
  const r = parseRows(card, { account: '신한카드', source: 'a.xlsx' });
  assert.equal(r.needsMapping, false);
  assert.equal(r.transactions.length, 4);
  const [a, , c, d] = r.transactions;
  assert.equal(a.date, '2026-04-03');
  assert.equal(a.merchant, '스타벅스');
  assert.equal(a.amount, 4800);
  assert.equal(a.account, '신한카드');
  assert.equal(c.canceled, false); // 취소는 마이너스 금액으로 원래 결제와 상쇄한다
  assert.ok(c.amount < 0);
  assert.equal(d.estimated, true);
  assert.ok(d.amount > 0);
  // 빈 날짜의 '합계' 행과 '날짜없음' 행은 조용히 버리지 않고 사유를 남긴다
  assert.equal(r.skipped.length, 2);
  assert.ok(r.skipped.every((s) => s.reason && s.row > 0));
});

test('parseRows: 헤더를 못 찾으면 needsMapping', () => {
  const r = parseRows([['a', 'b'], ['1', '2']], { account: 'x', source: 's' });
  assert.equal(r.needsMapping, true);
  assert.deepEqual(r.transactions, []);
});

test('parseRows: 사용자 지정 매핑', () => {
  const rows = [['x', 'y', 'z'], ['2026.05.01', '가게', '1,000']];
  const r = parseRows(rows, { account: 'k', source: 's', mapping: { headerRow: 0, columns: { date: 0, merchant: 1, amount: 2 } } });
  assert.equal(r.transactions[0].amount, 1000);
});

test('parseRows: 은행 입금/출금 열과 12월→1월', () => {
  const rows = [
    ['거래일자', '적요', '출금액', '입금액'],
    ['2026.12.30', '월세', '600,000', ''],
    ['2027.01.02', '급여', '', '3,100,000'],
  ];
  const r = parseRows(rows, { account: '국민은행', source: 'b.xlsx' });
  assert.equal(r.transactions[0].direction, 'out');
  assert.equal(r.transactions[1].direction, 'in');
  assert.equal(r.transactions[1].amount, 3100000);
  assert.equal(r.transactions[1].date, '2027-01-02');
});

test('parseRows: 할부개월 열을 읽는다', () => {
  const rows = [
    ['이용일', '가맹점', '이용금액', '할부개월'],
    ['2026.08.16', '하이마트', '1,290,000원', '3'],
    ['2026.08.17', '스타벅스', '4,800원', '일시불'],
  ];
  const r = parseRows(rows, { account: 'c', source: 's' });
  assert.equal(r.transactions[0].installmentMonths, 3);
  assert.equal(r.transactions[1].installmentMonths, undefined);
});

test("negateCancel: '(취소)' 표기와 마이너스 금액을 상쇄용 음수로 바꾼다", () => {
  const a = negateCancel({ merchant: '엘지유플러스(취소)', amount: 6000000, canceled: false });
  assert.equal(a.merchant, '엘지유플러스');
  assert.equal(a.amount, -6000000);
  assert.equal(a.canceled, false);
  const b = negateCancel({ merchant: '쿠팡', amount: 12000, canceled: true });
  assert.equal(b.amount, -12000);
  const c = negateCancel({ merchant: '쿠팡', amount: 12000, canceled: false });
  assert.equal(c.amount, 12000);
  assert.equal(negateCancel(a).amount, -6000000); // 두 번 적용해도 같다
});

test('동백전 거래내역서: 일련번호 열은 날짜가 아니고, 충전은 제외·결제취소는 상쇄', () => {
  const rows = [
    ['', '부산 동백전 거래내역서'],
    ['', '고객명', '', '김태삼', '', '', '', '생년월일', '910422'],
    ['', '조회기간', '', '2026-01-01 ~ 2026-06-30', '', '', '', '조회구분', '전체'],
    ['', '발급일자', '', '2026-10-11'],
    [],
    ['', '거래일련번호', '거래구분', '거래일', '거래시간', '거래금액', '사용캐시백', '사용지원금', '적립캐시백', '본인부담액', '가맹점명'],
    ['', '010111192203', '충전', '2026.01.01', '17:43:51', '100,000', '-', '-', '-', '100,000', '-'],
    ['', '010111211142', '결제', '2026.01.01', '17:50:10', '59,900', '-', '-', '5,990', '59,900', '땡겨요'],
    ['', '010111309111', '결제취소', '2026.01.01', '18:22:44', '59,900', '5,990', '-', '-', '59,900', '땡겨요'],
    ['', '010213231860', '결제', '2026.01.02', '14:01:32', '15,000', '-', '-', '1,500', '15,000', '수영김밥'],
  ];
  const d = detectHeader(rows);
  assert.equal(d.headerRow, 5);
  assert.equal(d.columns.date, 3);
  assert.equal(d.columns.cancel, 2);
  const r = parseRows(rows, { account: '동백전', source: 'd.xlsx' });
  assert.equal(r.needsMapping, false);
  assert.equal(r.transactions.length, 3);
  assert.deepEqual(r.transactions.map((t) => [t.date, t.merchant, t.amount]),
    [['2026-01-01', '땡겨요', 59900], ['2026-01-01', '땡겨요', -59900], ['2026-01-02', '수영김밥', 15000]]);
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0].reason, /충전/);
});
