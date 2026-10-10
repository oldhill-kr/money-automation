import { addDays, dayOfWeek, parseYmd, daysInMonth } from './dates.js';

// 생활비 = 지출 중 고정비 성격의 카테고리를 뺀 것.
const FIXED_CATEGORIES = new Set(['주거·공과금', '통신', '보험', '구독']);

export function weeklyBriefing(txs, today, { weeklyBudget, fixedItems }) {
  const thisMonday = addDays(today, -((dayOfWeek(today) + 6) % 7));
  const from = addDays(thisMonday, -7), to = addDays(thisMonday, -1);
  const lastWeekLiving = txs
    .filter((t) => t.kind === 'expense' && !t.canceled && t.date >= from && t.date <= to && !FIXED_CATEGORIES.has(t.category ?? '기타'))
    .reduce((s, t) => s + t.amount, 0);

  const upcomingFixed = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const { y, m, d } = parseYmd(date);
    const last = daysInMonth(y, m);
    for (const f of fixedItems) {
      if (f.day === d || (f.day > last && d === last)) upcomingFixed.push({ merchant: f.merchant, amount: f.amount, date });
    }
  }
  return {
    lastWeekLiving, budgetDiff: weeklyBudget - lastWeekLiving,
    upcomingFixed, upcomingTotal: upcomingFixed.reduce((s, x) => s + x.amount, 0),
  };
}
