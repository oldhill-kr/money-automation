import { loadState, saveState } from './db.js';
import { h } from './ui/dom.js';
import { negateCancel } from './parser.js';
import { classify } from './classifier.js';
import { MODES, initSync, pushSync, reconnect, refreshFromFolder } from './syncController.js';
import * as upload from './ui/upload.js';
import * as ledgerTab from './ui/ledgerTab.js';
import * as leaksTab from './ui/leaksTab.js';
import * as cardTab from './ui/cardTab.js';
import * as taxTab from './ui/taxTab.js';
import * as splitTab from './ui/splitTab.js';
import * as monthlyTab from './ui/monthlyBriefingTab.js';
import * as settings from './ui/settings.js';
import { initThemeButton } from './theme.js';
import { renderToolbar } from './ui/toolbar.js';

const TABS = [
  ['ledger', '① 가계부', ledgerTab], ['leaks', '② 새는 돈', leaksTab], ['card', '③ 카드 실적', cardTab],
  ['tax', '④ 연말정산', taxTab], ['split', '⑤ 통장 쪼개기', splitTab], ['monthly', '⑥ 월간 브리핑', monthlyTab],
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
  sync: null, // initSync가 채운다: 저장 위치 모드와 폴더 핸들
  // 브라우저 저장소는 모든 모드에서 캐시로 계속 쓴다. 폴더 모드면 이어서 폴더에도 쓴다.
  async cache() {
    try { await saveState(ctx.data); ctx.alert(null); } catch (e) {
      ctx.alert('브라우저에 저장하지 못했습니다(시크릿 모드이거나 저장 공간이 부족할 수 있어요). 설정·백업 탭에서 백업 파일을 내려받아 두세요.');
    }
  },
  // opts.force: 폴더의 더 새 데이터가 있어도 이 컴퓨터 데이터로 덮어쓴다(전체 삭제·백업 복원처럼 의도적인 교체).
  async save(opts) { await ctx.cache(); await pushSync(ctx, opts); },
  async commit(opts) { await ctx.save(opts); render(); },
  refresh() { render(); },
  // 상단 배지와 "연결 끊김" 안내를 현재 저장 모드에 맞춘다.
  refreshLock() {
    const s = ctx.sync;
    document.getElementById('lock').textContent = MODES[s?.mode || 'browser'].lock;
    const bar = document.getElementById('sync-bar');
    const cut = s && s.mode !== 'browser' && s.handle && !s.connected;
    bar.classList.toggle('hidden', !cut);
    bar.replaceChildren();
    if (cut) {
      bar.append(`'${s.folderName}' 폴더 연결이 끊겼어요. 지금 고친 내용은 이 브라우저에만 저장됩니다. `,
        h('button', { class: 'ghost', onclick: () => reconnect(ctx) }, '폴더 다시 허용'));
    }
  },
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
  renderToolbar(document.getElementById('toolbar'), ctx);
  const view = document.getElementById('view');
  view.replaceChildren();
  TABS.find(([id]) => id === ctx.ui.tab)[2].render(view, ctx);
}

// 업로드 상자는 탭을 바꿔도 다시 그리지 않는다(여러 파일을 올리는 중이어도 대기열이 유지되게).
initThemeButton(document.getElementById('btn-theme'));
// 파일 업로드는 버튼으로 여는 팝업 안에 둔다. 업로드가 끝나면 닫는다.
const uploadDialog = document.getElementById('upload-dialog');
ctx.openUpload = () => { if (!uploadDialog.open) uploadDialog.showModal(); };
ctx.closeUpload = () => { if (uploadDialog.open) uploadDialog.close(); };
document.getElementById('ud-close').addEventListener('click', ctx.closeUpload);
uploadDialog.addEventListener('click', (e) => { if (e.target === uploadDialog) ctx.closeUpload(); });
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
await initSync(ctx);
render();

// 다른 컴퓨터에서 고친 내용을 이 창으로 돌아올 때 가져온다.
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshFromFolder(ctx); });
window.addEventListener('focus', () => refreshFromFolder(ctx));
