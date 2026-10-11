import { h, won, table, put } from './dom.js';
import { barChart, compositionChart } from './chart.js';
import { monthlyTotals, averageMonthly, splitInstallments } from '../ledger.js';
import { unclassifiedCard } from './classifyCards.js';
import { learn, merchantKey } from '../classifier.js';
import { CATEGORIES, categoryColor, ACCOUNT_COLORS } from '../constants.js';

export function render(el, ctx) {
  const { data, ui } = ctx;
  if (!data.transactions.length) {
    put(el, h('div', { class: 'card' }, '아직 거래가 없습니다. 위 상자에 엑셀을 끌어다 놓아 주세요.'));
    return;
  }
  const allTxs = ui.splitInstallments ? splitInstallments(data.transactions) : data.transactions;
  const accounts = [...new Set(data.transactions.map((t) => t.account || '(이름 없음)'))].sort();
  if (ui.account && !accounts.includes(ui.account)) ui.account = '';
  const txs = ui.account ? allTxs.filter((t) => (t.account || '(이름 없음)') === ui.account) : allTxs;
  const totals = monthlyTotals(txs);
  if (!totals.length) {
    put(el, h('div', { class: 'card' }, '선택한 카드/계좌에 지출 거래가 없습니다.',
      h('button', { class: 'ghost', onclick: () => { ui.account = ''; ctx.go('ledger'); } }, '전체 보기')));
    return;
  }
  const month = totals.some((t) => t.month === ui.month) ? ui.month : totals[totals.length - 1].month;
  const row = totals.find((t) => t.month === month);

  // 선택한 달의 카드/계좌별 합계(통합 보기에서 카드별로 얼마씩 썼는지)
  const monthSpend = txs.filter((t) => t.kind === 'expense' && !t.canceled && t.date.startsWith(month));
  const byAccount = new Map();
  monthSpend.forEach((t) => { const a = t.account || '(이름 없음)'; byAccount.set(a, (byAccount.get(a) || 0) + t.amount); });
  const expenses = txs.filter((t) => t.kind === 'expense');
  const detailCard = buildDetailCard(ctx, expenses, month);

  // 요약 타일: 이번 달 지출, 전월 대비, 월평균, 가장 큰 카테고리
  const idx = totals.findIndex((t) => t.month === month);
  const prev = idx > 0 ? totals[idx - 1] : null;
  const diff = prev ? row.total - prev.total : null;
  const pct = prev && prev.total > 0 ? (diff / prev.total) * 100 : null;
  const cats = Object.entries(row.byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const topCat = cats[0];
  const spendCount = monthSpend.length;
  const kpi = (label, value, sub, color) => h('div', { class: 'kpi', style: color ? `--kc:${color}` : null },
    h('div', { class: 'k-label' }, label), h('div', { class: 'k-value' }, value), sub ? h('div', { class: 'k-sub' }, sub) : null);

  const accountNames = [...byAccount.keys()];
  const monthRows = totals.map((t) => ({
    label: t.month, value: t.total, selected: t.month === month,
    segments: Object.entries(t.byCategory).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: categoryColor(label) })),
  }));

  put(el,
    h('div', { class: 'kpis' },
      kpi(`${month} 지출`, won(row.total), `${spendCount}건`, 'var(--accent)'),
      kpi('전월 대비', diff === null ? '-' : `${diff > 0 ? '+' : ''}${won(diff)}`,
        pct === null ? '비교할 이전 달이 없어요' : h('span', {}, h('b', { class: diff > 0 ? 'up' : 'down' }, `${diff > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`), ` · ${prev.month} ${won(prev.total)}`),
        diff === null ? 'var(--faint)' : diff > 0 ? 'var(--red)' : 'var(--green)'),
      kpi('월평균', won(averageMonthly(txs)), `${totals.length}개월 기준`, 'var(--amber)'),
      topCat ? kpi('가장 큰 카테고리', topCat[0], `${won(topCat[1])} · ${((topCat[1] / row.total) * 100).toFixed(0)}%`, categoryColor(topCat[0]))
        : kpi('가장 큰 카테고리', '-', null, 'var(--faint)')),
    // 왼쪽: 카테고리별 + 카드/계좌별(높이 고정), 오른쪽: 월별 지출(왼쪽 두 카드 높이 합과 같고, 넘치면 스크롤)
    h('div', { class: 'board' },
      h('div', { class: 'board-left' },
        h('div', { class: 'card fixed fixed-cat' },
          h('h2', {}, `${month} 카테고리별`),
          cats.length ? compositionChart(cats.map(([label, value]) => ({ label, value, color: categoryColor(label) })), { format: won, limit: 6, compact: true })
            : h('p', { class: 'muted' }, '이 달에는 지출이 없습니다.'),
          h('p', { class: 'muted' }, `합계 ${won(row.total)}`)),
        h('div', { class: 'card fixed fixed-acct' },
          h('h2', {}, `${month} 카드/계좌별`),
          byAccount.size
            ? barChart([...byAccount.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({
              label, value, color: ACCOUNT_COLORS[accounts.indexOf(label) % ACCOUNT_COLORS.length],
            })), { format: won })
            : h('p', { class: 'muted' }, '이 달에는 지출이 없습니다.'))),
      h('div', { class: 'card fixed fixed-month' },
        h('h2', {}, '월별 지출'),
        barChart([...monthRows].reverse(), { format: won }),
        h('p', { class: 'muted' }, '막대 색은 카테고리 구성입니다. 최근 달이 위에 있습니다.'))),
    h('p', { class: 'muted' }, '카드대금·저축·받은 돈은 지출에서 제외했습니다(이중 집계 방지). 취소는 원래 결제에서 차감했습니다.'),
    detailCard,
    unclassifiedCard(ctx));
}

