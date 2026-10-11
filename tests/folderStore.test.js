import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_FILE, PREV_FILE, pullIfNewer, pushToFolder, readFolder } from '../src/folderStore.js';

// FileSystemDirectoryHandle과 같은 모양의 메모리 폴더
function fakeDir(files = {}) {
  return {
    files,
    async getFileHandle(name, { create } = {}) {
      if (!(name in files)) {
        if (!create) throw Object.assign(new Error('없음'), { name: 'NotFoundError' });
        files[name] = '';
      }
      return {
        async getFile() { return { text: async () => files[name] }; },
        async createWritable() { let buf = ''; return { write: async (t) => { buf += t; }, close: async () => { files[name] = buf; } }; },
      };
    },
  };
}
const tx = (o = {}) => ({ date: '2026-06-01', merchant: '스타벅스', amount: 4800, account: 'A', source: 'a.xlsx', ...o });
const state = (transactions, settings = {}) => ({ transactions, rules: { categories: {}, mappings: {} }, settings });

test('빈 폴더는 null, 저장하면 읽힌다', async () => {
  const dir = fakeDir();
  assert.equal(await readFolder(dir), null);
  const r = await pushToFolder(dir, state([tx()]), 0);
  assert.equal(r.revision, 1);
  const back = await readFolder(dir);
  assert.equal(back.state.transactions.length, 1);
  assert.equal(back.revision, 1);
});

test('저장할 때 직전 파일을 prev로 남긴다', async () => {
  const dir = fakeDir();
  await pushToFolder(dir, state([tx()]), 0);
  await pushToFolder(dir, state([tx(), tx({ date: '2026-06-02' })]), 1);
  assert.equal(JSON.parse(dir.files[PREV_FILE]).transactions.length, 1);
  assert.equal(JSON.parse(dir.files[DATA_FILE]).transactions.length, 2);
});

test('다른 컴퓨터가 먼저 저장했으면 거래는 합치고 설정은 폴더 쪽을 따른다', async () => {
  const dir = fakeDir();
  const a = await pushToFolder(dir, state([tx()], { annualSalary: 1 }), 0); // A 컴퓨터, revision 1
  // B 컴퓨터가 revision 1을 보고 새 거래를 올림
  await pushToFolder(dir, state([tx(), tx({ date: '2026-06-02' })], { annualSalary: 2 }), a.revision);
  // A가 (여전히 revision 1로 알고) 다른 거래를 올림
  const r = await pushToFolder(dir, state([tx(), tx({ date: '2026-06-03' })], { annualSalary: 1 }), a.revision);
  assert.equal(r.merged, true);
  assert.equal(r.added, 1);
  assert.equal(r.state.transactions.length, 3);
  assert.equal(r.state.settings.annualSalary, 2);
  assert.equal(r.revision, 3);
});

test('force면 폴더가 더 새 것이어도 내 데이터로 덮어쓴다', async () => {
  const dir = fakeDir();
  await pushToFolder(dir, state([tx()]), 0);
  await pushToFolder(dir, state([tx(), tx({ date: '2026-06-02' })]), 1);
  const r = await pushToFolder(dir, state([]), 1, { force: true });
  assert.equal(r.merged, false);
  assert.equal((await readFolder(dir)).state.transactions.length, 0);
});

test('pullIfNewer는 폴더가 더 새 것일 때만 돌려준다', async () => {
  const dir = fakeDir();
  await pushToFolder(dir, state([tx()]), 0);
  assert.equal(await pullIfNewer(dir, 1), null);
  assert.equal((await pullIfNewer(dir, 0)).revision, 1);
});

test('깨진 파일은 덮어쓰지 않고 오류를 낸다', async () => {
  const dir = fakeDir({ [DATA_FILE]: '{깨짐' });
  await assert.rejects(() => pushToFolder(dir, state([tx()]), 0), /읽을 수 없습니다/);
  assert.equal(dir.files[DATA_FILE], '{깨짐');
});
