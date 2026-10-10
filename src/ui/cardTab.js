import { h, won, table } from './dom.js';
import { cardReport, formatBenefits } from '../cardPerformance.js';

export function render(el, ctx) {
  const { data, ui } = ctx;
  const rule = data.settings.cardRule;
  if (!rule.accounts.length) {
    el.append(h('div', { class: 'card' },
      h('h2', {}, '카드 혜택 규칙이 필요해요'),
      h('p', {}, '설정 탭에서 카드 이름, 전월 실적 기준, 카테고리별 혜택률, 이 카드로 쓰는 계좌 이름을 입력해 주세요.'),
      h('button', { class: 'primary', onclick: () => ctx.go('settings') }, '설정으로 가기')));
    return;
  }
  const months = [...new Set(data.transactions.map((t) => t.date.slice(0, 7)))].sort();
  if (!months.length) { el.append(h('div', { class: 'card' }, '거래가 없습니다.')); return; }
  const month = months.includes(ui.cardMonth) ? ui.cardMonth : months[months.length - 1];
  const r = cardReport(data.transactions, rule, month);
  el.append(
    h('div', { class: 'card' },
      h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, `${rule.name || '내 카드'} 실적`),
        h('select', { onchange: (e) => { ui.cardMonth = e.target.value; ctx.go('card'); } },
          months.map((m) => h('option', { value: m, selected: m === month }, m)))),
      h('p', { class: 'muted' }, `혜택: ${formatBenefits(rule.benefits)} · 전월 실적 ${won(rule.minPrevMonthSpend)} 이상`),
      h('p', {}, `전월 ${won(r.spent)} 사용 → `, h('b', { class: r.met ? 'good' : 'bad' }, r.met ? '이번 달 혜택 대상' : `실적까지 ${won(r.remaining)} 부족`)),
      r.met ? [
        h('p', {}, '혜택 카드를 안 써서 놓친 혜택 ', h('span', { class: 'big bad' }, won(r.missedBenefit))),
        r.missedBenefit ? table(['카테고리', '놓친 혜택'], Object.entries(r.missedByCategory).map(([c, v]) => [c, won(v)])) : null,
        h('p', { class: 'muted' }, '그 카테고리는 혜택이 있는 카드로 결제하면 받을 수 있었던 금액입니다.'),
      ] : h('p', { class: 'muted' }, '실적 미달이면 혜택이 적용되지 않으므로 놓친 혜택은 계산하지 않습니다.')));
}
