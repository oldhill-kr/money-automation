import { h, won, table, put } from './dom.js';
import { cardReport, formatBenefits } from '../cardPerformance.js';
import { hasCashback, monthlyCashback, cashbackTotals } from '../cashback.js';

const pct = (r) => (r === null ? '-' : `${(r * 100).toFixed(1)}%`);

// 지역화폐(동백전) 캐시백·지원금 현황: 파일에 캐시백 열이 있을 때만 보인다.
function cashbackCard(txs) {
  if (!hasCashback(txs)) return null;
  const rows = monthlyCashback(txs);
  const t = cashbackTotals(rows);
  return h('div', { class: 'card' },
    h('h2', {}, '지역화폐 캐시백·지원금'),
    h('p', {}, '지금까지 받은 캐시백 ', h('span', { class: 'big good' }, won(t.earned)),
      `  ·  결제 ${won(t.spend)} 중 ${pct(t.rate)}`),
    table(['월', '결제액', '적립 캐시백', '적립률', '사용 캐시백', '사용 지원금'],
      rows.map((r) => [r.month, won(r.spend), won(r.earned), pct(r.rate), r.used ? won(r.used) : '-', r.subsidy ? won(r.subsidy) : '-'])),
    h('p', { class: 'muted' }, '취소한 결제의 캐시백은 회수된 것으로 보고 차감했습니다. 충전은 결제액에 넣지 않습니다.'));
}

function cardBlock(rule, txs, month, title) {
  const r = cardReport(txs, rule, month);
  return h('div', { class: 'card' },
    h('h2', {}, `${title} ${month} 실적`),
    h('p', { class: 'muted' }, `혜택: ${formatBenefits(rule.benefits) || '(없음)'} · 전월 실적 ${won(rule.minPrevMonthSpend)} 이상 · 계좌 ${rule.accounts.join(', ') || '(지정 안 함)'}`),
    h('p', {}, `전월 ${won(r.spent)} 사용 → `, h('b', { class: r.met ? 'good' : 'bad' }, r.met ? '이번 달 혜택 대상' : `실적까지 ${won(r.remaining)} 부족`)),
    r.met ? [
      h('p', {}, '혜택 카드를 안 써서 놓친 혜택 ', h('span', { class: 'big bad' }, won(r.missedBenefit))),
      r.missedBenefit ? table(['카테고리', '놓친 혜택'], Object.entries(r.missedByCategory).map(([c, v]) => [c, won(v)])) : null,
      h('p', { class: 'muted' }, '그 카테고리는 혜택이 있는 카드로 결제하면 받을 수 있었던 금액입니다.'),
    ] : h('p', { class: 'muted' }, '실적 미달이면 혜택이 적용되지 않으므로 놓친 혜택은 계산하지 않습니다.'));
}

export function render(el, ctx) {
  const { data, ui } = ctx;
  const cards = data.settings.cards.filter((c) => c.accounts.length);
  const cb = cashbackCard(data.transactions);
  const months = [...new Set(data.transactions.map((t) => t.date.slice(0, 7)))].sort();

  if (!cards.length) {
    put(el, cb, h('div', { class: 'card' },
      h('h2', {}, '카드 혜택 규칙이 필요해요'),
      h('p', {}, '설정 탭에서 카드 이름, 전월 실적 기준, 카테고리별 혜택률, 이 카드로 쓰는 계좌 이름을 입력해 주세요. 카드는 여러 장 등록할 수 있어요.'),
      h('button', { class: 'primary', onclick: () => ctx.go('settings') }, '설정으로 가기')));
    return;
  }
  if (!months.length) { put(el, cb, h('div', { class: 'card' }, '거래가 없습니다.')); return; }
  const month = months.includes(ui.month) ? ui.month : months[months.length - 1];

  // 카드가 둘 이상이면 한눈에 비교하는 요약표를 먼저 보여 준다.
  const summary = cards.length > 1 ? h('div', { class: 'card' },
    h('h2', {}, `${month} 카드별 실적 요약`),
    table(['카드', '전월 사용', '실적 기준', '상태', '놓친 혜택'], cards.map((c, i) => {
      const r = cardReport(data.transactions, c, month);
      return [c.name || `카드 ${i + 1}`, won(r.spent), won(c.minPrevMonthSpend),
        h('b', { class: r.met ? 'good' : 'bad' }, r.met ? '달성' : `${won(r.remaining)} 부족`),
        r.met ? won(r.missedBenefit) : '-'];
    }))) : null;

  put(el, summary, cards.map((c, i) => cardBlock(c, data.transactions, month, c.name || `카드 ${i + 1}`)), cb);
}
