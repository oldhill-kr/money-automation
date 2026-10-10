import { loadState, saveState } from './db.js';
import { h } from './ui/dom.js';
import * as upload from './ui/upload.js';
import * as ledgerTab from './ui/ledgerTab.js';
import * as leaksTab from './ui/leaksTab.js';
import * as cardTab from './ui/cardTab.js';
import * as taxTab from './ui/taxTab.js';
import * as splitTab from './ui/splitTab.js';
import * as settings from './ui/settings.js';

const TABS = [
  ['upload', '업로드', upload], ['ledger', '가계부', ledgerTab], ['leaks', '새는 돈', leaksTab],
  ['card', '카드 실적', cardTab], ['tax', '연말정산', taxTab], ['split', '통장·브리핑', splitTab], ['settings', '설정', settings],
];

export const DEFAULT_SETTINGS = {
  annualSalary: 0, emergencyNow: 0, emergencyRatio: 0.4, cancelled: [],
  cardRule: { name: '', minPrevMonthSpend: 300000, benefits: { 카페: 0.1, 배달: 0.05, 교통: 0.1 }, accounts: [] },
  glasses: 0, donation: 0, gymAmount: 0,
};

const ctx = {
  data: { transactions: [], rules: { categories: {}, mappings: {} }, settings: DEFAULT_SETTINGS },
  ui: { tab: 'upload' },
  async save() {
    try { await saveState(ctx.data); ctx.alert(null); } catch (e) {
      ctx.alert('브라우저에 저장하지 못했습니다(시크릿 모드이거나 저장 공간이 부족할 수 있어요). 설정 탭에서 백업 파일을 내려받아 두세요.');
    }
  },
  async commit() { await ctx.save(); render(); },
  alert(msg) {
    const el = document.getElementById('alert');
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  },
  go(tab) { ctx.ui.tab = tab; render(); },
  // 백업을 불러오거나 데모를 넣을 때 기본값을 채워 넣는다.
  setData(next) { ctx.data = normalize(next); },
};

export function normalize(d) {
  return {
    transactions: d.transactions || [],
    rules: { categories: {}, mappings: {}, ...(d.rules || {}) },
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}), cardRule: { ...DEFAULT_SETTINGS.cardRule, ...(d.settings?.cardRule || {}) } },
  };
}

function render() {
  const nav = document.getElementById('tabs');
  nav.replaceChildren(...TABS.map(([id, label]) =>
    h('button', { class: id === ctx.ui.tab ? 'active' : '', onclick: () => ctx.go(id) }, label)));
  const view = document.getElementById('view');
  view.replaceChildren();
  const mod = TABS.find(([id]) => id === ctx.ui.tab)[2];
  mod.render(view, ctx);
}

try {
  ctx.data = normalize(await loadState());
  if (ctx.data.transactions.length) ctx.ui.tab = 'ledger';
} catch (e) {
  ctx.alert('저장된 데이터를 불러오지 못했습니다. 이 브라우저에서는 저장이 안 될 수 있어요.');
}
render();
