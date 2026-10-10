import { h, won, table, put } from './dom.js';
import { weeklyBriefing } from '../briefing.js';
import { cardReport } from '../cardPerformance.js';
import { addDays } from '../dates.js';
import { buildPlan } from './splitTab.js';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function render(el, ctx) {
  const { data, ui } = ctx;
  const txs = data.transactions;
  if (!txs.length) { put(el, h('div', { class: 'card' }, '거래가 없습니다. 위 상자에 엑셀을 끌어다 놓아 주세요.')); return; }
  const { items, plan } = buildPlan(data);
  const rule = data.settings.cardRule;

  // 데이터가 오래되면(마지막 거래 2주 뒤까지만 오늘 기준) 마지막 거래 다음 날을 기준일로 쓴다.
  const last = txs.map((t) => t.date).sort().pop();
  const today = ui.today || (localToday() <= addDays(last, 14) ? localToday() : addDays(last, 1));
  const b = weeklyBriefing(txs, today, {
    weeklyBudget: plan.livingPerWeek,
    fixedItems: items.map((i) => ({ merchant: i.merchant, amount: i.monthlyAmount, day: i.day })),
  });
  const card = rule.accounts.length ? cardReport(txs, rule, today.slice(0, 7)) : null;

  put(el, h('div', { class: 'card' },
    h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, '주간 브리핑'), '기준일',
      h('input', { type: 'date', value: today, onchange: (e) => { ui.today = e.target.value; ctx.go('briefing'); } })),
    h('p', {}, `지난주 생활비 ${won(b.lastWeekLiving)} · 주 예산 ${won(plan.livingPerWeek)} → `,
      h('b', { class: b.budgetDiff >= 0 ? 'good' : 'bad' }, b.budgetDiff >= 0 ? `${won(b.budgetDiff)} 절약` : `${won(-b.budgetDiff)} 초과`)),
    h('h3', {}, `이번 주(7일) 나갈 고정 지출 ${won(b.upcomingTotal)}`),
    b.upcomingFixed.length ? table(['날짜', '항목', '금액'], b.upcomingFixed.map((x) => [x.date, x.merchant, won(x.amount)])) : h('p', { class: 'muted' }, '예정된 고정 지출이 없습니다.'),
    card ? h('p', {}, `${rule.name || '카드'} 실적: ${card.met ? '이번 달 혜택 대상' : `실적까지 ${won(card.remaining)} 부족`}${card.met && card.missedBenefit ? ` · 놓친 혜택 ${won(card.missedBenefit)}` : ''}`) : null,
    h('p', { class: 'muted' }, '자동 알림은 없어요. 이 탭을 열 때마다 최신 데이터로 계산합니다.')));
}
