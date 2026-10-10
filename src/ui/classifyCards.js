import { h, won, table } from './dom.js';
import { learn, forget, classify, merchantKey } from '../classifier.js';
import { CATEGORIES } from '../constants.js';

const catSelect = (onpick, placeholder = '고르기', current = '') =>
  h('select', { onchange: (e) => e.target.value && onpick(e.target.value) },
    h('option', { value: '' }, placeholder),
    CATEGORIES.map((c) => h('option', { value: c, selected: c === current }, c)));

// 지점 표기만 다른 가맹점을 한 묶음으로 보여 준다. 금액 큰 순.
export function unknownGroups(txs) {
  const groups = new Map();
  for (const t of txs) {
    if (t.kind !== 'expense' || t.category) continue;
    const key = merchantKey(t.merchant);
    const g = groups.get(key) || { key, names: new Set(), count: 0, total: 0 };
    g.names.add(t.merchant);
    g.count += 1;
    g.total += t.amount;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

// 규칙을 바꾸면 같은 키의 모든 지출 거래에 적용한다.
function setCategory(ctx, keys, category) {
  const set = new Set(keys);
  for (const key of keys) ctx.data.rules = learn(ctx.data.rules, key, category);
  ctx.data.transactions.forEach((t) => {
    if (t.kind === 'expense' && set.has(merchantKey(t.merchant))) t.category = category;
  });
  return ctx.commit();
}

export function unclassifiedCard(ctx) {
  const groups = unknownGroups(ctx.data.transactions);
  if (!groups.length) return null;
  const selected = new Set();
  const boxes = [];
  const info = h('span', { class: 'muted' }, '0곳 선택');
  const refresh = () => { info.textContent = `${selected.size}곳 선택`; };

  const rows = groups.map((g) => {
    const box = h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? selected.add(g.key) : selected.delete(g.key); refresh(); } });
    box.dataset.key = g.key;
    boxes.push(box);
    const names = [...g.names];
    const label = names[0] + (names.length > 1 ? ` 외 ${names.length - 1}개 표기` : '');
    return [box, label, `${g.count}건`, won(g.total), catSelect((c) => setCategory(ctx, [g.key], c))];
  });

  const bulk = catSelect((c) => {
    if (!selected.size) { ctx.alert('분류할 가맹점을 먼저 체크해 주세요.'); return; }
    ctx.alert(null);
    setCategory(ctx, [...selected], c);
  }, '선택한 곳을 한 번에 분류…');

  const toggleAll = h('button', { class: 'ghost', onclick: () => {
    const all = selected.size < groups.length;
    boxes.forEach((b) => { b.checked = all; });
    selected.clear();
    if (all) groups.forEach((g) => selected.add(g.key));
    refresh();
  } }, '전체 선택/해제');

  return h('div', { class: 'card' },
    h('h2', {}, `분류가 필요한 가맹점 ${groups.length}곳`),
    h('p', { class: 'muted' }, '금액이 큰 순서입니다. 체크한 뒤 위 선택 상자에서 카테고리를 고르면 한 번에 분류되고, 이후 같은 가맹점(지점명이 달라도)은 자동 분류됩니다.'),
    h('div', { class: 'row' }, toggleAll, bulk, info),
    table(['선택', '가맹점', '건수', '합계', '개별 분류'], rows));
}

export function rulesCard(ctx) {
  const entries = Object.entries(ctx.data.rules.categories || {}).sort((a, b) => a[0].localeCompare(b[0], 'ko'));
  const keywords = Object.entries(ctx.data.rules.keywords || {});
  if (!entries.length && !keywords.length) return null;
  const kwRows = keywords.map(([kw, category]) => [
    `'${kw}' 포함`,
    category,
    h('button', { class: 'ghost', onclick: () => {
      const next = { ...ctx.data.rules.keywords };
      delete next[kw];
      ctx.data.rules = { ...ctx.data.rules, keywords: next };
      ctx.commit();
    } }, '규칙 삭제'),
  ]);
  const rows = entries.map(([key, category]) => [
    key,
    catSelect((c) => setCategory(ctx, [key], c), '', category),
    h('button', { class: 'ghost', onclick: () => {
      ctx.data.rules = forget(ctx.data.rules, key);
      ctx.data.transactions.forEach((t) => {
        if (t.kind === 'expense' && (t.merchant === key || merchantKey(t.merchant) === key)) t.category = classify(t, ctx.data.rules).category;
      });
      ctx.commit();
    } }, '규칙 삭제'),
  ]);
  const body = table(['가맹점(지점명 제외)', '카테고리', ''], [...kwRows, ...rows]);
  const filter = h('input', { type: 'text', placeholder: '가맹점 검색', oninput: (e) => {
    const q = e.target.value.trim().toLowerCase();
    [...body.tBodies[0].rows].forEach((r) => { r.hidden = q && !r.cells[0].textContent.toLowerCase().includes(q); });
  } });
  return h('details', { class: 'card' },
    h('summary', {}, `내가 정한 분류 규칙 ${entries.length + keywords.length}개 (보기·수정·삭제)`),
    h('p', { class: 'muted' }, '카테고리를 바꾸면 그 가맹점의 모든 거래가 바뀝니다. 삭제하면 기본 키워드 분류로 돌아갑니다.'),
    filter, body);
}

