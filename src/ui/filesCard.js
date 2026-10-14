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

// 파일의 거래를 다른 카드/계좌(그룹)로 옮긴다. 이름만 바꾸므로 거래 내용·분류·메모는 그대로다.
export function renameGroup(txs, group, newAccount) {
  const match = (t) => (t.source || NO_SOURCE) === group.source && (t.account || '(이름 없음)') === group.account;
  return txs.map((t) => (match(t) ? { ...t, account: newAccount, origAccount: t.origAccount ?? t.account } : t));
}

// 카드 실적 규칙의 계좌 목록이 옛 이름을 가리키고, 그 이름의 거래가 더 남아 있지 않으면 새 이름으로 바꿔 준다.
export function followRename(accounts, oldName, newName, txs) {
  if (!accounts.includes(oldName) || txs.some((t) => (t.account || '(이름 없음)') === oldName)) return accounts;
  return [...new Set(accounts.map((a) => (a === oldName ? newName : a)))];
}

// open: 처음부터 펼쳐 둘지(설정 탭에서는 true)
export function filesCard(ctx, { open = false } = {}) {
  const groups = uploadGroups(ctx.data.transactions).sort((a, b) => a.account.localeCompare(b.account, 'ko') || a.source.localeCompare(b.source, 'ko'));
  if (!groups.length) return null;
  const names = [...new Set(groups.map((g) => g.account))];
  const listId = 'account-names';
  const finish = async (msg) => {
    ctx.ui.fileMsg = msg;
    const y = window.scrollY;
    await ctx.commit();
    window.scrollTo(0, y);
  };
  const rows = groups.map((g) => {
    const input = h('input', { type: 'text', list: listId, value: g.account, 'aria-label': `${g.source}의 카드/계좌`, onchange: async () => {
      const next = input.value.trim();
      if (!next || next === g.account) { input.value = g.account; return; }
      if (!confirm(`'${g.source}'의 거래 ${g.count}건을 "${g.account}" → "${next}" 그룹으로 옮길까요?
(같은 이름의 그룹이 있으면 한 그룹으로 합쳐집니다)`)) { input.value = g.account; return; }
      const st = ctx.data.settings;
      ctx.data.transactions = renameGroup(ctx.data.transactions, g, next);
      st.cards.forEach((card) => { card.accounts = followRename(card.accounts, g.account, next, ctx.data.transactions); });
      await finish(`'${g.source}' 거래 ${g.count}건을 "${next}" 그룹으로 옮겼습니다.`);
    } });
    return [
      g.source, input, `${g.count}건`, `${g.from} ~ ${g.to}`, won(g.spend),
      h('button', { class: 'danger', onclick: async () => {
        const extra = g.memos ? `
이 중 메모가 있는 거래 ${g.memos}건의 메모도 함께 지워집니다.` : '';
        if (!confirm(`'${g.source}' → "${g.account}" 거래 ${g.count}건을 삭제할까요?${extra}
(분류 규칙은 그대로 남습니다)`)) return;
        ctx.data.transactions = removeGroup(ctx.data.transactions, g);
        await finish(`'${g.source}' (${g.account}) 거래 ${g.count}건을 삭제했습니다.`);
      } }, '삭제'),
    ];
  });
  const msg = ctx.ui.fileMsg;
  ctx.ui.fileMsg = '';
  const body = h('div', {},
    msg ? h('div', { class: 'notice' }, msg) : null,
    h('p', { class: 'muted' }, '올린 파일마다 어느 카드/계좌 그룹에 들어 있는지 보여 줍니다. 그룹 칸을 고치면 그 파일의 거래가 다른 그룹으로 옮겨지고, 삭제하면 그 파일의 거래만 지워집니다. 같은 파일을 다시 올려도 중복은 자동으로 걸러집니다.'),
    h('datalist', { id: listId }, names.map((n) => h('option', { value: n }))),
    table(['파일', '카드/계좌(그룹)', '건수', '기간', '지출 합계', ''], rows));
  const details = h('details', { class: 'card' }, h('summary', {}, `업로드한 파일 관리 (파일 ${groups.length}개 · 그룹 ${names.length}개)`), body);
  if (open || msg) details.open = true;
  return details;
}
