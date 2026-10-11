import { merchantKey } from './classifier.js';
import { findRecurring } from './leaks.js';

// 월간 브리핑: 한 달의 지출을 전월·최근 평균과 비교하고, 눈여겨볼 점을 문장으로 뽑는다.
// 화면을 모르는 순수 계산 모듈이다. 취소 거래는 마이너스 금액으로 이미 합산돼 있다.
export const FIXED_CATEGORIES = new Set(['주거·공과금', '통신', '보험', '구독']);

const isSpend = (t) => t.kind === 'expense' && !t.canceled;
const sum = (list) => list.reduce((s, t) => s + t.amount, 0);
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const cat = (t) => t.category ?? '기타';

export function briefingMonths(txs) {
  return [...new Set(txs.filter(isSpend).map((t) => t.date.slice(0, 7)))].sort();
}

function groupSum(list, keyOf) {
  const map = new Map();
  for (const t of list) map.set(keyOf(t), (map.get(keyOf(t)) || 0) + t.amount);
  return map;
}

export function monthlyBriefing(txs, month) {
  const spend = txs.filter(isSpend);
  const months = briefingMonths(txs);
  const idx = months.indexOf(month);
  const cur = spend.filter((t) => t.date.startsWith(month));
  const prevMonth = idx > 0 ? months[idx - 1] : null;
  const prevList = prevMonth ? spend.filter((t) => t.date.startsWith(prevMonth)) : [];
  const recent = months.slice(Math.max(0, idx - 3), Math.max(0, idx));
  const avgRecent = recent.length ? Math.round(recent.reduce((s, m) => s + sum(spend.filter((t) => t.date.startsWith(m))), 0) / recent.length) : null;

  const total = sum(cur);
  const prevTotal = prevMonth ? sum(prevList) : null;
  const diff = prevTotal === null ? null : total - prevTotal;
  const pct = prevTotal ? (diff / prevTotal) * 100 : null;

  // 카테고리별 전월 대비
  const curCat = groupSum(cur, cat), prevCat = groupSum(prevList, cat);
  const categories = [...new Set([...curCat.keys(), ...prevCat.keys()])].map((name) => {
    const value = curCat.get(name) || 0, prev = prevCat.get(name) || 0;
    return { category: name, value, prev, delta: value - prev, share: total > 0 ? (value / total) * 100 : 0 };
  }).sort((a, b) => b.value - a.value);

  // 가맹점(지점명 무시)별 합계
  const byMerchant = new Map();
  for (const t of cur) {
    const k = merchantKey(t.merchant);
    const g = byMerchant.get(k) || { key: k, name: t.merchant, count: 0, amount: 0, category: cat(t) };
    g.count += 1; g.amount += t.amount;
    byMerchant.set(k, g);
  }
  const merchants = [...byMerchant.values()].filter((g) => g.amount > 0).sort((a, b) => b.amount - a.amount);

  const biggest = [...cur].filter((t) => t.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5)
    .map((t) => ({ date: t.date, merchant: t.merchant, amount: t.amount, category: cat(t), account: t.account || '' }));

  // 주차별(1~7일=1주 …)
  const weeks = [];
  for (const t of cur) {
    const w = Math.min(5, Math.ceil(Number(t.date.slice(8, 10)) / 7)) - 1;
    weeks[w] = (weeks[w] || 0) + t.amount;
  }
  const weekRows = Array.from({ length: 5 }, (_, i) => ({ week: i + 1, value: weeks[i] || 0 }));
  const days = [...groupSum(cur, (t) => t.date).entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([date, value]) => ({ date, value }));

  const fixed = sum(cur.filter((t) => FIXED_CATEGORIES.has(cat(t))));
  const refunds = cur.filter((t) => t.amount < 0);
  const unclassified = cur.filter((t) => !t.category);
  const accountsMap = groupSum(cur, (t) => t.account || '(이름 없음)');
  const accounts = [...accountsMap.entries()].map(([account, value]) => ({ account, value, share: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // 이번 달 처음 나온 가맹점(데이터의 첫 달은 제외)
  let newMerchants = [];
  if (idx > 0) {
    const seenBefore = new Set(spend.filter((t) => t.date.slice(0, 7) < month).map((t) => merchantKey(t.merchant)));
    newMerchants = merchants.filter((g) => !seenBefore.has(g.key)).slice(0, 5);
  }

  // 정기결제: 이번 달에도 찍힌 반복 결제와 금액이 오른 것
  const recurringAll = findRecurring(spend).filter((i) => cur.some((t) => t.merchant === i.merchant));
  const recurring = { count: recurringAll.length, monthly: recurringAll.reduce((s, i) => s + i.monthlyAmount, 0),
    priceUp: recurringAll.filter((i) => i.signals.includes('priceUp')).map((i) => i.merchant) };

  const memos = cur.filter((t) => t.memo).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    .map((t) => ({ date: t.date, merchant: t.merchant, amount: t.amount, memo: t.memo }));

  // 눈여겨볼 점(문장)
  const insights = [];
  if (!cur.length) {
    insights.push('이 달에는 지출 거래가 없습니다.');
  } else {
    if (diff !== null) {
      insights.push(diff === 0 ? `${month} 지출은 ${won(total)}으로 ${prevMonth}과 같습니다.`
        : `${month} 지출은 ${won(total)}으로 ${prevMonth}보다 ${won(Math.abs(diff))}${pct === null ? '' : `(${Math.abs(pct).toFixed(1)}%)`} ${diff > 0 ? '늘었습니다' : '줄었습니다'}.`);
    } else {
      insights.push(`${month} 지출은 ${won(total)}입니다. 비교할 이전 달 데이터는 아직 없습니다.`);
    }
    if (avgRecent !== null && avgRecent > 0) {
      const d = total - avgRecent;
      insights.push(`최근 ${recent.length}개월 평균(${won(avgRecent)})보다 ${won(Math.abs(d))} ${d > 0 ? '많이' : '적게'} 썼습니다.`);
    }
    const top = categories.find((c) => c.value > 0);
    if (top) insights.push(`가장 큰 지출은 ${top.category} ${won(top.value)}(${top.share.toFixed(0)}%)입니다.`);
    if (prevMonth) {
      const up = [...categories].filter((c) => c.delta > 0).sort((a, b) => b.delta - a.delta)[0];
      const down = [...categories].filter((c) => c.delta < 0).sort((a, b) => a.delta - b.delta)[0];
      if (up) insights.push(`전월보다 가장 많이 늘어난 카테고리는 ${up.category}(+${won(up.delta)})입니다.`);
      if (down) insights.push(`가장 많이 줄어든 카테고리는 ${down.category}(-${won(-down.delta)})입니다.`);
    }
    if (total > 0) insights.push(`고정비(주거·통신·보험·구독)는 ${won(fixed)}으로 전체의 ${((fixed / total) * 100).toFixed(0)}%입니다.`);
    if (days[0]) insights.push(`하루 최대 지출은 ${days[0].date}의 ${won(days[0].value)}입니다.`);
    if (biggest[0]) insights.push(`가장 큰 단일 결제는 ${biggest[0].date} ${biggest[0].merchant} ${won(biggest[0].amount)}입니다.`);
    if (refunds.length) insights.push(`취소·환불 ${refunds.length}건(${won(-sum(refunds))})이 지출에서 차감됐습니다.`);
    if (newMerchants.length) insights.push(`이번 달 처음 나온 가맹점이 ${newMerchants.length}곳 이상입니다(예: ${newMerchants[0].name}).`);
    if (recurring.priceUp.length) insights.push(`정기결제 중 금액이 오른 항목: ${recurring.priceUp.join(', ')}.`);
    if (unclassified.length) insights.push(`분류가 안 된 지출이 ${unclassified.length}건(${won(sum(unclassified))}) 있습니다. 분류하면 카테고리 통계가 정확해집니다.`);
  }

  return {
    month, prevMonth, count: cur.length, total, prevTotal, diff, pct, avgRecent, recentMonths: recent.length,
    categories, merchants: merchants.slice(0, 5), biggest, weeks: weekRows, topDays: days,
    fixed, variable: total - fixed, refunds: { count: refunds.length, amount: -sum(refunds) },
    unclassified: { count: unclassified.length, amount: sum(unclassified) },
    accounts, newMerchants, recurring, memos, insights,
  };
}
