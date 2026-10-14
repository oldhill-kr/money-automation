// 지역화폐(동백전 등) 캐시백·지원금 집계. 거래에 cashback/cashbackUsed/subsidyUsed 필드가 있는 것만 센다.
const hasInfo = (t) => t.kind === 'expense' && (t.cashback !== undefined || t.cashbackUsed !== undefined || t.subsidyUsed !== undefined);

export const hasCashback = (txs) => txs.some(hasInfo);

export function monthlyCashback(txs) {
  const months = new Map();
  for (const t of txs.filter(hasInfo)) {
    const m = t.date.slice(0, 7);
    const r = months.get(m) || { month: m, spend: 0, earned: 0, used: 0, subsidy: 0, count: 0 };
    r.spend += t.amount;
    r.earned += t.cashback || 0;
    r.used += t.cashbackUsed || 0;
    r.subsidy += t.subsidyUsed || 0;
    r.count += 1;
    months.set(m, r);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month))
    .map((r) => ({ ...r, rate: r.spend > 0 ? r.earned / r.spend : null }));
}

export function cashbackTotals(rows) {
  const t = rows.reduce((s, r) => ({ spend: s.spend + r.spend, earned: s.earned + r.earned, used: s.used + r.used, subsidy: s.subsidy + r.subsidy }),
    { spend: 0, earned: 0, used: 0, subsidy: 0 });
  return { ...t, rate: t.spend > 0 ? t.earned / t.spend : null };
}
