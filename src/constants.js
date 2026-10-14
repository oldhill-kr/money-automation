// 세법 수치는 해마다 바뀐다. 여기만 고치면 된다.
export const TAX_YEAR = 2026;
export const MEDICAL_THRESHOLD_RATE = 0.03;
export const GLASSES_LIMIT = 500000;
export const CULTURE_SALARY_LIMIT = 70000000;
export const TAX_NOTICE = '준비용입니다. 홈택스 간소화 자료와 회사 담당자 확인이 최종입니다.';

export const SCHEMA_VERSION = 1;
export const EMERGENCY_MONTHS = 3;
export const SPEND_CUT_RATE = 0.1;

export const KINDS = ['expense', 'cardPayment', 'saving', 'income', 'transfer'];
export const CATEGORIES = [
  '식비', '카페', '배달', '교통', '쇼핑', '구독', '의료', '주거·공과금',
  '통신', '보험', '문화·여가', '여행', '교육', '경조사·선물', '생활', '기타',
];

// 카테고리·계좌 색(라이트·다크 모두에서 읽히는 중간 채도).
export const CATEGORY_COLORS = {
  식비: '#f59e0b', 카페: '#b45309', 배달: '#ef4444', 교통: '#3b82f6', 쇼핑: '#ec4899', 구독: '#8b5cf6',
  의료: '#14b8a6', '주거·공과금': '#64748b', 통신: '#06b6d4', 보험: '#84cc16', '문화·여가': '#f97316',
  여행: '#0ea5e9', 교육: '#6366f1', '경조사·선물': '#d946ef', 생활: '#22c55e', 기타: '#94a3b8',
};
export const categoryColor = (name) => CATEGORY_COLORS[name] || CATEGORY_COLORS.기타;
export const ACCOUNT_COLORS = ['#3b6ff5', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#06b6d4'];

// 외화 거래는 이 고정 환율로 추정해서 원화로 바꾸고 estimated 표시를 한다.
export const USD_KRW = 1400;
