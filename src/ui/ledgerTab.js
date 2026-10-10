import { h, won, table } from './dom.js';
import { barChart } from './chart.js';
import { monthlyTotals, averageMonthly, splitInstallments } from '../ledger.js';
import { learn } from '../classifier.js';
import { CATEGORIES } from '../constants.js';

export function render(el, ctx) {
  const { data, ui } = ctx;
  if (!data.transactions.length) {
    el.append(h('div', { class: 'card' }, '아직 거래가 없습니다. 업로드 탭에서 엑셀을 올려 주세요.'));
    return;
  }
  const txs = ui.splitInstallments ? splitInstallments(data.transactions) : data.transactions;
  const totals = monthlyTotals(txs);
  const month = totals.some((t) => t.month === ui.month) ? ui.month : totals[totals.length - 1].month;
  const row = totals.find((t) => t.month === month);

  const monthSel = h('select', { onchange: (e) => { ui.month = e.target.value; ctx.go('ledger'); } },
    totals.map((t) => h('option', { value: t.month, selected: t.month === month }, t.month)));

  const unknown = [...new Set(data.transactions.filter((t) => t.kind === 'expense' && !t.category).map((t) => t.merchant))];

  el.append(
    h('div', { class: 'card' },
      h('h2', {}, '월별 지출'),
      h('p', {}, '월평균 ', h('span', { class: 'big' }, won(averageMonthly(txs)))),
      h('p', { class: 'muted' }, '카드대금·저축·받은 돈은 지출에서 제외했습니다(이중 집계 방지). 취소된 결제도 뺐습니다.'),
      barChart(totals.map((t) => ({ label: t.month, value: t.total })), { format: won }),
      h('div', { class: 'row' },
        h('label', {}, h('input', { type: 'checkbox', checked: !!ui.splitInstallments, onchange: (e) => { ui.splitInstallments = e.target.checked; ctx.go('ledger'); } }), ' 할부 나누기 (할부 결제를 개월 수만큼 월별로 나눠 보기)'))),
    h('div', { class: 'card' },
      h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, '카테고리별'), monthSel, h('span', {}, `합계 ${won(row.total)}`)),
      barChart(Object.entries(row.byCategory).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), { format: won })),
    unknown.length ? h('div', { class: 'card' },
      h('h2', {}, `분류가 필요한 가맹점 ${unknown.length}곳`),
      h('p', { class: 'muted' }, '한 번 고르면 기억하고, 같은 가맹점의 다른 거래에도 적용됩니다.'),
      table(['가맹점', '카테고리'], unknown.slice(0, 30).map((m) => [m, h('select', {
        onchange: (e) => {
          if (!e.target.value) return;
          data.rules = learn(data.rules, m, e.target.value);
          data.transactions.forEach((t) => { if (t.kind === 'expense' && !t.category && t.merchant === m) t.category = e.target.value; });
          ctx.commit();
        },
      }, h('option', { value: '' }, '고르기'), CATEGORIES.map((c) => h('option', { value: c }, c)))]))) : null,
    h('div', { class: 'card' },
      h('button', { class: 'ghost', onclick: () => exportLedger(txs) }, '가계부를 엑셀로 내보내기 (지출 내역)')));
}

function exportLedger(txs) {
  const rows = [['날짜', '가맹점', '금액', '카테고리', '계좌']];
  txs.filter((t) => t.kind === 'expense' && !t.canceled).sort((a, b) => a.date.localeCompare(b.date))
    .forEach((t) => rows.push([t.date, t.merchant, t.amount, t.category ?? '기타', t.account]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '가계부');
  XLSX.writeFile(wb, '가계부.xlsx');
}
