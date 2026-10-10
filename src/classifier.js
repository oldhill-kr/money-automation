// 카테고리 키워드. 앞에 있는 카테고리가 먼저 맞는다(예: 쿠팡이츠는 배달이 쇼핑보다 먼저).
// 영문·숫자 키워드는 '단어 단위'로만 맞춘다(subscription 속 PT 같은 오탐 방지).
const KEYWORDS = [
  ['카페', ['스타벅스', '이디야', '투썸', '메가커피', '커피', '카페', '할리스', '컴포즈']],
  ['배달', ['배달의민족', '배민', '요기요', '쿠팡이츠']],
  ['교통', ['지하철', '버스', '택시', '카카오T', '교통카드', '코레일', 'KTX']],
  ['식비', ['이마트', 'GS25', 'CU', '세븐일레븐', '식당', '마트', '홈플러스', '맥도날드', '김밥', '치킨', '편의점']],
  ['쇼핑', ['쿠팡', '하이마트', '무신사', '올리브영', '11번가']],
  ['구독', ['Netflix', 'YouTube', 'Spotify', '멜론', 'iCloud', 'Google One', 'Claude', 'ChatGPT', '벨소리', '왓챠', '티빙', '웨이브', '구독']],
  ['문화·여가', ['피트니스', '헬스', 'PT', '필라테스', '요가', '영화', 'CGV', '메가박스']],
  ['의료', ['내과', '병원', '의원', '약국', '치과', '한의원', '안과']],
  ['주거·공과금', ['월세', '관리비', '전기요금', '가스', '수도']],
  ['통신', ['통신', 'KT', 'SKT']],
  ['보험', ['보험']],
  ['여행', ['항공', '호텔', '에어비앤비', '숙박']],
  ['교육', ['학원', '교육', '강의', '인프런']],
  ['경조사·선물', ['경조사', '축의금', '조의금', '선물']],
];
const CARD_PAYMENT = ['카드대금', '카드결제', '카드값', '결제대금'];
const SAVING = ['적금', '예금', '청약', '저축'];

const isWord = (kw) => /^[A-Za-z0-9]+$/.test(kw);

function has(merchant, kw) {
  const m = merchant.toLowerCase(), k = kw.toLowerCase();
  return isWord(kw) ? (m.match(/[a-z0-9]+/g) || []).includes(k) : m.includes(k);
}
const hasAny = (merchant, list) => list.some((kw) => has(merchant, kw));

export function classify(t, rules) {
  const m = t.merchant || '';
  if (t.direction === 'in') {
    return { kind: 'income', category: null, unknown: false, isSalary: /급여|월급|salary/i.test(m) };
  }
  if (hasAny(m, CARD_PAYMENT)) return { kind: 'cardPayment', category: null, unknown: false };
  if (hasAny(m, SAVING)) return { kind: 'saving', category: null, unknown: false };
  const learned = rules?.categories?.[m];
  if (learned) return { kind: 'expense', category: learned, unknown: false };
  for (const [category, words] of KEYWORDS) {
    if (hasAny(m, words)) return { kind: 'expense', category, unknown: false };
  }
  return { kind: 'expense', category: null, unknown: true };
}

export const learn = (rules, merchant, category) => ({
  ...rules,
  categories: { ...(rules?.categories || {}), [merchant]: category },
});
