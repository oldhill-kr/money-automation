import { ymd, daysInMonth } from './dates.js';
import { USD_KRW } from './constants.js';

// 열 이름 후보. 새 카드사 양식을 지원하려면 여기에 단어만 추가하면 된다.
const HEADER_WORDS = {
  // '거래구분'(결제·결제취소·충전) 열도 취소/충전 표시 열로 쓴다.
  cancel: /취소|거래구분|거래유형/,
  installment: /할부(개월|기간|월)/,
  withdraw: /출금/,
  deposit: /입금/,
  amount: /금액/,
  // '거래일련번호'는 번호 열이지 날짜가 아니다.
  date: /이용일|거래일(?!련)|일자|승인일|날짜/,
  merchant: /가맹점|적요|내용|거래처|이용처|사용처|상호/,
};

// 취소 거래는 마이너스 금액으로 바꿔 원래 결제와 상쇄시킨다(가맹점 이름 뒤 '(취소)'는 떼어 같은 카테고리로 묶는다).
const CANCEL_MARK = /\s*[(\[]\s*(승인)?취소\s*[)\]]\s*$|\s+취소\s*$/;
export function negateCancel(t) {
  const marked = CANCEL_MARK.test(t.merchant || '');
  if (!marked && !t.canceled) return t;
  const { canceled, ...rest } = t;
  return { ...rest, merchant: (t.merchant || '').replace(CANCEL_MARK, '').trim(), amount: -Math.abs(t.amount), canceled: false };
}

const validYmd = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? ymd(y, m, d) : null;

export function normalizeDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === 'number') {
    if (v >= 19000101 && v <= 29991231) return validYmd(Math.floor(v / 10000), Math.floor(v / 100) % 100, v % 100);
    if (v > 20000 && v < 80000) { // 엑셀 일련번호
      const t = new Date(Math.round((v - 25569) * 86400000));
      return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
    }
    return null;
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/);
  if (m) return validYmd(2000 + +m[1], +m[2], +m[3]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  return null;
}

export function normalizeAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.replace(/[,\s₩원]/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

const fieldOf = (text) => {
  for (const f of ['cancel', 'installment', 'withdraw', 'deposit', 'amount', 'date', 'merchant']) {
    if (HEADER_WORDS[f].test(text)) return f;
  }
  return null;
};

export function detectHeader(rows) {
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const columns = {};
    (rows[i] || []).forEach((cell, idx) => {
      const f = fieldOf(String(cell ?? '').trim());
      if (f && columns[f] === undefined) columns[f] = idx;
    });
    const hasAmount = ['amount', 'withdraw', 'deposit'].some((f) => columns[f] !== undefined);
    const score = (columns.date !== undefined) + (columns.merchant !== undefined) + hasAmount;
    if (score >= 2) return { headerRow: i, columns };
  }
  return null;
}

const isBlank = (row) => !row || row.every((c) => String(c ?? '').trim() === '');

export function parseRows(rows, { mapping, account, source }) {
  const m = mapping || detectHeader(rows);
  const c = m?.columns;
  const hasAmount = c && ['amount', 'withdraw', 'deposit'].some((f) => c[f] !== undefined);
  if (!m || c.date === undefined || c.merchant === undefined || !hasAmount) {
    return { transactions: [], skipped: [], needsMapping: true };
  }
  const transactions = [], skipped = [];
  for (let i = m.headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    const skip = (reason) => skipped.push({ row: i + 1, reason });
    const date = normalizeDate(row[c.date]);
    if (!date) { skip('날짜를 읽을 수 없음'); continue; }

    let amount = null, direction = 'out', estimated = false, canceled = false;
    if (c.amount !== undefined) {
      const raw = row[c.amount];
      if (typeof raw === 'string' && /\$|USD/i.test(raw)) {
        const usd = normalizeAmount(raw.replace(/\$|USD/gi, ''));
        if (usd !== null) { amount = Math.round(usd * USD_KRW); estimated = true; }
      } else amount = normalizeAmount(raw);
      if (amount !== null && amount < 0) { canceled = true; amount = -amount; }
    } else {
      const w = normalizeAmount(row[c.withdraw]), d = normalizeAmount(row[c.deposit]);
      if (w > 0) amount = w;
      else if (d > 0) { amount = d; direction = 'in'; }
    }
    if (amount === null) { skip('금액을 읽을 수 없음'); continue; }
    const mark = c.cancel !== undefined ? String(row[c.cancel] ?? '') : '';
    // 선불·지역화폐 카드의 '충전'은 돈을 카드에 옮겨 넣은 것이라 지출이 아니다(실제 지출은 이후 결제 행).
    if (/충전/.test(mark) && !/취소/.test(mark)) { skip('충전(카드에 돈을 넣은 것이라 지출이 아님)'); continue; }
    if (mark.includes('취소')) canceled = true;
    if (canceled && direction === 'in') canceled = false; // 입금 쪽 취소 표시는 지출 상쇄가 아니다

    const tx = {
      date, merchant: String(row[c.merchant] ?? '').trim(), amount, currency: 'KRW',
      account, kind: 'expense', category: null, canceled, source, direction,
    };
    if (estimated) tx.estimated = true;
    const months = c.installment !== undefined ? parseInt(row[c.installment], 10) : NaN;
    if (months > 1) tx.installmentMonths = months;
    transactions.push(direction === 'out' ? negateCancel(tx) : tx);
  }
  return { transactions, skipped, needsMapping: false };
}
