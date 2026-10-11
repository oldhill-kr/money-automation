import { h, won, table } from './dom.js';

const NO_SOURCE = '(파일 정보 없음)';

// 파일(출처) + 카드/계좌 단위로 거래를 묶는다. 잘못 올린 파일을 통째로 지울 때 쓴다.
export function uploadGroups(txs) {
  const groups = new Map();
  for (const t of txs) {
    const source = t.source || NO_SOURCE;
    const account = t.account || '(이름 없음)';
    const key = `${source}\u0000${account}`;
    const g = groups.get(key) || { key, source, account, count: 0, spend: 0, memos: 0, from: t.date, to: t.date };
    g.count += 1;
    if (t.kind === 'expense') g.spend += t.amount;
    if (t.memo) g.memos += 1;
    if (t.date < g.from) g.from = t.date;
    if (t.date > g.to) g.to = t.date;
    groups.set(key, g);
  }
  return [...groups.values()];
}

export function removeGroup(txs, group) {
  const match = (t) => (t.source || NO_SOURCE) === group.source && (t.account || '(이름 없음)') === group.account;
  return txs.filter((t) => !match(t));
}

export function filesCard(ctx) {
  const groups = uploadGroups(ctx.data.transactions);
  if (!groups.length) return null;
  const rows = groups.map((g) => [
    g.source, g.account, `${g.count}건`, `${g.from} ~ ${g.to}`, won(g.spend),
    h('button', { class: 'danger', onclick: async () => {
      const extra = g.memos ? `\n이 중 메모가 있는 거래 ${g.memos}건의 메모도 함께 지워집니다.` : '';
      if (!confirm(`'${g.source}' → "${g.account}" 거래 ${g.count}건을 삭제할까요?${extra}\n(분류 규칙은 그대로 남습니다)`)) return;
      ctx.data.transactions = removeGroup(ctx.data.transactions, g);
      ctx.ui.fileMsg = `'${g.source}' (${g.account}) 거래 ${g.count}건을 삭제했습니다.`;
      const y = window.scrollY;
      await ctx.commit();
      window.scrollTo(0, y);
    } }, '삭제'),
  ]);
  const msg = ctx.ui.fileMsg;
  ctx.ui.fileMsg = '';
  const body = h('div', {},
    msg ? h('div', { class: 'notice' }, msg) : null,
    h('p', { class: 'muted' }, '파일을 잘못 올렸을 때 그 파일의 거래만 골라서 지울 수 있습니다. 같은 파일을 다시 올려도 중복은 자동으로 걸러집니다.'),
    table(['파일', '카드/계좌', '건수', '기간', '지출 합계', ''], rows));
  const details = h('details', { class: 'card' }, h('summary', {}, `업로드한 파일 관리 (${groups.length}개 · 잘못 올린 파일 삭제)`), body);
  if (msg) details.open = true;
  return details;
}
