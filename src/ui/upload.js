import { h, table } from './dom.js';
import { parseRows, detectHeader } from '../parser.js';
import { classify } from '../classifier.js';
import { mergeTransactions } from '../store.js';

const FIELDS = [
  ['date', '날짜 열', true], ['merchant', '가맹점/내용 열', true], ['amount', '금액 열', false],
  ['withdraw', '출금 열', false], ['deposit', '입금 열', false], ['cancel', '취소 표시 열', false], ['installment', '할부개월 열', false],
];

// 파일 이름에서 날짜·번호를 떼어 같은 카드의 월별 파일이 한 계좌로 합쳐지게 한다.
// 예: '삼성카드_이용내역_202609.xlsx' → '삼성카드_이용내역'
export function accountFromFileName(name) {
  const base = name.replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/\(\d+\)/g, '').replace(/\d+/g, '').replace(/[\s_\-.~]+/g, ' ').trim().replace(/ /g, '_');
  return cleaned || base;
}

// CSV는 카드사마다 UTF-8 또는 EUC-KR(CP949)이라 직접 글자 코드를 판별해서 읽는다.
function decodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('euc-kr').decode(buf); }
}

async function readRows(file) {
  const buf = await file.arrayBuffer();
  const wb = /\.(csv|txt)$/i.test(file.name)
    ? XLSX.read(decodeText(buf), { type: 'string', cellDates: true })
    : XLSX.read(buf, { cellDates: true });
  // 시트가 여러 장이면 머리글이 읽히는 첫 시트를 쓴다(요약 시트가 앞에 있는 파일 대비).
  const sheets = wb.SheetNames.map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }));
  return sheets.find((rows) => detectHeader(rows)) || sheets[0] || [];
}

