import { loadState, saveState } from './db.js';
import { h } from './ui/dom.js';
import { negateCancel } from './parser.js';
import { classify } from './classifier.js';
import * as upload from './ui/upload.js';
import * as ledgerTab from './ui/ledgerTab.js';
import * as leaksTab from './ui/leaksTab.js';
import * as cardTab from './ui/cardTab.js';
import * as taxTab from './ui/taxTab.js';
import * as splitTab from './ui/splitTab.js';
import * as briefingTab from './ui/briefingTab.js';
import * as settings from './ui/settings.js';

const TABS = [
  ['ledger', '① 가계부', ledgerTab], ['leaks', '② 새는 돈', leaksTab], ['card', '③ 카드 실적', cardTab],
  ['tax', '④ 연말정산', taxTab], ['split', '⑤ 통장 쪼개기', splitTab], ['briefing', '⑥ 주간 브리핑', briefingTab],
  ['settings', '설정·백업', settings],
];

export const DEFAULT_SETTINGS = {
  annualSalary: 0, emergencyNow: 0, emergencyRatio: 0.4, cancelled: [],
  salaryDay: 25, cutPercent: 10, emergencyMonths: 3,
  cardRule: { name: '', minPrevMonthSpend: 300000, benefits: { 카페: 0.1, 배달: 0.05, 교통: 0.1 }, accounts: [] },
  glasses: 0, donation: 0, gymAmount: 0,
};

const ctx = {
  data: { transactions: [], rules: { categories: {}, mappings: {} }, settings: DEFAULT_SETTINGS },
  ui: { tab: 'ledger' },
  async save() {
    try { await saveState(ctx.data); ctx.alert(null); } catch (e) {
      ctx.alert('브라우저에 저장하지 못했습니다(시크릿 모드이거나 저장 공간이 부족할 수 있어요). 설정·백업 탭에서 백업 파일을 내려받아 두세요.');
    }
  },
  async commit() { await ctx.save(); render(); },
  alert(msg) {
    const el = document.getElementById('alert');
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  },
  go(tab) { ctx.ui.tab = tab; render(); },
  // 백업을 불러오거나 데이터를 지울 때 기본값을 채워 넣는다.
  setData(next) { ctx.data = normalize(next); },
};

export function normalize(d) {
  const rules = { categories: {}, mappings: {}, keywords: {}, ...(d.rules || {}) };
  // 예전에 저장된 취소 거래도 마이너스 금액으로 바로잡고, 분류가 비어 있는 지출은 현재 규칙으로 다시 분류한다.
  const transactions = (d.transactions || []).map((raw) => {
    const t = raw.kind === 'expense' || raw.kind === undefined ? negateCancel(raw) : raw;
    if (t.kind === 'expense' && !t.category) {
      const c = classify(t, rules);
      if (c.kind === 'expense' && c.category) return { ...t, category: c.category };
    }
    return t;
  });
  return {
    transactions,
    rules,
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}), cardRule: { ...DEFAULT_SETTINGS.cardRule, ...(d.settings?.cardRule || {}) } },
  };
}

function render() {
  const nav = document.getElementById('tabs');
  nav.replaceChildren(...TABS.map(([id, label]) =>
    h('button', { class: id === ctx.ui.tab ? 'active' : '', onclick: () => ctx.go(id) }, label)));
  const tx = ctx.data.transactions;
  const dates = tx.map((t) => t.date).sort();
  document.getElementById('count').textContent = tx.length ? `${tx.length}건 · ${dates[0]} ~ ${dates[dates.length - 1]}` : '아직 불러온 거래가 없어요';
  document.getElementById('btn-demo').disabled = tx.length > 0;
  const view = document.getElementById('view');
  view.replaceChildren();
  TABS.find(([id]) => id === ctx.ui.tab)[2].render(view, ctx);
}

// 업로드 상자는 탭을 바꿔도 다시 그리지 않는다(여러 파일을 올리는 중이어도 대기열이 유지되게).
upload.render(document.getElementById('drop-area'), ctx);
document.getElementById('btn-demo').addEventListener('click', () => settings.loadDemo(ctx));
document.getElementById('btn-export').addEventListener('click', () => {
  if (!ctx.data.transactions.length) { ctx.alert('저장할 거래가 없습니다.'); return; }
  ctx.alert(null);
  ledgerTab.exportLedger(ctx.data.transactions);
});

try {
  ctx.data = normalize(await loadState());
} catch (e) {
  ctx.alert('저장된 데이터를 불러오지 못했습니다. 이 브라우저에서는 저장이 안 될 수 있어요.');
}
render();
