// 세법 수치는 해마다 바뀐다. 여기만 고치면 된다.
export const TAX_YEAR = 2026;
export const MEDICAL_THRESHOLD_RATE = 0.03;
export const GLASSES_LIMIT = 500000;
export const CULTURE_SALARY_LIMIT = 70000000;
export const TAX_NOTICE = '준비용입니다. 홈택스 간소화 자료와 회사 담당자 확인이 최종입니다.';

export const SCHEMA_VERSION = 1;
export const EMERGENCY_MONTHS = 3;
export const SPEND_CUT_RATE = 0.1;

export const KINDS = ['expense', 'cardPayment', 'saving', 'income'];
export const CATEGORIES = [
  '식비', '카페', '배달', '교통', '쇼핑', '구독', '의료', '주거·공과금',
  '통신', '보험', '문화·여가', '여행', '교육', '경조사·선물', '기타',
];

// 외화 거래는 이 고정 환율로 추정해서 원화로 바꾸고 estimated 표시를 한다.
export const USD_KRW = 1400;
