// 지출 내역 표의 열 정렬. 같은 값이면 날짜 최신순 → 금액 큰 순으로 이어서 정렬한다.
export const SORT_KEYS = {
  date: (t) => t.date,
  merchant: (t) => t.merchant || '',
  amount: (t) => t.amount,
  category: (t) => t.category ?? '기타',
  account: (t) => t.account || '(이름 없음)',
  memo: (t) => t.memo || '',
};

export const DEFAULT_SORT = { key: 'date', dir: 'desc' };

// 열 이름을 누를 때: 같은 열이면 방향을 뒤집고, 다른 열이면 오름차순부터 시작한다.
export function nextSort(sort, key) {
  return sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
}

export function sortRows(list, { key, dir } = DEFAULT_SORT) {
  const get = SORT_KEYS[key] || SORT_KEYS.date;
  const sign = dir === 'asc' ? 1 : -1;
  const cmp = (x, y) => (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ko'));
  return [...list].sort((a, b) => {
    const x = get(a), y = get(b);
    // 비어 있는 메모는 방향과 관계없이 맨 아래로 보낸다.
    if (key === 'memo' && (x === '') !== (y === '')) return x === '' ? 1 : -1;
    return sign * cmp(x, y) || b.date.localeCompare(a.date) || b.amount - a.amount;
  });
}
