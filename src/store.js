import { SCHEMA_VERSION } from './constants.js';

export const dedupeKey = (t) => `${t.date}|${t.merchant}|${t.amount}|${t.account}`;

const keyWith = (t, account) => `${t.date}|${t.merchant}|${t.amount}|${account}`;

// 같은 키의 거래는 개수만큼만 합친다: 같은 파일 안의 동일 거래 2건은 둘 다 남고,
// 겹치는 기간의 파일을 다시 올리거나 같은 파일을 다시 올리면 늘지 않는다.
// 그룹(카드/계좌) 이름을 바꾼 거래는 원래 이름(origAccount)으로도 맞춰 보므로, 옛 이름으로 다시 올려도 늘지 않는다.
export function mergeTransactions(existing, incoming) {
  const index = new Map();
  const add = (k, i) => { if (!index.has(k)) index.set(k, []); index.get(k).push(i); };
  existing.forEach((t, i) => {
    add(dedupeKey(t), i);
    if (t.origAccount !== undefined && t.origAccount !== t.account) add(keyWith(t, t.origAccount), i);
  });
  const used = new Set();
  const fresh = [];
  let duplicates = 0;
  for (const t of incoming) {
    const hit = (index.get(dedupeKey(t)) || []).find((i) => !used.has(i));
    if (hit !== undefined) { used.add(hit); duplicates++; } else fresh.push(t);
  }
  return { merged: [...existing, ...fresh], added: fresh.length, duplicates };
}

// a에서 b에 있는 만큼(키별 개수) 뺀 나머지.
export function subtractTransactions(a, b) {
  const left = new Map();
  for (const t of b) left.set(dedupeKey(t), (left.get(dedupeKey(t)) || 0) + 1);
  return a.filter((t) => {
    const k = dedupeKey(t);
    if (left.get(k) > 0) { left.set(k, left.get(k) - 1); return false; }
    return true;
  });
}

const groupByKey = (list) => {
  const m = new Map();
  for (const t of list) { const k = dedupeKey(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  return m;
};

// 마지막으로 맞춘 시점(base)에서 이 컴퓨터가 바꾼 것(추가·삭제·분류/메모 수정)만 폴더의 최신 데이터(remote)에 얹는다.
// 그래서 다른 컴퓨터가 먼저 저장했어도, 여기서 지운 거래가 되살아나지 않고 거기서 올린 거래도 사라지지 않는다.
export function threeWayMerge(base, local, remote) {
  const addedLocal = subtractTransactions(local, base);
  const removedLocal = subtractTransactions(base, local);
  const kept = subtractTransactions(remote, removedLocal);

  // 같은 거래의 카테고리·메모를 이 컴퓨터에서 고쳤다면 그 수정을 따른다.
  const baseBy = groupByKey(base), localBy = groupByKey(local);
  const edits = new Map();
  for (const [k, list] of localBy) {
    list.forEach((lt, i) => {
      const bt = baseBy.get(k)?.[i];
      if (bt && (lt.category !== bt.category || lt.memo !== bt.memo)) edits.set(`${k}#${i}`, { category: lt.category, memo: lt.memo });
    });
  }
  const seen = new Map();
  const patched = kept.map((t) => {
    const k = dedupeKey(t), i = seen.get(k) || 0;
    seen.set(k, i + 1);
    const e = edits.get(`${k}#${i}`);
    if (!e) return t;
    const next = { ...t, category: e.category };
    if (e.memo) next.memo = e.memo; else delete next.memo;
    return next;
  });
  const m = mergeTransactions(patched, addedLocal);
  return { merged: m.merged, added: m.added };
}

// 저장 형식이 바뀌면 여기서 버전별 변환을 추가한다. 현재는 v1뿐이다.
export function migrate(record) {
  return { ...record, schemaVersion: SCHEMA_VERSION };
}

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export function validateBackup(obj) {
  if (!isObj(obj)) return { ok: false, error: '백업 파일 형식이 아닙니다.' };
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: '지원하지 않는 버전의 백업입니다.' };
  }
  if (!Array.isArray(obj.transactions)) return { ok: false, error: '거래 내역이 없습니다.' };
  if (!isObj(obj.rules) || !isObj(obj.settings)) return { ok: false, error: '규칙 또는 설정이 없습니다.' };
  return { ok: true };
}

export const exportBackup = (state) =>
  JSON.stringify({ schemaVersion: SCHEMA_VERSION, transactions: state.transactions, rules: state.rules, settings: state.settings });

// 검증에 실패하면 현재 상태를 그대로 돌려준다(기존 데이터를 덮어쓰지 않는다).
export function importBackup(json, currentState) {
  let obj;
  try { obj = JSON.parse(json); } catch { return { state: currentState, error: '백업 파일을 읽을 수 없습니다.' }; }
  const v = validateBackup(obj);
  if (!v.ok) return { state: currentState, error: v.error };
  const m = migrate(obj);
  return { state: { transactions: m.transactions, rules: m.rules, settings: m.settings } };
}
