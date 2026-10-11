// 사용자가 고른 폴더(내 PC 폴더 또는 구글 드라이브 데스크톱 폴더)에 가계부 데이터를 파일로 둔다.
// 폴더 읽기·쓰기만 다루고 화면은 모른다. dir은 FileSystemDirectoryHandle(테스트에서는 같은 모양의 가짜).
import { exportBackup, mergeTransactions, migrate, validateBackup } from './store.js';

export const DATA_FILE = 'money-data.json';
export const PREV_FILE = 'money-data.prev.json';

export const folderSupported = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

async function readText(dir, name) {
  try {
    const fh = await dir.getFileHandle(name);
    return await (await fh.getFile()).text();
  } catch (e) {
    if (e?.name === 'NotFoundError') return null;
    throw e;
  }
}

async function writeText(dir, name, text) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable(); // 닫을 때 한 번에 교체되므로 쓰다 끊겨도 기존 파일은 남는다
  await w.write(text);
  await w.close();
}

// 폴더에 저장된 데이터. 없으면 null, 파일이 깨졌으면 throw(덮어쓰지 않도록 호출한 쪽이 멈춘다).
export async function readFolder(dir) {
  const text = await readText(dir, DATA_FILE);
  if (text == null) return null;
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error(`${DATA_FILE} 파일을 읽을 수 없습니다(동기화 중이거나 손상됨).`); }
  const v = validateBackup(obj);
  if (!v.ok) throw new Error(`${DATA_FILE}: ${v.error}`);
  const m = migrate(obj);
  return {
    state: { transactions: m.transactions, rules: m.rules, settings: m.settings },
    revision: Number.isInteger(obj.revision) ? obj.revision : 0,
    savedAt: obj.savedAt || null,
  };
}

async function writeFolder(dir, state, revision) {
  const prev = await readText(dir, DATA_FILE);
  if (prev != null) await writeText(dir, PREV_FILE, prev); // 직전 버전을 한 단계 남겨 둔다
  const body = { ...JSON.parse(exportBackup(state)), revision, savedAt: new Date().toISOString() };
  await writeText(dir, DATA_FILE, JSON.stringify(body));
  return body.savedAt;
}

// 저장한다. 내가 마지막으로 본 revision보다 폴더의 revision이 높으면(다른 컴퓨터가 먼저 저장)
// 거래는 중복 없이 합치고 규칙·설정은 폴더 쪽을 따른다. force면 무조건 내 데이터로 덮어쓴다(전체 삭제·백업 복원).
export async function pushToFolder(dir, state, knownRevision, { force = false } = {}) {
  const remote = await readFolder(dir);
  if (remote && remote.revision > knownRevision && !force) {
    const m = mergeTransactions(remote.state.transactions, state.transactions);
    const merged = { transactions: m.merged, rules: remote.state.rules, settings: remote.state.settings };
    const revision = remote.revision + 1;
    const savedAt = await writeFolder(dir, merged, revision);
    return { state: merged, revision, savedAt, merged: true, added: m.added };
  }
  const revision = Math.max(knownRevision, remote?.revision || 0) + 1;
  const savedAt = await writeFolder(dir, state, revision);
  return { state, revision, savedAt, merged: false, added: 0 };
}

// 폴더가 더 새 것이면 그 내용을, 아니면 null.
export async function pullIfNewer(dir, knownRevision) {
  const remote = await readFolder(dir);
  return remote && remote.revision > knownRevision ? remote : null;
}

// 클릭 같은 사용자 동작 안에서만 ask=true로 부른다(권한 팝업은 동작 없이 못 띄운다).
export async function hasPermission(handle, ask = false) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return ask && (await handle.requestPermission(opts)) === 'granted';
}

export const pickFolder = (id) => window.showDirectoryPicker({ id, mode: 'readwrite', startIn: 'documents' });
