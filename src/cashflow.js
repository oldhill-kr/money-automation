// 월별 수입·지출·저축률. 수입 = 통장 입금(kind income), 지출 = 지출 거래.
// 카드대금·본인 이체·충전은 지출에도 수입에도 넣지 않는다(이중 집계 방지).
export function monthlyCashflow(txs) {
  const months = new Map();
  const row = (m) => {
    if (!months.has(m)) months.set(m, { month: m, income: 0, salary: 0, expense: 0, saving: 0 });
    return months.get(m);
  };
  for (const t of txs) {
    if (t.canceled) continue;
    const r = row(t.date.slice(0, 7));
    if (t.kind === 'income') { r.income += t.amount; if (t.isSalary) r.salary += t.amount; }
    else if (t.kind === 'expense') r.expense += t.amount;
    else if (t.kind === 'saving') r.saving += t.amount;
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({
    ...r,
    net: r.income - r.expense,
    // 수입이 없는 달(통장 파일을 안 올린 달)은 저축률을 계산하지 않는다.
    rate: r.income > 0 ? (r.income - r.expense) / r.income : null,
  }));
}

// 수입이 있는 달만 모아 전체 기간 합계와 저축률을 낸다.
export function cashflowTotals(rows) {
  const withIncome = rows.filter((r) => r.income > 0);
  const income = withIncome.reduce((s, r) => s + r.income, 0);
  const expense = withIncome.reduce((s, r) => s + r.expense, 0);
  return { months: withIncome.length, income, expense, net: income - expense, rate: income > 0 ? (income - expense) / income : null };
}
