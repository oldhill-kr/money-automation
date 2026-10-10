import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeKey, mergeTransactions, migrate, validateBackup, exportBackup, importBackup } from '../src/store.js';

const tx = (o = {}) => ({ date: '2026-06-01', merchant: '스타벅스', amount: 4800, account: 'A', source: 'a.xlsx', ...o });

test('dedupeKey', () => {
  assert.equal(dedupeKey(tx()), '2026-06-01|스타벅스|4800|A');
});

test('같은 파일 안의 동일 거래 2건은 둘 다 남는다', () => {
  const r = mergeTransactions([], [tx(), tx()]);
  assert.equal(r.added, 2);
  assert.equal(r.duplicates, 0);
});

test('다른 파일과 겹치는 거래는 합친다 (4~6월 뒤 6~8월)', () => {
  const first = [tx(), tx(), tx({ date: '2026-05-01' })];
  const second = [tx({ source: 'b.xlsx' }), tx({ source: 'b.xlsx' }), tx({ date: '2026-07-01', source: 'b.xlsx' })];
  const { merged } = mergeTransactions([], first);
  const r = mergeTransactions(merged, second);
  assert.equal(r.added, 1);
  assert.equal(r.duplicates, 2);
  assert.equal(r.merged.length, 4);
});

test('같은 파일을 다시 올려도 늘지 않는다', () => {
  const a = [tx(), tx({ date: '2026-06-02' })];
  const { merged } = mergeTransactions([], a);
  const r = mergeTransactions(merged, a);
  assert.equal(r.added, 0);
  assert.equal(r.merged.length, 2);
});

test('기존 1건, 새 파일 2건이면 1건만 추가', () => {
  const r = mergeTransactions([tx()], [tx({ source: 'b' }), tx({ source: 'b' })]);
  assert.equal(r.added, 1);
});

test('migrate: schemaVersion을 채운다', () => {
  assert.equal(migrate({ transactions: [] }).schemaVersion, 1);
});

const state = { transactions: [tx()], rules: { categories: {} }, settings: {} };

test('백업 왕복', () => {
  const r = importBackup(exportBackup(state), { transactions: [], rules: {}, settings: {} });
  assert.equal(r.error, undefined);
  assert.equal(r.state.transactions.length, 1);
});

test('잘못된 백업은 기존 데이터를 건드리지 않는다', () => {
  for (const bad of ['not json', '{}', '{"schemaVersion":1,"transactions":"x"}', 'null']) {
    const r = importBackup(bad, state);
    assert.ok(r.error, bad);
    assert.equal(r.state, state);
  }
  assert.equal(validateBackup({ schemaVersion: 1, transactions: [], rules: {}, settings: {} }).ok, true);
});