// 키워드 일괄 분류: 가맹점명에 키워드가 들어간 모든 지출을 한 카테고리로 묶고, 앞으로의 거래에도 적용한다.
export function keywordCard(ctx) {
  const input = h('input', { type: 'text', placeholder: '가맹점명에 포함된 단어 (예: 주유소)', style: 'min-width:220px' });
  const result = h('span', { class: 'muted' }, ctx.ui.kwMsg || '');
  ctx.ui.kwMsg = '';
  const pick = h('select', {}, h('option', { value: '' }, '카테고리 선택'), CATEGORIES.map((c) => h('option', { value: c }, c)));
  const apply = h('button', { class: 'primary', onclick: async () => {
    const kw = input.value.trim();
    if (!kw || !pick.value) { result.textContent = '단어와 카테고리를 모두 골라 주세요.'; return; }
    const lower = kw.toLowerCase();
    const hit = (m) => String(m || '').toLowerCase().includes(lower);
    let count = 0;
    ctx.data.transactions.forEach((t) => {
      if (t.kind === 'expense' && hit(t.merchant)) { t.category = pick.value; count += 1; }
    });
    // 키워드가 들어간 예전 가맹점별 규칙은 지워서, 이번 지정이 앞으로도 우선하도록 한다.
    const cats = { ...(ctx.data.rules.categories || {}) };
    Object.keys(cats).forEach((k) => { if (hit(k)) delete cats[k]; });
    ctx.data.rules = { ...ctx.data.rules, categories: cats, keywords: { ...(ctx.data.rules.keywords || {}), [kw]: pick.value } };
    ctx.alert(null);
    ctx.ui.kwMsg = `'${kw}' 포함 거래 ${count}건을 ${pick.value}(으)로 분류했습니다.`;
    const y = window.scrollY;
    await ctx.commit();
    window.scrollTo(0, y);
  } }, '적용');
  return h('div', { class: 'card' },
    h('h2', {}, '키워드로 한 번에 분류'),
    h('p', { class: 'muted' }, '가맹점명에 단어가 포함된 모든 거래를 한 카테고리로 바꾸고, 앞으로 올리는 파일에도 자동 적용합니다.'),
    h('div', { class: 'row' }, input, pick, apply, result),
    h('hr', {}),
    h('p', { class: 'muted' }, '기본 분류 규칙이 새로 추가·변경됐을 때 이미 올린 거래에도 적용하려면 아래 버튼을 누르세요. 규칙에 걸리는 거래는 직접 바꿔 둔 카테고리도 규칙대로 덮어씁니다(규칙에 안 걸리는 거래는 그대로).'),
    h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: async () => {
      if (!confirm('모든 지출을 현재 분류 규칙으로 다시 분류합니다. 직접 바꿔 둔 카테고리도 규칙에 걸리면 바뀝니다. 계속할까요?')) return;
      let changed = 0;
      ctx.data.transactions.forEach((t) => {
        if (t.kind !== 'expense') return;
        const c = classify(t, ctx.data.rules);
        if (c.kind === 'expense' && c.category && c.category !== t.category) { t.category = c.category; changed += 1; }
      });
      ctx.ui.kwMsg = `${changed}건의 카테고리를 다시 분류했습니다.`;
      const y = window.scrollY;
      await ctx.commit();
      window.scrollTo(0, y);
    } }, '전체 거래 다시 분류')));
}
