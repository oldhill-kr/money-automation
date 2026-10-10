// 영상의 '김혼잡' 씨와 같은 종류의 가상 데이터. 난수 없이 규칙으로만 만든다(재현 가능).
const CREDIT = '혼잡카드', DEBIT = '체크카드', BANK = '국민은행';
const MONTHS = ['07', '08', '09'];

export function makeDemoTransactions() {
  const out = [];
  const add = (m, d, merchant, amount, account, category, o = {}) =>
    out.push({
      date: `2026-${m}-${String(d).padStart(2, '0')}`, merchant, amount, currency: 'KRW',
      account, kind: 'expense', category, canceled: false, source: `${account}.xlsx`, ...o,
    });

  MONTHS.forEach((m, i) => {
    // 은행 계좌
    add(m, 25, '급여', 3100000, BANK, null, { kind: 'income', isSalary: true });
    [8, 15, 21].forEach((d) => add(m, d, '홍길동 더치페이', 20000, BANK, null, { kind: 'income', isSalary: false }));
    add(m, 15, '카드대금', 1500000, BANK, null, { kind: 'cardPayment' });
    add(m, 26, '적금', 300000, BANK, null, { kind: 'saving' });
    add(m, 1, '월세', 600000, BANK, '주거·공과금');
    add(m, 5, '전기요금', [42000, 48000, 51000][i], BANK, '주거·공과금');
    add(m, 10, 'KT 통신요금', 55000, BANK, '통신');
    add(m, 12, '삼성화재 보험', 120000, BANK, '보험');
    add(m, 20, '벨소리서비스', 1150, BANK, '구독');

    // 구독·정기결제 (혼잡카드)
    add(m, 5, 'Body P 피트니스', 59000, CREDIT, '문화·여가');
    add(m, 3, 'YouTube Premium', 14900, CREDIT, '구독');
    add(m, 10, 'iCloud 저장공간', 1200, CREDIT, '구독');
    add(m, 18, 'Google One', 2900, CREDIT, '구독');
    add(m, 22, 'Netflix', 17000, CREDIT, '구독');
    add(m, 7, 'Claude subscription', 29000, CREDIT, '구독');
    add(m, 8, '멜론', i < 2 ? 1900 : 11900, CREDIT, '구독');
    add(m, 14, '밀리의서재', 9900, CREDIT, null);
    if (i >= 1) add(m, 12, 'PhotoLab', 9900, CREDIT, '구독');

    // 습관 지출
    [1, 3, 5, 7, 9, 11, 14, 16, 18, 21, 23, 26, 28].forEach((d) => add(m, d, '배달의민족', 22300, CREDIT, '배달'));
    [2, 4, 6, 8, 10, 13, 15, 17, 20, 22, 24, 27].forEach((d) => add(m, d, '스타벅스', 4800, DEBIT, '카페'));
    [1, 5, 9, 12, 16, 20, 24, 28].forEach((d) => add(m, d, 'GS25', 6000, DEBIT, '식비'));
    for (let d = 1; d <= 20; d++) add(m, d, '지하철', 1400, DEBIT, '교통');
    [6, 13, 19, 27].forEach((d) => add(m, d, '카카오T', 12000, DEBIT, '교통'));
    [4, 11, 19, 25].forEach((d) => add(m, d, 'CU', 3500, DEBIT, '식비'));
    [2, 6, 11, 17, 23, 29].forEach((d) => add(m, d, '이마트', 45000, CREDIT, '식비'));
    [3, 4, 10, 11, 17, 18, 24, 25, 26, 27].forEach((d) => add(m, d, '점심 식당', 9000, CREDIT, '식비'));
    [8, 15, 22].forEach((d) => add(m, d, '쿠팡', 25000, CREDIT, '쇼핑'));

    // 의료: 3개월 합계 270,000
    add(m, 9, '서울내과', [50000, 60000, 55000][i], CREDIT, '의료');
    add(m, 9, '온누리약국', [30000, 40000, 35000][i], CREDIT, '의료');
  });

  add('08', 16, '하이마트', 1290000, CREDIT, '쇼핑', { installmentMonths: 3 });
  add('08', 19, '29CM', 35000, CREDIT, null);
  return out;
}