// 날짜는 2026-08-04 / 20260804 / 0804 어느 쪽으로 검색해도 맞도록 여러 형태를 같이 넣는다.
function searchText(t) {
  const d = t.date;
  return [d, d.replace(/-/g, ''), d.slice(5).replace('-', ''), t.merchant, t.memo || '', t.category ?? '기타', t.account || '', String(Math.abs(t.amount))]
    .join(' ').toLowerCase();
}

const MAX_ROWS = 500;

// 메모 입력 팝업(모달). 저장하면 onSave(메모 문자열)을 부른다.
function openMemoDialog(t, onSave) {
  const dlg = h('dialog', { class: 'memo-dialog' });
  const area = h('textarea', { rows: 5, maxlength: 500, placeholder: '예: 장모님과 함께 / 출장 경비 / 환불 예정' });
  area.value = t.memo || '';
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.append(
    h('h3', { style: 'margin-top:0' }, '메모'),
    h('p', { class: 'muted' }, `${t.date} · ${t.merchant} · ${won(t.amount)}`),
    area,
    h('div', { class: 'row', style: 'justify-content:flex-end' },
      t.memo ? h('button', { class: 'danger', onclick: () => { onSave(''); close(); } }, '메모 삭제') : null,
      h('button', { class: 'ghost', onclick: close }, '취소'),
      h('button', { class: 'primary', onclick: () => { onSave(area.value); close(); } }, '저장')));
  dlg.addEventListener('cancel', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); }); // 바깥 클릭으로 닫기
  document.body.append(dlg);
  dlg.showModal();
  area.focus();
}

