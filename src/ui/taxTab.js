import { h, won, put } from './dom.js';
import { TAX_YEAR, TAX_NOTICE, GLASSES_LIMIT, MEDICAL_THRESHOLD_RATE } from '../constants.js';
import { medicalCandidates, classifyPharmacyItem, medicalCheck, glassesDeductible, cultureCheck } from '../yearEndTax.js';
import { monthsCovered } from '../leaks.js';

export function render(el, ctx) {
  const { data } = ctx;
  const st = data.settings;
  const num = (key, label, hint) => h('div', { class: 'field' }, label,
    h('div', {}, h('input', { type: 'number', min: 0, value: st[key] || '', onchange: (e) => { st[key] = Math.max(0, Number(e.target.value) || 0); ctx.commit(); } }), hint ? h('span', { class: 'muted' }, ` ${hint}`) : null));

  const months = monthsCovered(data.transactions);
  const cands = medicalCandidates(data.transactions);
  const medical = cands.reduce((s, t) => s + t.amount, 0);

  const itemOut = h('span', { class: 'muted' }, '');
  const itemInput = h('input', { type: 'text', placeholder: '예: 타이레놀, 비타민C', oninput: (e) => {
    const v = e.target.value.trim();
    itemOut.textContent = v ? (classifyPharmacyItem(v) === 'medical' ? ' → 의료비로 인정' : ' → 제외 (건강기능식품·위생용품 등)') : '';
  } });

  put(el, 
    h('div', { class: 'notice warn' }, `${TAX_YEAR}년 기준 · ${TAX_NOTICE}`),
    h('div', { class: 'card' }, h('h2', {}, '입력'),
      num('annualSalary', '연간 총급여', '(원)'),
      num('glasses', '안경·렌즈 지출', '(원, 시력교정용)'),
      num('donation', '기부금', '(원)'),
      num('gymAmount', '헬스장·수영장 연 지출', '(원)')),
    h('div', { class: 'card' }, h('h2', {}, '의료비 3% 문턱 체크'),
      !st.annualSalary ? h('p', { class: 'muted' }, '연간 총급여를 입력하면 계산합니다.') : (() => {
        if (!months) return h('p', { class: 'muted' }, '거래가 없습니다.');
        const r = medicalCheck({ salary: st.annualSalary, medicalSoFar: medical, monthsCovered: months });
        return [
          h('p', {}, `카드 내역의 병원·약국 ${months}개월 합계 ${won(medical)} (${cands.length}건)`),
          h('p', {}, `문턱 = 총급여 × ${MEDICAL_THRESHOLD_RATE * 100}% = ${won(r.threshold)} / 지금 속도로 1년이면 ${won(r.projectedYear)}`),
          r.willDeduct
            ? h('p', {}, '예상 공제 대상 의료비 ', h('b', { class: 'good' }, won(r.deductible)))
            : h('p', {}, h('b', { class: 'bad' }, '지금 속도로는 의료비 공제를 한 푼도 못 받습니다.'), ' 12월에 알면 늦으니, 지금 알고 계획을 세우세요.'),
          h('p', { class: 'muted' }, '병원·약국 거래를 카드 내역에서 자동으로 모았습니다. 실제 공제 대상 여부는 홈택스 자료로 확인하세요.'),
        ];
      })()),
    h('div', { class: 'card' }, h('h2', {}, '그 밖의 항목'),
      h('p', {}, `안경 공제 대상 ${won(glassesDeductible(st.glasses || 0))} (1인 연 ${won(GLASSES_LIMIT)} 한도)`),
      h('p', {}, `기부금 ${won(st.donation || 0)} (영수증 별도 보관)`),
      st.gymAmount ? h('p', {}, cultureCheck({ salary: st.annualSalary }) === 'notEligible'
        ? '헬스장: 총급여 기준을 넘어 문화비 공제 대상이 아닙니다.'
        : '헬스장: 문화비 소득공제 대상일 수 있습니다(등록 사업장인지, PT는 제외). 확인 필요.') : null),
    h('div', { class: 'card' }, h('h2', {}, '약국 영수증 품목 확인'),
      h('p', { class: 'muted' }, '치료용 의약품은 의료비, 영양제·반창고 같은 것은 제외입니다.'), itemInput, itemOut));
}
