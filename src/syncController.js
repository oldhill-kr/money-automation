// 저장 위치 모드(browser/local/cloud)와 폴더 동기화를 다룬다. 화면 조각은 ctx를 통해서만 건드린다.
import { getMeta, setMeta } from './db.js';
import { folderSupported, hasPermission, pickFolder, pullIfNewer, pushToFolder, readFolder } from './folderStore.js';
import { mergeTransactions } from './store.js';

export const MODES = {
  browser: { label: '브라우저 안에만', lock: '🔒 파일은 내 컴퓨터 밖으로 나가지 않아요' },
  local: { label: '내 PC 폴더 (로컬 모드)', lock: '🔒 파일은 내 PC 폴더에만 저장돼요' },
  cloud: { label: '구글 드라이브 폴더 (클라우드 모드)', lock: '☁ 구글 드라이브 폴더에 저장돼요' },
};

const META_KEY = 'sync';
const BASE_KEY = 'syncBase';
const fresh = () => ({ mode: 'browser', handle: null, folderName: '', revision: 0, savedAt: null, dirty: false, connected: true, base: null });

// 마지막으로 폴더와 맞춘 시점의 거래 목록. 충돌 때 "내가 바꾼 것"만 골라내는 기준이다.
async function saveBase(ctx, transactions) {
  ctx.sync.base = transactions;
  try { await setMeta(BASE_KEY, transactions); } catch { /* 없으면 합치기만 한다 */ }
}

async function persist(ctx) {
  const { mode, handle, folderName, revision, savedAt, dirty } = ctx.sync;
  try { await setMeta(META_KEY, { mode, handle, folderName, revision, savedAt, dirty }); } catch { /* 캐시일 뿐이라 화면은 계속 쓴다 */ }
}

const isFolderMode = (ctx) => ctx.sync.mode !== 'browser' && ctx.sync.handle;

// 실행 직후: 저장된 모드를 복원하고, 권한이 살아 있으면 폴더의 최신 데이터를 가져온다.
export async function initSync(ctx) {
  ctx.sync = fresh();
  let meta;
  try { meta = await getMeta(META_KEY); } catch { meta = null; }
  if (!meta || meta.mode === 'browser' || !meta.handle || !folderSupported()) { ctx.refreshLock(); return; }
  Object.assign(ctx.sync, meta, { connected: false });
  try { ctx.sync.base = (await getMeta(BASE_KEY)) || null; } catch { ctx.sync.base = null; }
  try {
    if (await hasPermission(meta.handle, false)) await attach(ctx);
  } catch (e) { ctx.alert(`폴더를 읽지 못했습니다: ${e.message}`); }
  ctx.refreshLock();
}

// 권한이 있는 상태에서 폴더와 브라우저 데이터를 맞춘다.
async function attach(ctx) {
  const { handle } = ctx.sync;
  const remote = await readFolder(handle);
  if (!remote) {
    ctx.sync.connected = true;
    await pushOut(ctx, { force: true }); // 빈 폴더면 현재 데이터를 내려놓는다
    return;
  }
  if (ctx.sync.dirty) {
    // 연결이 끊긴 동안 이 컴퓨터에서도 고쳤다: 거래는 합치고 설정은 폴더를 따른다.
    ctx.sync.connected = true;
    await pushOut(ctx);
    return;
  }
  ctx.setData(remote.state);
  Object.assign(ctx.sync, { connected: true, revision: remote.revision, savedAt: remote.savedAt });
  await saveBase(ctx, ctx.data.transactions);
  await persist(ctx);
}

// 데이터가 바뀔 때마다 main.js의 save()가 부른다. 연달아 불려도 한 번에 하나씩 처리한다.
let queue = Promise.resolve();
export function pushSync(ctx, opts = {}) {
  queue = queue.then(() => pushOut(ctx, opts)).catch(() => {});
  return queue;
}