function buildDetailCard(ctx, expenses, month) {
  const { ui } = ctx;
  const holder = h('div', {});
  const summary = h('p', { class: 'muted' });
  const search = h('input', { type: 'search', placeholder: '검색: 가맹점·메모·카테고리·날짜(0804)·금액', value: ui.query || '', style: 'min-width:260px' });
  const title = h('span', {});

  function saveMemo(t, value) {
    const target = t.origin || t; // 할부 나누기로 만든 조각이면 원래 거래에 저장한다
    const memo = value.trim();
    if (memo) target.memo = memo; else delete target.memo;
    t.memo = target.memo;
    ctx.save();
  }

  // 카테고리 변경: 기본은 이 거래 하나만, 체크하면 같은 가맹점 전체에 적용하고 규칙으로 기억한다.
  async function changeCategory(t, value) {
    const category = value || null;
    const target = t.origin || t;
    if (ui.applyAll && category) {
      ctx.data.rules = learn(ctx.data.rules, target.merchant, category);
      const key = merchantKey(target.merchant);
      ctx.data.transactions.forEach((x) => { if (x.kind === 'expense' && merchantKey(x.merchant) === key) x.category = category; });
    } else {
      target.category = category;
    }
    const y = window.scrollY;
    await ctx.commit();
    window.scrollTo(0, y);
  }

  function draw() {
    const terms = (ui.query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const searching = terms.length > 0;
    let list = searching
      ? expenses.filter((t) => { const text = searchText(t); return terms.every((w) => text.includes(w)); })
      : expenses.filter((t) => t.date.startsWith(month));
    list = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
    const net = list.filter((t) => !t.canceled).reduce((s, t) => s + t.amount, 0);
    title.textContent = searching ? `검색 결과 ${list.length}건` : `${month} 지출 내역 ${list.length}건`;
    summary.textContent = (searching ? `전체 기간에서 찾았습니다 · ` : '') + `합계 ${won(net)} · 취소 거래는 마이너스 금액으로 원래 결제와 상쇄됩니다. 메모 칸에 적으면 검색됩니다.`;
    const shown = list.slice(0, MAX_ROWS);
    const detailTable = table(['날짜', '가맹점', '금액', '카테고리', '카드/계좌', '메모'], shown.map((t) => [
        t.date, t.merchant + (t.amount < 0 ? ' (취소)' : ''), won(t.amount), 
        h('select', { class: 'cat-select', style: `--c:${categoryColor(t.category ?? '기타')}`, onchange: (e) => changeCategory(t, e.target.value) },
          h('option', { value: '', selected: !t.category }, '미분류(기타)'),
          CATEGORIES.map((c) => h('option', { value: c, selected: c === t.category }, c))),
        t.account || '(이름 없음)',
        h('button', { class: 'ghost memo-btn', title: t.memo || '메모 추가',
          onclick: () => openMemoDialog(t, (value) => { saveMemo(t, value); draw(); }) }, t.memo || '＋ 메모'),
      ]));
    detailTable.classList.add('center');
    holder.replaceChildren(
      detailTable,
      list.length > MAX_ROWS ? h('p', { class: 'muted' }, `앞의 ${MAX_ROWS}건만 보여 줍니다. 검색어를 더 구체적으로 입력해 보세요.`) : null);
  }

  search.addEventListener('input', () => { ui.query = search.value; draw(); });
  draw();
  const details = h('details', { class: 'card' },
    h('summary', {}, title),
    h('div', { class: 'row' }, search,
      h('button', { class: 'ghost', onclick: () => { ui.query = ''; search.value = ''; draw(); } }, '검색 지우기')),
    h('label', { class: 'muted' },
      h('input', { type: 'checkbox', checked: !!ui.applyAll, onchange: (e) => { ui.applyAll = e.target.checked; } }),
      ' 카테고리를 바꿀 때 같은 가맹점 전체에 적용하고 규칙으로 기억하기 (끄면 이 거래 하나만 바뀝니다)'),
    summary, holder);
  details.open = ui.detailOpen !== false; // 기본은 펼침, 접으면 다음 화면에서도 접힌 채 유지
  details.addEventListener('toggle', () => { ui.detailOpen = details.open; });
  return details;
}

export function exportLedger(txs) {
  const rows = [['날짜', '가맹점', '금액', '카테고리', '계좌', '메모']];
  txs.filter((t) => t.kind === 'expense' && !t.canceled).sort((a, b) => a.date.localeCompare(b.date))
    .forEach((t) => rows.push([t.date, t.merchant, t.amount, t.category ?? '기타', t.account, t.memo ?? '']));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '가계부');
  XLSX.writeFile(wb, '가계부.xlsx');
}
