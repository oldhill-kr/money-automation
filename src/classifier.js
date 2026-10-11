// 카테고리 키워드. 앞에 있는 카테고리가 먼저 맞는다(예: 쿠팡이츠는 배달이 쇼핑보다 먼저).
// 영문·숫자 키워드는 '단어 단위'로만 맞춘다(subscription 속 PT 같은 오탐 방지).
const KEYWORDS = [
  ['카페', ['스타벅스', '이디야', '투썸', '메가커피', '커피', '카페', '할리스', '컴포즈']],
  ['배달', ['배달의민족', '배민', '요기요', '쿠팡이츠', '땡겨요']],
  ['교통', ['지하철', '버스', '택시', '카카오T', '교통카드', '코레일', 'KTX', '주유소']],
  ['식비', ['이마트', 'GS25', 'CU', '세븐일레븐', '식당', '마트', '홈플러스', '맥도날드', '김밥', '치킨', '편의점']],
  ['쇼핑', ['쿠팡', '하이마트', '무신사', '올리브영', '11번가']],
  ['구독', ['Netflix', 'YouTube', 'Spotify', '멜론', 'iCloud', 'Google One', 'Claude', 'ChatGPT', '벨소리', '왓챠', '티빙', '웨이브', '구독']],
  ['문화·여가', ['피트니스', '헬스', 'PT', '필라테스', '요가', '영화', 'CGV', '메가박스']],
  ['의료', ['내과', '병원', '의원', '약국', '치과', '한의원', '안과']],
  ['주거·공과금', ['월세', '관리비', '전기요금', '가스', '수도']],
  ['통신', ['통신', 'KT', 'SKT', '유플러스', '엘지유플', 'LGU']],
  ['보험', ['보험']],
  ['여행', ['항공', '호텔', '에어비앤비', '숙박']],
  ['교육', ['학원', '교육', '강의', '인프런']],
  ['경조사·선물', ['경조사', '축의금', '조의금', '선물']],
  ['생활', ['다이소', '생활용품', '세탁', '빨래방', '미용실', '이발', '헤어']],
];
// 패턴(정규식) 규칙: 키워드보다 먼저 맞는다. 앞에 있는 것이 우선.
const SIDO = '서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주';
const PATTERNS = [
  ['여행', /휴게소/],
  ['구독', /바로알람|\d{1,2}월\s*이용료/],
  // 시·도·군·구청과 관공서명: '부산기장군', '서울강남구', '○○광역시', '○○시청'
  ['주거·공과금', new RegExp(`광역시|특별시|특별자치|시청|도청|군청|구청|교육청|세무서|지방세|세외수입|과태료|^(${SIDO})(특별시|광역시|도)?\s*[가-힣]{1,5}(군|구|시)(청)?(\s|$)`)],
  ['쇼핑', /쇼핑|아울렛|아울롯/],
];
const CARD_PAYMENT = ['카드대금', '카드결제', '카드값', '결제대금'];
const SAVING = ['적금', '예금', '청약', '저축'];

const isWord = (kw) => /^[A-Za-z0-9]+$/.test(kw);

function has(merchant, kw) {
  const m = merchant.toLowerCase(), k = kw.toLowerCase();
  return isWord(kw) ? (m.match(/[a-z0-9]+/g) || []).includes(k) : m.includes(k);
}
const hasAny = (merchant, list) => list.some((kw) => has(merchant, kw));

// 같은 가게의 지점 표기만 다른 이름을 하나로 묶는 키. '스타벅스 강남점' → '스타벅스'
// (주)·괄호 안 설명·끝의 '○○점'·'#12'를 떼고 소문자로 맞춘다. 너무 짧아지면 원래 이름을 쓴다.
export function merchantKey(name) {
  const original = String(name ?? '').trim();
  let s = original.replace(/\(주\)|\(유\)|㈜|주식회사/g, '').replace(/[(\[][^)\]]*[)\]]/g, ' ');
  for (let i = 0; i < 3; i++) {
    const next = s.replace(/\s+\S*점\s*$/, '').replace(/(\s+\d+호?|\s*#\d+)\s*$/, '');
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s.length >= 2 ? s : original.toLowerCase();
}

export function classify(t, rules) {
  const m = t.merchant || '';
  if (t.direction === 'in') {
    return { kind: 'income', category: null, unknown: false, isSalary: /급여|월급|salary/i.test(m) };
  }
  if (hasAny(m, CARD_PAYMENT)) return { kind: 'cardPayment', category: null, unknown: false };
  if (hasAny(m, SAVING)) return { kind: 'saving', category: null, unknown: false };
  const learned = rules?.categories?.[m] || rules?.categories?.[merchantKey(m)];
  if (learned) return { kind: 'expense', category: learned, unknown: false };
  // 내가 정한 키워드 규칙('주유소' 포함 → 교통). 가맹점별 규칙보다 뒤, 기본 키워드보다 앞.
  const lower = m.toLowerCase();
  for (const [kw, category] of Object.entries(rules?.keywords || {})) {
    if (kw && lower.includes(kw.toLowerCase())) return { kind: 'expense', category, unknown: false };
  }
  for (const [category, re] of PATTERNS) {
    if (re.test(m)) return { kind: 'expense', category, unknown: false };
  }
  for (const [category, words] of KEYWORDS) {
    if (hasAny(m, words)) return { kind: 'expense', category, unknown: false };
  }
  return { kind: 'expense', category: null, unknown: true };
}

// 규칙은 지점명을 뗀 키로 저장한다(예전에 저장된 원래 이름 규칙은 그대로 계속 적용된다).
export function learn(rules, merchant, category) {
  const categories = { ...(rules?.categories || {}) };
  delete categories[merchant];
  categories[merchantKey(merchant)] = category;
  return { ...rules, categories };
}

export function forget(rules, key) {
  const categories = { ...(rules?.categories || {}) };
  delete categories[key];
  return { ...rules, categories };
}
