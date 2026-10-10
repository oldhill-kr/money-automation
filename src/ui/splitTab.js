import { h, won, table } from './dom.js';
import { findRecurring, savings } from '../leaks.js';
import { averageMonthly } from '../ledger.js';
import { monthlySalary, splitPlan } from '../accountSplit.js';
import { weeklyBriefing } from '../briefing.js';
import { cardReport } from '../cardPerformance.js';
import { addDays } from '../dates.js';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function render(el, ctx) {
  const { data, ui } = ctx;
  const txs = data.transactions;
  if (!txs.length) { el.append(h('div', { class: 'card' }, '거래가 없습니다. 업로드 탭에서 엑셀을 올려 주세요.')); return; }
  const st = data.settings;

  const items = findRecurring(txs);
  const fixedCosts = items.reduce((s, i) => s + i.monthlyAmount, 0);
  const avgLiving = Math.max(0, averageMonthly(txs) - fixedCosts);
  const salary = monthlySalary(txs) || Math.round((st.annualSalary || 0) / 12);
  const leak = savings(items, new Set(st.cancelled));
  const plan = splitPlan({ salary, fixedCosts, avgLiving, leakSavings: leak.monthly, emergencyNow: st.emergencyNow || 0, emergencyRatio: st.emergencyRatio });

  const last = txs.map((t) => t.date).sort().pop();
  const today = ui.today || (localToday() <= addDays(last, 14) ? localToday() : addDays(last, 1));
  const brief = weeklyBriefing(txs, today, {
    weeklyBudget: plan.livingPerWeek,
    fixedItems: items.map((i) => ({ merchant: i.merchant, amount: i.monthlyAmount, day: i.day })),
  });
  const rule = st.cardRule;
  const month = today.slice(0, 7);
  const card = rule.accounts.length ? cardReport(txs, rule, month) : null;

  const box = (title, amount, note) => h('div', {}, h('div', { class: 'muted' }, title), h('div', { class: 'big' }, won(amount)), h('div', { class: 'muted' }, note));

  el.append(
    h('div', { class: 'card' }, h('h2', {}, '월급날 통장 쪼개기'),
      !salary ? h('div', { class: 'notice warn' }, '월급(입금 내역의 "급여")을 찾지 못했습니다. 설정 탭에서 연간 총급여를 입력해 주세요.') : null,
      h('p', { class: 'muted' }, `월급 ${won(salary)} · 고정비(정기결제) ${won(fixedCosts)} · 생활비 평균 ${won(avgLiving)} · 생활비는 10% 절감 목표`),
      plan.deficit ? h('div', { class: 'notice warn' }, `월급보다 ${won(plan.deficit)} 더 쓰고 있습니다. 비상금·저축 칸을 만들 여유가 없어요.`) : null,
      h('div', { class: 'split' },
        box('① 월급 통장 (고정비)', plan.fixed, '월세·공과금·보험·구독이 여기서 빠져나가게'),
        box('② 생활비 통장', plan.living, `주 약 ${won(plan.livingPerWeek)}`),
        box('③ 비상금 통장', plan.emergency, `목표 ${won(plan.emergencyGoal)}` + (plan.monthsToGoal === null ? '' : ` · ${plan.monthsToGoal}개월 뒤 달성`)),
        box('④ 저축·투자 통장', plan.invest, leak.monthly ? `해지로 아낀 ${won(leak.monthly)} 포함` : '새는 돈 탭에서 해지할 항목을 체크해 보세요')),
      h('p', { class: 'muted' }, '자동이체는 은행 앱에서 직접 설정하세요. 이 앱은 이체를 실행하지 않습니다.')),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, '주간 브리핑'), '기준일',
      h('input', { type: 'date', value: today, onchange: (e) => { ui.today = e.target.value; ctx.go('split'); } })),
      h('p', {}, `지난주 생활비 ${won(brief.lastWeekLiving)} · 주 예산 ${won(plan.livingPerWeek)} → `,
        h('b', { class: brief.budgetDiff >= 0 ? 'good' : 'bad' }, brief.budgetDiff >= 0 ? `${won(brief.budgetDiff)} 절약` : `${won(-brief.budgetDiff)} 초과`)),
      h('h3', {}, `이번 주(7일) 나갈 고정 지출 ${won(brief.upcomingTotal)}`),
      brief.upcomingFixed.length ? table(['날짜', '항목', '금액'], brief.upcomingFixed.map((x) => [x.date, x.merchant, won(x.amount)])) : h('p', { class: 'muted' }, '예정된 고정 지출이 없습니다.'),
      card ? h('p', {}, `${rule.name || '카드'} 실적: ${card.met ? '이번 달 혜택 대상' : `실적까지 ${won(card.remaining)} 부족`}${card.met && card.missedBenefit ? ` · 놓친 혜택 ${won(card.missedBenefit)}` : ''}`) : null,
      h('p', { class: 'muted' }, '자동 알림은 없습니다. 이 탭을 열면 항상 최신 데이터로 계산됩니다.')));
}
