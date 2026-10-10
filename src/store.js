import { SCHEMA_VERSION } from './constants.js';

export const dedupeKey = (t) => `${t.date}|${t.merchant}|${t.amount}|${t.account}`;

// 같은 키의 거래는 개수만큼만 합친다: 같은 파일 안의 동일 거래 2건은 둘 다 남고,
// 겹치는 기간의 파일을 다시 올리거나 같은 파일을 다시 올리면 늘지 않는다.
export function mergeTransactions(existing, incoming) {
  const left = new Map();
  for (const t of existing) left.set(dedupeKey(t), (left.get(dedupeKey(t)) || 0) + 1);
  const fresh = [];
  let duplicates = 0;
  for (const t of incoming) {
    const k = dedupeKey(t);
    if (left.get(k) > 0) { left.set(k, left.get(k) - 1); duplicates++; } else fresh.push(t);
  }
  return { merged: [...existing, ...fresh], added: fresh.length, duplicates };
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
