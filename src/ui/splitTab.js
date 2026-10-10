import { h, won, put } from './dom.js';
import { findRecurring, savings } from '../leaks.js';
import { averageMonthly } from '../ledger.js';
import { monthlySalary, splitPlan } from '../accountSplit.js';

// 통장 쪼개기 계산에 쓰는 값을 한곳에서 만든다(주간 브리핑 탭도 같은 주 예산을 쓴다).
export function buildPlan(data) {
  const st = data.settings, txs = data.transactions;
  const items = findRecurring(txs);
  const fixedCosts = items.reduce((s, i) => s + i.monthlyAmount, 0);
  const avgLiving = Math.max(0, averageMonthly(txs) - fixedCosts);
  const salary = monthlySalary(txs) || Math.round((st.annualSalary || 0) / 12);
  const leak = savings(items, new Set(st.cancelled));
  const plan = splitPlan({
    salary, fixedCosts, avgLiving, leakSavings: leak.monthly, emergencyNow: st.emergencyNow || 0,
    emergencyRatio: st.emergencyRatio, cutRate: st.cutPercent / 100, emergencyMonths: st.emergencyMonths,
  });
  return { items, fixedCosts, avgLiving, salary, leak, plan };
}

const nextDay = (d) => (d >= 28 ? 1 : d + 1);

export function render(el, ctx) {
  const { data } = ctx;
  const st = data.settings;
  if (!data.transactions.length) { put(el, h('div', { class: 'card' }, '거래가 없습니다. 위 상자에 엑셀을 끌어다 놓아 주세요.')); return; }
  const { fixedCosts, avgLiving, salary, leak, plan } = buildPlan(data);

  const num = (key, label, min, max) => h('div', { class: 'field' }, label,
    h('input', { type: 'number', min, max, value: st[key], onchange: (e) => {
      st[key] = Math.min(max ?? Infinity, Math.max(min, Number(e.target.value) || 0));
      ctx.commit();
    } }));

  const day = st.salaryDay, move = nextDay(day);
  const rows = [
    ['① 월급 통장(고정비)', plan.fixed, `${day}일 급여 그대로 — 월세·통신·보험·구독이 여기서 빠짐`],
    ['② 생활비 통장(체크카드)', plan.living, `${move}일 자동이체 → 주마다 ${won(plan.livingPerWeek)}`],
    ['③ 비상금 통장', plan.emergency, `목표 ${won(plan.emergencyGoal)}` + (plan.monthsToGoal === null ? '' : plan.monthsToGoal === 0 ? ' — 이미 달성' : ` → ${plan.monthsToGoal}개월 뒤`)],
    ['④ 저축·투자 통장', plan.invest, `${move}일 자동이체`],
  ];

  put(el, 
    !salary ? h('div', { class: 'notice warn' }, '월급(입금 내역의 "급여")을 찾지 못했습니다. 설정 탭에서 연간 총급여를 입력해 주세요.') : null,
    h('div', { class: 'cols' },
      h('div', { class: 'card' }, h('h2', {}, '설정'),
        num('salaryDay', '월급날', 1, 31),
        num('emergencyNow', '지금 비상금으로 쓸 수 있는 돈(원)', 0),
        num('cutPercent', '생활비 줄이기 목표(%)', 0, 90),
        num('emergencyMonths', '비상금 목표(몇 달 치)', 1, 24)),
      h('div', { class: 'card' }, h('h2', {}, '통장 4개로 나누기'),
        plan.deficit ? h('div', { class: 'notice warn' }, `월급보다 ${won(plan.deficit)} 더 쓰고 있어요. 비상금·저축 칸을 만들 여유가 없습니다.`) : null,
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, '통장'), h('th', { class: 'num' }, '매달'), h('th', {}, '언제·어떻게'))),
          h('tbody', {}, rows.map(([a, b, c]) => h('tr', {}, h('td', {}, a), h('td', { class: 'num' }, won(b)), h('td', {}, c))),
            h('tr', { class: 'total' }, h('td', {}, '합계'), h('td', { class: 'num' }, won(plan.fixed + plan.living + plan.emergency + plan.invest)), h('td', {}, `월급 ${won(salary)}`)))),
        h('p', { class: 'muted' }, `고정비(정기결제) ${won(fixedCosts)} · 생활비 평균 ${won(avgLiving)} 기준.`,
          leak.monthly ? ` 새는 돈에서 체크한 ${won(leak.monthly)}은 고정비에서 빼고 저축으로 돌렸어요.` : ' 새는 돈 탭에서 해지할 항목을 체크하면 저축 칸에 더해집니다.'))),
    h('div', { class: 'card' }, h('h2', {}, '은행 앱에서 할 일 (직접)'),
      h('ol', { class: 'todo' },
        h('li', {}, '생활비·비상금·저축 통장 3개 만들기(있으면 이름만 바꾸기)'),
        h('li', {}, `매달 ${move}일 자동이체 3건 걸기(위 금액)`),
        h('li', {}, '체크카드는 생활비 통장에만 연결')),
      h('p', { class: 'muted' }, '이 앱은 이체를 실행하지 않습니다. 자동이체는 은행 앱에서 직접 설정하세요.')));
}
