import { h } from './dom.js';
import { monthlyTotals, splitInstallments } from '../ledger.js';

// 상단 공통 선택줄: 카드/계좌·월·할부 나누기와 파일 업로드 버튼.
// 선택값(ctx.ui.account, ctx.ui.month, ctx.ui.splitInstallments)은 가계부·월간 브리핑·카드 실적 탭이 함께 쓴다.
const TAB_USES = {
  ledger: { account: true, month: true, split: true },
  monthly: { account: true, month: true, split: false },
  card: { account: false, month: true, split: false },
};

export function renderToolbar(el, ctx) {
  const { data, ui } = ctx;
  const use = TAB_USES[ui.tab] || {};
  const txs = data.transactions;
  const accounts = [...new Set(txs.map((t) => t.account || '(이름 없음)'))].sort();
  if (ui.account && !accounts.includes(ui.account)) ui.account = '';

  const kids = [h('strong', {}, '조회 기준')];
  if (txs.length && (use.account || use.month)) {
    if (use.account) {
      kids.push(h('select', { 'aria-label': '카드/계좌', onchange: (e) => { ui.account = e.target.value; ctx.go(ui.tab); } },
        h('option', { value: '' }, '전체 (통합)'),
        accounts.map((a) => h('option', { value: a, selected: a === ui.account }, a))));
    }
    const pool = ui.splitInstallments && use.split !== false ? splitInstallments(txs) : txs;
    const scoped = use.account && ui.account ? pool.filter((t) => (t.account || '(이름 없음)') === ui.account) : pool;
    const months = monthlyTotals(scoped).map((t) => t.month).reverse(); // 최근 달이 위
    if (use.month && months.length) {
      const month = months.includes(ui.month) ? ui.month : months[0];
      kids.push(h('select', { 'aria-label': '월', onchange: (e) => { ui.month = e.target.value; ctx.go(ui.tab); } },
        months.map((m) => h('option', { value: m, selected: m === month }, m))));
    }
    if (use.account) kids.push(h('span', { class: 'muted' }, ui.account ? `${ui.account}만 보는 중` : `${accounts.length}개 카드/계좌 합산`));
    if (use.split) {
      kids.push(h('label', { class: 'muted' },
        h('input', { type: 'checkbox', checked: !!ui.splitInstallments, onchange: (e) => { ui.splitInstallments = e.target.checked; ctx.go(ui.tab); } }),
        ' 할부 나누기'));
    }
  } else if (txs.length) {
    kids.push(h('span', { class: 'muted' }, '이 탭은 올린 전체 기간을 기준으로 봅니다.'));
  } else {
    kids.push(h('span', { class: 'muted' }, '파일을 올리면 카드/계좌와 월을 고를 수 있어요.'));
  }

  kids.push(h('button', { class: 'primary', style: 'margin-left:auto', type: 'button', onclick: () => ctx.openUpload() }, '📂 파일 업로드'));
  el.replaceChildren(h('div', { class: 'row' }, kids));
}
