import { h, won, put } from './dom.js';
import { budgetReport, suggestBudgets } from '../budget.js';
import { CATEGORIES, categoryColor } from '../constants.js';

const STATUS = { ok: ['여유', 'good'], warn: ['80% 넘음', 'warn'], over: ['초과', 'bad'], none: ['예산 없음', ''] };
const todayYmd = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD(로컬 날짜)

export function render(el, ctx) {
  const { data, ui } = ctx;
  const txs = data.transactions;
  const months = [...new Set(txs.filter((t) => t.kind === 'expense').map((t) => t.date.slice(0, 7)))].sort();
  if (!months.length) { put(el, h('div', { class: 'card' }, '지출 거래가 없습니다. 파일을 올리면 카테고리별 예산을 세울 수 있어요.')); return; }
  const month = months.includes(ui.month) ? ui.month : months[months.length - 1];
  const budgets = data.settings.budgets;
  const r = budgetReport(txs, budgets, month, todayYmd());

  // 예산 입력 칸에 모든 카테고리를 보여 주려고, 지출·예산이 없는 카테고리도 빈 줄로 채운다.
  const have = new Set(r.rows.map((x) => x.category));
  const rows = [...r.rows, ...CATEGORIES.filter((c) => !have.has(c)).map((category) => ({ category, budget: 0, spent: 0, remaining: 0, pct: null, status: 'none' }))];
  const order = (c) => { const i = CATEGORIES.indexOf(c); return i < 0 ? 999 : i; };
  rows.sort((a, b) => order(a.category) - order(b.category));

  const setBudget = (category, value) => {
    const next = { ...budgets };
    if (value > 0) next[category] = value; else delete next[category];
    data.settings.budgets = next;
    ctx.commit();
  };
  const kpi = (label, value, sub, color) => h('div', { class: 'kpi', style: color ? `--kc:${color}` : null },
    h('div', { class: 'k-label' }, label), h('div', { class: 'k-value' }, value), sub ? h('div', { class: 'k-sub' }, sub) : null);

  const t = r.totals;
  const hasBudget = t.budget > 0;
  const tableRows = rows.map((x) => {
    const [label, cls] = STATUS[x.status];
    const width = x.pct === null ? 0 : Math.min(100, Math.round(x.pct * 100));
    return h('tr', {},
      h('td', {}, h('span', { class: 'dot', style: `--c:${categoryColor(x.category)}` }), ' ', x.category),
      h('td', { class: 'num' }, h('input', { type: 'number', min: 0, step: 10000, value: x.budget || '', placeholder: '0',
        'aria-label': `${x.category} 월 예산`, style: 'width:116px;text-align:right', onchange: (e) => setBudget(x.category, Math.max(0, Number(e.target.value) || 0)) })),
      h('td', { class: 'num' }, won(x.spent)),
      h('td', { class: `num ${x.status === 'over' ? 'bad' : ''}` }, x.budget ? (x.remaining < 0 ? `${won(-x.remaining)} 초과` : won(x.remaining)) : '-'),
      h('td', { style: 'min-width:130px' }, x.budget
        ? h('div', { class: `pbar ${x.status}`, title: `${Math.round(x.pct * 100)}%` }, h('i', { style: `width:${width}%` }))
        : null),
      h('td', { class: cls }, x.budget ? `${Math.round(x.pct * 100)}% · ${label}` : label));
  });

  put(el,
    h('div', { class: 'kpis' },
      kpi(`${month} 예산`, hasBudget ? won(t.budget) : '-', hasBudget ? `${rows.filter((x) => x.budget).length}개 카테고리` : '아래 표에 월 예산을 입력하세요', 'var(--accent)'),
      kpi('지금까지 쓴 돈(예산 항목)', won(t.spentBudgeted), hasBudget ? `예산의 ${Math.round(t.pct * 100)}%` : null, t.pct > 1 ? 'var(--red)' : 'var(--green)'),
      kpi(t.remaining < 0 ? '초과한 금액' : '남은 예산', hasBudget ? won(Math.abs(t.remaining)) : '-', t.overCount ? `${t.overCount}개 카테고리 초과` : null, t.remaining < 0 ? 'var(--red)' : 'var(--amber)'),
      r.pace ? kpi('하루 쓸 수 있는 돈', won(r.pace.perDay), `남은 ${r.pace.daysLeft}일 · 이 속도면 월말 ${won(r.pace.projected)}`,
        r.pace.projected > t.budget ? 'var(--red)' : 'var(--green)') : null),
    h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('h2', { style: 'margin:0' }, `${month} 카테고리별 예산`),
        h('button', { class: 'ghost', style: 'margin-left:auto', onclick: () => {
          const fill = suggestBudgets(txs, month);
          const add = Object.entries(fill).filter(([c]) => !(budgets[c] > 0));
          if (!add.length) { ctx.alert('채울 수 있는 카테고리가 없습니다(이전 달 데이터가 없거나 이미 모두 입력했어요).'); return; }
          ctx.alert(null);
          data.settings.budgets = { ...budgets, ...Object.fromEntries(add) };
          ctx.commit();
        } }, '지난 3개월 평균으로 빈 칸 채우기'),
        hasBudget ? h('button', { class: 'danger', onclick: () => {
          if (!confirm('입력한 월 예산을 모두 지울까요?')) return;
          data.settings.budgets = {};
          ctx.commit();
        } }, '예산 모두 지우기') : null),
      h('p', { class: 'muted' }, '예산은 매달 같은 금액으로 적용됩니다. 위쪽 "조회 기준"에서 달을 바꿔 가며 볼 수 있어요. 카드대금·충전·이체는 지출에 넣지 않습니다.'),
      h('table', {},
        h('thead', {}, h('tr', {}, ['카테고리', '월 예산(원)', '이번 달 지출', '남은 금액', '진행', ''].map((x, i) => h('th', { class: i === 1 || i === 2 || i === 3 ? 'num' : '' }, x)))),
        h('tbody', {}, tableRows,
          hasBudget ? h('tr', { class: 'total' }, h('td', {}, '예산 항목 합계'), h('td', { class: 'num' }, won(t.budget)), h('td', { class: 'num' }, won(t.spentBudgeted)),
            h('td', { class: 'num' }, t.remaining < 0 ? `${won(-t.remaining)} 초과` : won(t.remaining)), h('td', {}), h('td', {})) : null)),
      t.spentUnbudgeted ? h('p', { class: 'muted' }, `예산을 정하지 않은 카테고리 지출 ${won(t.spentUnbudgeted)}은 위 합계에 들어가지 않습니다.`) : null));
}
