import { CATEGORIES } from './constants.js';
import { daysInMonth, prevMonth } from './dates.js';

const isSpend = (t) => t.kind === 'expense' && !t.canceled;

function spentByCategory(txs, month) {
  const by = {};
  for (const t of txs) {
    if (isSpend(t) && t.date.startsWith(month)) {
      const c = t.category ?? '기타';
      by[c] = (by[c] || 0) + t.amount;
    }
  }
  return by;
}

// 카테고리별 월 예산 대비 지출. budgets: {카테고리: 원}.
// today('YYYY-MM-DD')가 그 달 안이면 남은 날 기준 하루 예산과 월말 예상 지출도 계산한다.
export function budgetReport(txs, budgets = {}, month, today = '') {
  const spent = spentByCategory(txs, month);
  const names = [...new Set([...Object.keys(budgets).filter((c) => budgets[c] > 0), ...Object.keys(spent)])];
  const order = (c) => { const i = CATEGORIES.indexOf(c); return i < 0 ? 999 : i; };
  names.sort((a, b) => order(a) - order(b) || a.localeCompare(b, 'ko'));

  const rows = names.map((category) => {
    const budget = budgets[category] > 0 ? budgets[category] : 0;
    const s = spent[category] || 0;
    const pct = budget ? s / budget : null;
    const status = !budget ? 'none' : s > budget ? 'over' : pct >= 0.8 ? 'warn' : 'ok';
    return { category, budget, spent: s, remaining: budget - s, pct, status };
  });

  const budgetTotal = rows.reduce((s, r) => s + r.budget, 0);
  const spentBudgeted = rows.filter((r) => r.budget > 0).reduce((s, r) => s + r.spent, 0);
  const spentUnbudgeted = rows.filter((r) => !r.budget).reduce((s, r) => s + r.spent, 0);
  const totals = {
    budget: budgetTotal, spentBudgeted, spentUnbudgeted, remaining: budgetTotal - spentBudgeted,
    pct: budgetTotal ? spentBudgeted / budgetTotal : null,
    overCount: rows.filter((r) => r.status === 'over').length,
  };

  let pace = null;
  if (budgetTotal && today.startsWith(month)) {
    const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
    const day = Number(today.slice(8, 10));
    const daysLeft = days - day + 1; // 오늘 포함
    pace = {
      day, days, daysLeft,
      perDay: Math.max(0, Math.round((budgetTotal - spentBudgeted) / daysLeft)),
      projected: Math.round((spentBudgeted / day) * days),
    };
  }
  return { rows, totals, pace };
}

// 예산을 처음 정할 때 참고용: 직전 n개월(데이터가 있는 달만)의 카테고리별 월평균을 만 원 단위로 올림한다.
export function suggestBudgets(txs, month, n = 3) {
  const have = new Set(txs.filter(isSpend).map((t) => t.date.slice(0, 7)));
  const months = [];
  let m = prevMonth(month);
  for (let i = 0; i < 24 && months.length < n; i++, m = prevMonth(m)) if (have.has(m)) months.push(m);
  if (!months.length) return {};
  const sum = {};
  for (const mo of months) for (const [c, v] of Object.entries(spentByCategory(txs, mo))) sum[c] = (sum[c] || 0) + v;
  const out = {};
  for (const [c, v] of Object.entries(sum)) {
    const avg = v / months.length;
    if (avg > 0) out[c] = Math.ceil(avg / 10000) * 10000;
  }
  return out;
}
