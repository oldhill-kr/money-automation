import { h } from './dom.js';
import { makeManualTx } from '../manual.js';
import { CATEGORIES } from '../constants.js';

// 엑셀에 없는 현금·계좌이체 거래를 손으로 넣는다. 지출은 가계부에, 수입은 ⑧ 수입·저축에 반영된다.
export function manualForm(ctx) {
  const today = new Date().toLocaleDateString('sv-SE');
  const known = [...new Set(ctx.data.transactions.map((t) => t.account).filter(Boolean))];
  const type = h('select', { 'aria-label': '구분' }, h('option', { value: 'expense' }, '지출'), h('option', { value: 'income' }, '수입(입금)'));
  const date = h('input', { type: 'date', value: today, 'aria-label': '날짜' });
  const merchant = h('input', { type: 'text', placeholder: '가맹점·내용 (예: 동네 시장)', style: 'min-width:180px', 'aria-label': '가맹점' });
  const amount = h('input', { type: 'number', min: 1, placeholder: '금액(원)', style: 'width:120px', 'aria-label': '금액' });
  const category = h('select', { 'aria-label': '카테고리' }, h('option', { value: '' }, '미분류(기타)'), CATEGORIES.map((c) => h('option', { value: c }, c)));
  const account = h('input', { type: 'text', list: 'manual-accounts', value: '현금', style: 'width:120px', 'aria-label': '카드/계좌' });
  const memo = h('input', { type: 'text', placeholder: '메모(선택)', style: 'min-width:140px', 'aria-label': '메모' });
  const msg = h('span', { class: 'muted' }, ctx.ui.manualMsg || '');
  ctx.ui.manualMsg = '';

  const add = h('button', { class: 'primary', onclick: async () => {
    const r = makeManualTx({ date: date.value, merchant: merchant.value, amount: amount.value, category: category.value, account: account.value, memo: memo.value, type: type.value });
    if (r.error) { msg.textContent = r.error; msg.className = 'bad'; return; }
    ctx.data.transactions = [...ctx.data.transactions, r.tx];
    ctx.ui.month = r.tx.date.slice(0, 7); // 방금 넣은 거래가 보이도록 그 달로 옮긴다
    ctx.ui.account = '';
    ctx.ui.manualMsg = `${r.tx.date} ${r.tx.merchant} ${r.tx.amount.toLocaleString('ko-KR')}원을 추가했습니다.`
      + (r.tx.kind === 'income' ? ' (수입은 ⑧ 수입·저축 탭에 반영돼요)' : '');
    ctx.alert(null);
    const y = window.scrollY;
    await ctx.commit();
    window.scrollTo(0, y);
  } }, '추가');

  const open = !!ctx.ui.manualMsg || !!msg.textContent;
  const details = h('details', { class: 'card' },
    h('summary', {}, '＋ 거래 직접 추가 (현금·계좌이체 등 엑셀에 없는 거래)'),
    h('div', { class: 'row' }, type, date, merchant, amount, category),
    h('div', { class: 'row' }, account, memo, add, msg),
    h('datalist', { id: 'manual-accounts' }, known.map((a) => h('option', { value: a }))),
    h('p', { class: 'muted' }, '직접 넣은 거래는 "업로드한 파일 관리"에 "직접 입력" 파일로 모이고, 거래 표의 ✕ 버튼으로 한 건씩 지울 수 있습니다.'));
  if (open) details.open = true;
  return details;
}
