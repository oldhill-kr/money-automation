// 날짜는 항상 'YYYY-MM-DD' 문자열. 시간대 영향을 없애려고 UTC로만 계산한다.
const pad = (n) => String(n).padStart(2, '0');

export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
};
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function addDays(s, n) {
  const { y, m, d } = parseYmd(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// 원래 날짜의 '일'을 유지하되 그 달에 없으면 말일로.
export function addMonthsClip(s, n) {
  const { y, m, d } = parseYmd(s);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const ny = t.getUTCFullYear(), nm = t.getUTCMonth() + 1;
  return ymd(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export const dayOfWeek = (s) => {
  const { y, m, d } = parseYmd(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
};

export const prevMonth = (month) => addMonthsClip(`${month}-01`, -1).slice(0, 7);