export function render(el, ctx) {
  const accountInput = h('input', { type: 'text', placeholder: '예: 신한카드' });
  const fileInput = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', multiple: true, class: 'hidden' });
  const panel = h('div', {});
  const drop = h('div', { class: 'drop' }, h('b', {}, '📂 카드사·은행 앱에서 받은 엑셀을 여기로 끌어다 놓기'), h('span', { class: 'muted' }, '여러 개 한번에 OK · xlsx / xls / csv · 비밀번호·인증서는 필요 없어요'), fileInput);

  const queue = [];
  let busy = false;
  async function next() {
    if (busy || !queue.length) return;
    busy = true;
    const { file, account } = queue.shift();
    panel.replaceChildren();
    try { stage(await readRows(file), account, file.name); }
    catch (e) { panel.append(h('div', { class: 'notice warn' }, `${file.name}: 파일을 읽을 수 없습니다.`)); done(); }
  }
  const done = () => { busy = false; next(); };

  function addFiles(files) {
    const list = [...files];
    for (const f of list) {
      const typed = accountInput.value.trim();
      queue.push({ file: f, account: list.length === 1 && typed ? typed : accountFromFileName(f.name) });
    }
    next();
  }
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('click', (e) => e.stopPropagation());
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });

  function stage(rows, account, source, mapping = ctx.data.rules.mappings?.[account]) {
    const result = parseRows(rows, { mapping, account, source });
    if (result.needsMapping) showMapping(rows, account, source);
    else showPreview(result, account, source, mapping);
  }

  function showMapping(rows, account, source) {
    const guess = detectHeader(rows);
    const headerNo = h('input', { type: 'number', min: 1, max: Math.max(1, rows.length), value: (guess?.headerRow ?? 0) + 1 });
    const selects = {};
    const box = h('div', { class: 'card' });
    function build() {
      const hr = Math.max(0, Number(headerNo.value) - 1);
      const labels = (rows[hr] || []).map((c, i) => `${i + 1}열: ${String(c).trim() || '(빈칸)'}`);
      box.replaceChildren(
        h('h2', {}, `${source}: 열을 직접 지정해 주세요`),
        h('p', { class: 'muted' }, '표 머리글(날짜, 가맹점, 금액 같은 제목) 줄 번호와 각 열을 골라 주세요. 한 번 지정하면 같은 이름의 계좌에는 기억해 둡니다.'),
        h('div', { class: 'field' }, '머리글 줄 번호', headerNo),
        FIELDS.map(([key, label, required]) => {
          const sel = h('select', {}, h('option', { value: '' }, '(없음)'),
            labels.map((l, i) => h('option', { value: i, selected: guess?.headerRow === hr && guess.columns[key] === i }, l)));
          selects[key] = sel;
          return h('div', { class: 'field' }, label + (required ? ' *' : ''), sel);
        }),
        h('p', { class: 'muted' }, '금액은 "금액 열" 하나이거나 "출금 열"/"입금 열"로 나뉘어 있습니다.'),
        h('div', { class: 'row' },
          h('button', { class: 'primary', onclick: apply }, '이 설정으로 읽기'),
          h('button', { class: 'ghost', onclick: () => { panel.replaceChildren(); done(); } }, '이 파일 건너뛰기')));
    }
    function apply() {
      const columns = {};
      for (const [k] of FIELDS) if (selects[k].value !== '') columns[k] = Number(selects[k].value);
      const m = { headerRow: Math.max(0, Number(headerNo.value) - 1), columns };
      const r = parseRows(rows, { mapping: m, account, source });
      if (r.needsMapping) { alert('날짜, 가맹점, 금액(또는 출금/입금) 열을 모두 골라 주세요.'); return; }
      showPreview(r, account, source, m, true);
    }
    headerNo.addEventListener('change', build);
    build();
    panel.replaceChildren(box);
  }

  function showPreview(result, account, source, mapping, userMapping = false) {
    const rows = result.transactions.map((t) => {
      const c = classify(t, ctx.data.rules);
      const { direction, ...rest } = t;
      return { ...rest, kind: c.kind, category: c.category, ...(c.isSalary !== undefined ? { isSalary: c.isSalary } : {}) };
    });
    const { merged, added, duplicates } = mergeTransactions(ctx.data.transactions, rows);
    const unknown = new Set(rows.filter((r) => r.kind === 'expense' && !r.category).map((r) => r.merchant)).size;

    // 중복 점검: ① 전부 이미 반영된 파일 ② 같은 파일 이름 ③ 다른 카드/계좌 이름으로 이미 들어간 같은 거래
    const fresh = merged.slice(ctx.data.transactions.length);
    const allDuplicate = rows.length > 0 && added === 0;
    const sameName = ctx.data.transactions.some((t) => t.source === source);
    const loose = new Map();
    for (const t of ctx.data.transactions) {
      const k = `${t.date}|${t.merchant}|${t.amount}`;
      if (!loose.has(k)) loose.set(k, new Set());
      loose.get(k).add(t.account);
    }
    const otherAccounts = new Set();
    let crossDup = 0;
    for (const t of fresh) {
      const hit = loose.get(`${t.date}|${t.merchant}|${t.amount}`);
      if (hit && ![...hit].includes(t.account)) { crossDup += 1; hit.forEach((a) => otherAccounts.add(a)); }
    }
    const warn = [];
    if (allDuplicate) warn.push(`이미 모두 반영된 파일입니다. 같은 거래 ${duplicates}건이 이미 있어서 새로 추가할 거래가 없습니다.`);
    else if (sameName) warn.push(`같은 이름의 파일이 이미 반영돼 있습니다. 겹치는 ${duplicates}건은 빼고 새 거래 ${added}건만 추가됩니다.`);
    if (crossDup && !allDuplicate && crossDup >= Math.max(1, Math.round(added * 0.5))) {
      warn.push(`새 거래 ${added}건 중 ${crossDup}건이 다른 카드/계좌(${[...otherAccounts].join(', ')})에 이미 있는 거래와 같습니다. 같은 파일을 다른 이름으로 올린 것이라면 '취소'하고 이름을 맞춰 다시 올려 주세요.`);
    }
    panel.replaceChildren(h('div', { class: 'card' },
      h('h2', {}, `${source} → "${account}"`),
      h('p', {}, `새로 추가 ${added}건 · 이미 있는 거래 ${duplicates}건 · 읽지 못한 행 ${result.skipped.length}개`),
      warn.map((w) => h('div', { class: 'notice warn' }, w)),
      unknown ? h('p', { class: 'muted' }, `분류를 모르는 가맹점 ${unknown}곳은 가계부 탭에서 한 번만 알려 주면 기억합니다.`) : null,
      result.skipped.length ? h('details', {}, h('summary', {}, '읽지 못한 행 보기'),
        table(['행', '이유'], result.skipped.slice(0, 50).map((s) => [s.row, s.reason]))) : null,
      rows.some((r) => r.estimated) ? h('p', { class: 'muted' }, '외화 결제는 고정 환율로 추정한 금액입니다.') : null,
      h('div', { class: 'row' },
        allDuplicate ? null : h('button', { class: 'primary', onclick: async () => {
          ctx.data.transactions = merged;
          // 방금 올린 파일의 가장 최근 달로 조회 월을 옮겨 바로 확인할 수 있게 한다.
          const newest = fresh.filter((t) => t.kind === 'expense').map((t) => t.date.slice(0, 7)).sort().pop();
          if (newest) ctx.ui.month = newest;
          if (userMapping) ctx.data.rules.mappings = { ...ctx.data.rules.mappings, [account]: mapping };
          panel.replaceChildren();
          await ctx.save(); // 화면을 다시 그리지 않고 저장만: 대기 중인 다음 파일이 사라지지 않게
          if (queue.length) done(); else { busy = false; ctx.closeUpload?.(); ctx.go('ledger'); }
        } }, '반영하기'),
        h('button', { class: 'ghost', onclick: () => { panel.replaceChildren(); done(); } }, allDuplicate ? '닫기' : '취소'))));
  }

  el.append(drop, h('div', { class: 'upload-extra' }, '카드/계좌 이름(파일 1개일 때):', accountInput, '비우면 파일 이름을 씁니다. 겹치는 기간의 거래는 한 번만 반영돼요.'), panel);
}
