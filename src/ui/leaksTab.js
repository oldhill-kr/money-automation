import { h, won, table, put } from './dom.js';
import { findRecurring, savings, annualCost, habitSpend, monthsCovered } from '../leaks.js';

const SIGNAL = { newlyStarted: '새로 시작', priceUp: '가격 인상', duplicate: '중복 의심', small: '소액' };

export function render(el, ctx) {
  const { data } = ctx;
  const txs = data.transactions;
  if (monthsCovered(txs) < 2) {
    put(el, h('div', { class: 'card' }, '정기결제를 찾으려면 최소 2개월 치 거래가 필요합니다. 석 달 치를 올리면 더 정확합니다.'));
    return;
  }
  const items = findRecurring(txs).sort((a, b) => b.signals.length - a.signals.length || b.monthlyAmount - a.monthlyAmount);
  const cancelled = new Set(data.settings.cancelled);
  const s = savings(items, cancelled);
  const toggle = (merchant, on) => {
    const set = new Set(data.settings.cancelled);
    if (on) set.add(merchant); else set.delete(merchant);
    data.settings.cancelled = [...set];
    ctx.commit();
  };
  const delivery = habitSpend(txs, '배달');

  put(el, 
    h('div', { class: 'card' },
      h('h2', {}, '매달 자동으로 나가는 돈'),
      h('p', { class: 'muted' }, '같은 가맹점이 매달 비슷한 날짜에 한 번씩 결제된 것만 정기결제로 봅니다. 할부·병원·쇼핑은 제외했어요. 결과가 이상하면 한 번 더 확인하세요. 해지는 직접 하셔야 합니다.'),
      table(['해지 예정', '가맹점', '월', '연(×12)', '신호', '확인된 개월'], items.map((i) => [
        h('input', { type: 'checkbox', checked: cancelled.has(i.merchant), onchange: (e) => toggle(i.merchant, e.target.checked) }),
        i.merchant, won(i.monthlyAmount), won(annualCost(i.monthlyAmount)),
        i.signals.map((k) => h('span', { class: 'badge' }, SIGNAL[k])), `${i.months}개월`,
      ]))),
    h('div', { class: 'card' },
      h('h2', {}, '해지하면 아끼는 돈'),
      h('p', {}, '월 ', h('span', { class: 'big good' }, won(s.monthly)), '  ·  연 ', h('span', { class: 'big good' }, won(s.yearly))),
      h('p', { class: 'muted' }, '이 금액은 통장·브리핑 탭의 저축·투자 칸에 자동 반영됩니다.')),
    delivery.countPerMonth ? h('div', { class: 'card' },
      h('h2', {}, '습관 지출'),
      h('p', {}, `배달: 월 ${delivery.countPerMonth}회, 연 ${won(delivery.yearly)}`),
      h('p', { class: 'muted' }, '줄이라는 뜻이 아니라 내가 쓰는 규모를 알아 두자는 것입니다.')) : null);
}
