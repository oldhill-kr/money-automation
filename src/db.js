// 브라우저 IndexedDB 래퍼. 계산 코드는 이 파일을 모른다. 저장 실패는 throw해서 화면이 경고하게 한다.
import { SCHEMA_VERSION } from './constants.js';
import { migrate } from './store.js';

const DB = 'money-automation', STORE = 'kv';
const KEYS = ['transactions', 'rules', 'settings'];

const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const wait = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function loadState() {
  const db = await open();
  try {
    const store = db.transaction(STORE).objectStore(STORE);
    const [transactions, rules, settings] = await Promise.all(KEYS.map((k) => wait(store.get(k))));
    const version = await wait(store.get('schemaVersion'));
    const state = { transactions: transactions || [], rules: rules || {}, settings: settings || {} };
    // 저장된 형식이 구버전이면 migrate가 변환한다(현재는 v1뿐).
    return version && version < SCHEMA_VERSION ? migrate(state) : state;
  } finally { db.close(); }
}

// 저장 위치 설정(모드, 폴더 핸들, 마지막 revision)은 데이터와 별도 키에 둔다. 폴더 핸들도 IndexedDB에 담긴다.
export async function getMeta(key) {
  const db = await open();
  try { return await wait(db.transaction(STORE).objectStore(STORE).get(key)); } finally { db.close(); }
}

export async function setMeta(key, value) {
  const db = await open();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error); });
  } finally { db.close(); }
}

export async function saveState(state) {
  const db = await open();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    KEYS.forEach((k) => store.put(state[k], k));
    store.put(SCHEMA_VERSION, 'schemaVersion');
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error); });
  } finally { db.close(); }
}