async function pushOut(ctx, opts = {}) {
  if (!isFolderMode(ctx)) return;
  const s = ctx.sync;
  if (!s.connected) { s.dirty = true; await persist(ctx); ctx.refreshLock(); return; }
  try {
    const r = await pushToFolder(s.handle, ctx.data, s.revision, { ...opts, base: s.base });
    Object.assign(s, { revision: r.revision, savedAt: r.savedAt, dirty: false });
    await saveBase(ctx, r.state.transactions);
    if (r.merged) {
      ctx.setData(r.state);
      ctx.alert(`다른 컴퓨터에서 저장한 내용과 합쳤어요(새로 들어온 거래 ${r.added}건).`);
      ctx.refresh();
    }
  } catch (e) {
    s.dirty = true;
    ctx.alert(`폴더에 저장하지 못했습니다: ${e.message} 이 브라우저에는 저장돼 있고, 연결되면 다시 맞춥니다.`);
  }
  await persist(ctx);
  ctx.refreshLock();
}

// 다른 컴퓨터가 먼저 저장했는지 보고, 그렇다면 그 내용으로 바꾼다(창으로 돌아올 때 부른다).
export async function refreshFromFolder(ctx) {
  const s = ctx.sync;
  if (!isFolderMode(ctx) || !s.connected || s.dirty) return;
  try {
    if (!(await hasPermission(s.handle, false))) { s.connected = false; ctx.refreshLock(); return; }
    const remote = await pullIfNewer(s.handle, s.revision);
    if (!remote) return;
    ctx.setData(remote.state);
    Object.assign(s, { revision: remote.revision, savedAt: remote.savedAt });
    await saveBase(ctx, ctx.data.transactions);
    await persist(ctx);
    await ctx.cache();
    ctx.refresh();
  } catch { /* 동기화 도중의 일시적 읽기 실패는 다음 기회에 */ }
}

// 끊어진 연결을 다시 허용한다(브라우저를 다시 열면 폴더 권한을 한 번 더 묻는다). 클릭 동작 안에서만 부른다.
export async function reconnect(ctx) {
  try {
    if (!(await hasPermission(ctx.sync.handle, true))) { ctx.alert('폴더 접근이 허용되지 않았습니다.'); return false; }
    await attach(ctx);
    await ctx.cache();
    ctx.alert(null);
    ctx.refreshLock();
    ctx.refresh();
    return true;
  } catch (e) {
    ctx.alert(`폴더를 연결하지 못했습니다: ${e.message}`);
    return false;
  }
}

// 새 폴더를 골라 연결한다(처음/변경). 클릭 동작 안에서만 부른다.
export async function connectFolder(ctx, mode) {
  if (!folderSupported()) { ctx.alert('이 브라우저는 폴더 저장을 지원하지 않습니다. 크롬이나 엣지를 쓰세요.'); return false; }
  try {
    const handle = await pickFolder(`money-${mode}`);
    const remote = await readFolder(handle);
    const mine = ctx.data.transactions;
    let next = ctx.data;
    if (remote && mine.length) {
      const m = mergeTransactions(remote.state.transactions, mine);
      const ok = confirm(`이 폴더에 이미 가계부 ${remote.state.transactions.length}건이 있고, 이 브라우저에도 ${mine.length}건이 있어요.
두 데이터를 합칠까요? (중복 거래는 자동으로 빼고 ${m.merged.length}건이 됩니다)`);
      if (!ok) return false;
      next = { transactions: m.merged, rules: remote.state.rules, settings: remote.state.settings };
    } else if (remote) {
      next = remote.state;
    }
    ctx.setData(next);
    Object.assign(ctx.sync, { mode, handle, folderName: handle.name, connected: true, dirty: false, revision: remote ? remote.revision : 0 });
    // 폴더에 데이터가 없거나 합친 결과를 내려놓을 때는 그대로 쓴다(이미 폴더 데이터를 가져왔다면 한 번 더 쓸 뿐이다).
    await pushOut(ctx, { force: true });
    await ctx.cache();
    ctx.alert(null);
    ctx.refreshLock();
    ctx.refresh();
    return true;
  } catch (e) {
    if (e?.name !== 'AbortError') ctx.alert(`폴더를 연결하지 못했습니다: ${e.message}`);
    return false;
  }
}

// 브라우저 안에만 저장으로 돌아간다. 폴더의 파일은 그대로 두고 연결만 끊는다.
export async function useBrowserOnly(ctx) {
  ctx.sync = fresh();
  await persist(ctx);
  ctx.refreshLock();
  ctx.refresh();
}
