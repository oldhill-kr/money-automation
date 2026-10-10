import { addMonthsClip } from './dates.js';

// 지출 = kind가 expense이고 취소되지 않은 거래. 카드대금·저축·입금은 합계에서 제외한다.
const isSpend = (t) => t.kind === 'expense' && !t.canceled;

export function monthlyTotals(txs) {
  const months = new Map();
  for (const t of txs.filter(isSpend)) {
    const month = t.date.slice(0, 7);
    const row = months.get(month) || { month, total: 0, byCategory: {} };
    const cat = t.category ?? '기타';
    row.total += t.amount;
    row.byCategory[cat] = (row.byCategory[cat] || 0) + t.amount;
    months.set(month, row);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function averageMonthly(txs) {
  const m = monthlyTotals(txs);
  return m.length ? Math.round(m.reduce((s, r) => s + r.total, 0) / m.length) : 0;
}

// 할부 n개월 거래를 n개의 월별 거래로 나눈다. 나머지(원 단위)는 첫 달에 얹는다.
export function splitInstallments(txs) {
  return txs.flatMap((t) => {
    const n = t.installmentMonths;
    if (!(n > 1)) return [t];
    const base = Math.floor(t.amount / n), rest = t.amount - base * n;
    return Array.from({ length: n }, (_, i) => {
      const { installmentMonths, ...piece } = t;
      return { ...piece, date: addMonthsClip(t.date, i), amount: base + (i === 0 ? rest : 0), origin: t };
    });
  });
}
