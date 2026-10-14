import { h, won, put } from './dom.js';
import { monthlyCashflow, cashflowTotals } from '../cashflow.js';

const pct = (r) => (r === null ? '-' : `${(r * 100).toFixed(1)}%`);

export function render(el, ctx) {
  const rows = monthlyCashflow(ctx.data.transactions);
  if (!rows.length) { put(el, h('div', { class: 'card' }, '거래가 없습니다. 통장 입출금 엑셀까지 올리면 수입과 저축률이 계산돼요.')); return; }
  const withIncome = rows.filter((r) => r.income > 0);
  if (!withIncome.length) {
    put(el, h('div', { class: 'card' },
      h('h2', {}, '수입(입금) 내역이 없어요'),
      h('p', { class: 'muted' }, '카드 파일에는 입금이 없어서 수입과 저축률을 계산할 수 없습니다. 월급이 들어오는 통장 엑셀을 올려 주세요. 파일을 올리기 어렵다면 가계부 탭의 "거래 직접 추가"에서 수입을 하나씩 넣을 수도 있어요.')));
    return;
  }
  const total = cashflowTotals(rows);
  const last = withIncome[withIncome.length - 1];
  const kpi = (label, value, sub, color) => h('div', { class: 'kpi', style: `--kc:${color}` },
    h('div', { class: 'k-label' }, label), h('div', { class: 'k-value' }, value), sub ? h('div', { class: 'k-sub' }, sub) : null);
  const good = (r) => (r === null ? 'var(--faint)' : r >= 0.2 ? 'var(--green)' : r >= 0 ? 'var(--amber)' : 'var(--red)');
  const maxAbs = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expense)));

  put(el,
    h('div', { class: 'kpis' },
      kpi(`${last.month} 수입`, won(last.income), last.salary ? `급여 ${won(last.salary)}` : '급여로 표시된 입금 없음', 'var(--accent)'),
      kpi(`${last.month} 지출`, won(last.expense), null, 'var(--amber)'),
      kpi(`${last.month} 남은 돈`, `${last.net < 0 ? '-' : ''}${won(Math.abs(last.net))}`, `저축률 ${pct(last.rate)}`, good(last.rate)),
      kpi('전체 저축률', pct(total.rate), `수입이 있는 ${total.months}개월 기준 · 월평균 ${won(total.net / total.months)} 남음`, good(total.rate))),
    h('div', { class: 'card' },
      h('h2', {}, '월별 수입·지출·저축률'),
      h('p', { class: 'muted' }, '남은 돈 = 수입 − 지출. 적금·예금으로 보낸 돈은 "저축·투자"에 따로 보여 주고, 카드대금·충전·본인 이체는 수입과 지출 어디에도 넣지 않습니다.'),
      h('table', {},
        h('thead', {}, h('tr', {}, ['월', '수입', '지출', '남은 돈', '저축률', '', '저축·투자(적금 등)'].map((x, i) => h('th', { class: i >= 1 && i !== 5 ? 'num' : '' }, x)))),
        h('tbody', {}, [...rows].reverse().map((r) => h('tr', {},
          h('td', {}, r.month),
          h('td', { class: 'num' }, r.income ? won(r.income) : '-'),
          h('td', { class: 'num' }, won(r.expense)),
          h('td', { class: `num ${r.income && r.net < 0 ? 'bad' : ''}` }, r.income ? won(r.net) : '-'),
          h('td', { class: `num ${r.rate !== null && r.rate < 0 ? 'bad' : ''}` }, r.income ? pct(r.rate) : '입금 내역 없음'),
          h('td', { style: 'min-width:140px' }, h('div', { class: 'duo' },
            h('i', { class: 'in', style: `width:${(r.income / maxAbs) * 100}%`, title: `수입 ${won(r.income)}` }),
            h('i', { class: 'out', style: `width:${(r.expense / maxAbs) * 100}%`, title: `지출 ${won(r.expense)}` }))),
          h('td', { class: 'num' }, r.saving ? won(r.saving) : '-')))),
      ),
      h('p', { class: 'muted' }, '■ 파랑 = 수입, ■ 주황 = 지출. 통장 파일을 올리지 않은 달은 수입이 없어 저축률을 계산하지 않습니다.')));
}
