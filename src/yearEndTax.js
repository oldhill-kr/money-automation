import { MEDICAL_THRESHOLD_RATE, GLASSES_LIMIT, CULTURE_SALARY_LIMIT } from './constants.js';

// 건강기능식품·위생용품은 의료비가 아니다. 먼저 걸러낸다.
const EXCLUDED_ITEMS = ['비타민', '영양제', '건강기능', '오메가', '유산균', '홍삼', '반창고', '밴드', '마스크', '화장품'];
const MEDICINE_ITEMS = ['타이레놀', '게보린', '판콜', '이부프로펜', '아세트아미노펜', '감기', '소화제', '처방', '항생제', '연고', '안약', '진통', '소염', '약'];

export const medicalCandidates = (txs) =>
  txs.filter((t) => t.kind === 'expense' && !t.canceled && (t.category === '의료' || /약국|병원|의원/.test(t.merchant)));

export function classifyPharmacyItem(name) {
  if (EXCLUDED_ITEMS.some((w) => name.includes(w))) return 'excluded';
  return MEDICINE_ITEMS.some((w) => name.includes(w)) ? 'medical' : 'excluded';
}

export function medicalCheck({ salary, medicalSoFar, monthsCovered }) {
  const threshold = Math.round(salary * MEDICAL_THRESHOLD_RATE);
  const projectedYear = Math.round((medicalSoFar / monthsCovered) * 12);
  const deductible = Math.max(0, projectedYear - threshold);
  return { threshold, projectedYear, deductible, willDeduct: deductible > 0 };
}

export const glassesDeductible = (amount) => Math.min(amount, GLASSES_LIMIT);

// 헬스장 문화비 공제는 등록 사업장·PT 제외 등 조건이 있어 앱이 확정하지 않는다.
export const cultureCheck = ({ salary }) => (salary > CULTURE_SALARY_LIMIT ? 'notEligible' : 'needsVerification');
