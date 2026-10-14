import { prevMonth } from './dates.js';

// 설정 화면의 "카페:10, 배달:5" 같은 문자열 ↔ {카페:0.1, 배달:0.05}. 읽을 수 없는 항목은 버린다.
export function parseBenefits(text) {
  const out = {};
  for (const part of String(text).split(',')) {
    const [cat, pct] = part.split(':').map((s) => s.trim());
    const n = Number(pct);
    if (cat && pct !== undefined && pct !== '' && Number.isFinite(n) && n >= 0) out[cat] = Math.round(n * 10) / 1000;
  }
  return out;
}
export const formatBenefits = (b) => Object.entries(b).map(([c, r]) => `${c}:${Math.round(r * 1000) / 10}`).join(', ');

const spend =(txs) => txs.filter((t) => t.kind === 'expense' && !t.canceled);

// 실적은 '전월' 해당 카드 지출 기준. 실적을 채웠을 때만, 혜택 카드가 아닌 계좌로 결제한 금액의 혜택을 '놓친 것'으로 본다.
export function cardReport(txs, rule, month) {
  const prev = prevMonth(month);
  const mine = (t) => rule.accounts.includes(t.account);
  const spent = spend(txs).filter((t) => mine(t) && t.date.startsWith(prev)).reduce((s, t) => s + t.amount, 0);
  const met = spent >= rule.minPrevMonthSpend;
  const remaining = Math.max(0, rule.minPrevMonthSpend - spent);

  const raw = {};
  if (met) {
    for (const t of spend(txs)) {
      const rate = rule.benefits[t.category];
      if (t.date.startsWith(month) && !mine(t) && rate) raw[t.category] = (raw[t.category] || 0) + t.amount * rate;
    }
  }
  const missedByCategory = {};
  for (const [cat, v] of Object.entries(raw)) missedByCategory[cat] = Math.round(v);
  const missedBenefit = Object.values(missedByCategory).reduce((s, v) => s + v, 0);
  return { met, spent, remaining, missedBenefit, missedByCategory };
}

export const emptyCard = () => ({ name: '', minPrevMonthSpend: 300000, benefits: {}, accounts: [] });

// 예전 저장본은 카드 한 장(settings.cardRule)만 있었다. cards 목록으로 옮긴다.
export function migrateCards(settings = {}) {
  const fill = (c) => ({ ...emptyCard(), ...c, benefits: { ...(c.benefits || {}) }, accounts: [...(c.accounts || [])] });
  if (Array.isArray(settings.cards)) return settings.cards.map(fill);
  const old = settings.cardRule;
  return old && (old.name || (old.accounts && old.accounts.length)) ? [fill(old)] : [];
}
