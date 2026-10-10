// 새는 돈 감지. 정기결제 = 같은 가맹점이 매달 한 번, 비슷한 날짜에 반복되는 것.
const HABIT_OR_VARIABLE = new Set(['의료', '쇼핑', '식비', '카페', '배달', '교통']);
const DUPLICATE_GROUPS = [
  ['icloud', 'google one'], // 클라우드
  ['멜론', 'youtube premium', 'spotify'], // 음악
];
const SMALL_AMOUNT = 3000;
const PRICE_UP_RATIO = 1.5;
const MAX_DAY_GAP = 5;

const spend = (txs) => txs.filter((t) => t.kind === 'expense' && !t.canceled);
const monthOf = (t) => t.date.slice(0, 7);
const dayOf = (t) => Number(t.date.slice(8, 10));

export const monthsCovered = (txs) => new Set(spend(txs).map(monthOf)).size;
export const annualCost = (monthly) => monthly * 12;

export function findRecurring(txs) {
  if (monthsCovered(txs) < 2) return [];
  const firstMonth = [...new Set(spend(txs).map(monthOf))].sort()[0];
  const byMerchant = new Map();
  for (const t of spend(txs)) {
    if (t.installmentMonths || HABIT_OR_VARIABLE.has(t.category)) continue;
    if (!byMerchant.has(t.merchant)) byMerchant.set(t.merchant, []);
    byMerchant.get(t.merchant).push(t);
  }

  const items = [];
  for (const [merchant, list] of byMerchant) {
    const months = new Set(list.map(monthOf));
    if (months.size < 2 || months.size !== list.length) continue; // 달마다 정확히 한 번
    list.sort((a, b) => a.date.localeCompare(b.date));
    if (list.some((t) => Math.abs(dayOf(t) - dayOf(list[0])) > MAX_DAY_GAP)) continue;
    const first = list[0], last = list[list.length - 1];
    const signals = [];
    if (monthOf(first) > firstMonth) signals.push('newlyStarted');
    if (last.amount >= first.amount * PRICE_UP_RATIO) signals.push('priceUp');
    if (last.amount <= SMALL_AMOUNT) signals.push('small');
    items.push({ merchant, monthlyAmount: last.amount, day: dayOf(last), months: months.size, category: last.category, signals });
  }

  for (const group of DUPLICATE_GROUPS) {
    const hits = items.filter((i) => group.some((k) => i.merchant.toLowerCase().includes(k)));
    if (hits.length >= 2) hits.forEach((i) => i.signals.push('duplicate'));
  }
  return items;
}

export function savings(items, cancelledMerchants) {
  const monthly = items.filter((i) => cancelledMerchants.has(i.merchant)).reduce((s, i) => s + i.monthlyAmount, 0);
  return { monthly, yearly: annualCost(monthly) };
}

export function habitSpend(txs, category) {
  const list = spend(txs).filter((t) => t.category === category);
  const months = new Set(list.map(monthOf)).size;
  if (!months) return { countPerMonth: 0, yearly: 0 };
  const total = list.reduce((s, t) => s + t.amount, 0);
  return { countPerMonth: Math.round(list.length / months), yearly: Math.round((total / months) * 12) };
}
