import { h, won, table, put } from './dom.js';
import { barChart, compositionChart } from './chart.js';
import { monthlyBriefing, briefingMonths } from '../monthlyBriefing.js';
import { categoryColor, ACCOUNT_COLORS } from '../constants.js';

const dot = (color) => h('span', { style: `display:inline-block;width:10px;height:10px;border-radius:3px;background:${color};margin-right:6px` });
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${won(Math.abs(n))}`;

export function render(el, ctx) {
  const { data, ui } = ctx;
  if (!data.transactions.length) {
    put(el, h('div', { class: 'card' }, '거래가 없습니다. 위 상자에 엑셀을 끌어다 놓아 주세요.'));
    return;
  }
  const accounts = [...new Set(data.transactions.map((t) => t.account || '(이름 없음)'))].sort();
  if (ui.account && !accounts.includes(ui.account)) ui.account = '';
  const txs = ui.account ? data.transactions.filter((t) => (t.account || '(이름 없음)') === ui.account) : data.transactions;
  const months = briefingMonths(txs);
  if (!months.length) {
    put(el, h('div', { class: 'card' }, '선택한 카드/계좌에 지출 거래가 없습니다.',
      h('button', { class: 'ghost', onclick: () => { ui.account = ''; ctx.go('monthly'); } }, '전체 보기')));
    return;
  }
  const month = months.includes(ui.month) ? ui.month : months[months.length - 1];
  const b = monthlyBriefing(txs, month);

  const reportText = () => [
    `[${month} 월간 브리핑${ui.account ? ` · ${ui.account}` : ''}]`,
    ...b.insights.map((s) => `- ${s}`),
    '',
    '카테고리별',
    ...b.categories.filter((c) => c.value > 0).map((c) => `- ${c.category} ${won(c.value)} (${c.share.toFixed(0)}%)${b.prevMonth ? ` · 전월 대비 ${signed(c.delta)}` : ''}`),
  ].join('\n');
  const copyBtn = h('button', { class: 'ghost' }, '요약 복사');
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(reportText()); copyBtn.textContent = '복사했어요'; }
    catch { copyBtn.textContent = '복사할 수 없어요'; }
    setTimeout(() => { copyBtn.textContent = '요약 복사'; }, 1500);
  });

  const kpi = (label, value, sub, color) => h('div', { class: 'kpi', style: `--kc:${color}` },
    h('div', { class: 'k-label' }, label), h('div', { class: 'k-value' }, value), sub ? h('div', { class: 'k-sub' }, sub) : null);
  const vsPrev = b.diff === null ? null : b.diff > 0 ? 'var(--red)' : 'var(--green)';
  const vsAvg = b.avgRecent === null ? null : b.total - b.avgRecent;

  put(el,
    h('div', { class: 'card' },
      h('div', { class: 'row', style: 'margin:0' }, h('h2', { style: 'margin:0' }, `${month} 월간 브리핑`),
        h('span', { class: 'muted' }, `${ui.account || '전체 카드/계좌'} · ${b.count}건`), h('span', { style: 'margin-left:auto' }, copyBtn))),

    h('div', { class: 'kpis' },
      kpi(`${month} 지출`, won(b.total), `${b.count}건`, 'var(--accent)'),
      kpi('전월 대비', b.diff === null ? '-' : signed(b.diff),
        b.pct === null ? '비교할 이전 달이 없어요' : h('span', {}, h('b', { class: b.diff > 0 ? 'up' : 'down' }, `${b.diff > 0 ? '▲' : '▼'} ${Math.abs(b.pct).toFixed(1)}%`), ` · ${b.prevMonth} ${won(b.prevTotal)}`),
        vsPrev || 'var(--faint)'),
      kpi(`최근 ${b.recentMonths || ''}개월 평균 대비`.replace('최근 개월', '최근 평균'), vsAvg === null ? '-' : signed(vsAvg),
        vsAvg === null ? '비교할 달이 부족해요' : `평균 ${won(b.avgRecent)}`, vsAvg === null ? 'var(--faint)' : vsAvg > 0 ? 'var(--red)' : 'var(--green)'),
      kpi('고정비 비중', b.total > 0 ? `${((b.fixed / b.total) * 100).toFixed(0)}%` : '-', `고정 ${won(b.fixed)} · 변동 ${won(b.variable)}`, 'var(--amber)')),

    h('div', { class: 'card' },
      h('h2', {}, '이번 달 한눈에 보기'),
      h('ul', { class: 'insights' }, b.insights.map((s) => h('li', {}, s)))),

    h('div', { class: 'grid2' },
      h('div', { class: 'card' },
        h('h2', {}, '카테고리 전월 대비'),
        table(['카테고리', '이번 달', '비중', b.prevMonth ? `전월(${b.prevMonth})` : '전월', '증감'],
          b.categories.filter((c) => c.value > 0 || c.prev > 0).map((c) => [
            h('span', {}, dot(categoryColor(c.category)), c.category), won(c.value), `${c.share.toFixed(0)}%`,
            b.prevMonth ? won(c.prev) : '-',
            b.prevMonth ? h('span', { class: c.delta > 0 ? 'bad' : c.delta < 0 ? 'good' : 'muted' }, signed(c.delta)) : '-']))),
      h('div', { class: 'card' },
        h('h2', {}, '주차별 지출'),
        barChart(b.weeks.map((w) => ({ label: `${w.week}주차 (${(w.week - 1) * 7 + 1}~${w.week === 5 ? '말' : w.week * 7}일)`, value: w.value })), { format: won }),
        b.topDays.length ? h('p', { class: 'muted' }, `지출이 큰 날: ${b.topDays.map((d) => `${d.date.slice(5)} ${won(d.value)}`).join(' · ')}`) : null)),

    h('div', { class: 'grid2' },
      h('div', { class: 'card' },
        h('h2', {}, '많이 쓴 가맹점 TOP 5'),
        b.merchants.length ? table(['가맹점', '횟수', '합계', '카테고리'],
          b.merchants.map((m) => [m.name, `${m.count}회`, won(m.amount), h('span', {}, dot(categoryColor(m.category)), m.category)]))
          : h('p', { class: 'muted' }, '없음')),
      h('div', { class: 'card' },
        h('h2', {}, '큰 결제 TOP 5'),
        b.biggest.length ? table(['날짜', '가맹점', '금액', '카드/계좌'],
          b.biggest.map((t) => [t.date.slice(5), t.merchant, won(t.amount), t.account])) : h('p', { class: 'muted' }, '없음'))),

    h('div', { class: 'grid2' },
      h('div', { class: 'card' },
        h('h2', {}, '카드/계좌별 구성'),
        compositionChart(b.accounts.map((a, i) => ({ label: a.account, value: a.value, color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] })), { format: won, compact: true })),
      h('div', { class: 'card' },
        h('h2', {}, '확인해 볼 항목'),
        h('ul', { class: 'insights' },
          b.newMerchants.length ? h('li', {}, `이번 달 처음 나온 가맹점: ${b.newMerchants.map((m) => `${m.name}(${won(m.amount)})`).join(', ')}`) : null,
          b.recurring.count ? h('li', {}, `정기결제 ${b.recurring.count}건, 월 ${won(b.recurring.monthly)}${b.recurring.priceUp.length ? ` (금액 오른 항목: ${b.recurring.priceUp.join(', ')})` : ''}`) : null,
          b.refunds.count ? h('li', {}, `취소·환불 ${b.refunds.count}건 ${won(b.refunds.amount)}`) : null,
          b.unclassified.count ? h('li', {}, `분류 안 된 지출 ${b.unclassified.count}건 ${won(b.unclassified.amount)}`) : null,
          ...b.memos.map((m) => h('li', {}, `메모 · ${m.date.slice(5)} ${m.merchant} ${won(m.amount)} — ${m.memo}`))),
        !b.newMerchants.length && !b.recurring.count && !b.refunds.count && !b.unclassified.count && !b.memos.length
          ? h('p', { class: 'muted' }, '특별히 확인할 항목이 없습니다.') : null)));
}
