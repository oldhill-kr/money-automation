import { normalizeAmount, normalizeDate } from './parser.js';

export const MANUAL_SOURCE = '직접 입력';

// 엑셀에 없는 현금·이체 거래를 손으로 넣는다. type: 'expense'(지출) | 'income'(수입).
// 잘못된 값이면 { error }, 아니면 { tx }.
export function makeManualTx({ date, merchant, amount, category, account, memo, type = 'expense' }) {
  const d = normalizeDate(String(date ?? '').trim());
  if (!d) return { error: '날짜를 확인해 주세요(예: 2026-10-14).' };
  const name = String(merchant ?? '').trim();
  if (!name) return { error: '가맹점(내용)을 입력해 주세요.' };
  const n = normalizeAmount(String(amount ?? '').trim());
  if (n === null || n <= 0) return { error: '금액은 0보다 큰 숫자로 입력해 주세요.' };
  const tx = {
    date: d, merchant: name, amount: Math.round(n), currency: 'KRW',
    account: String(account ?? '').trim() || '현금', canceled: false, source: MANUAL_SOURCE,
    kind: type === 'income' ? 'income' : 'expense',
    category: type === 'income' ? null : (category || null),
  };
  if (type === 'income') tx.isSalary = false;
  const note = String(memo ?? '').trim();
  if (note) tx.memo = note;
  return { tx };
}
