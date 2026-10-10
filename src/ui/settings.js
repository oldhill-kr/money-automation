import { h, download } from './dom.js';
import { exportBackup, importBackup } from '../store.js';
import { parseBenefits, formatBenefits } from '../cardPerformance.js';
import { makeDemoTransactions } from '../../tests/fixtures.js';

export function render(el, ctx) {
  const { data } = ctx;
  const st = data.settings, rule = st.cardRule;
  const text = (label, value, onchange, ph) => h('div', { class: 'field' }, label, h('input', { type: 'text', value, placeholder: ph || '', onchange: (e) => onchange(e.target.value.trim()) }));
  const numField = (label, value, onchange, hint) => h('div', { class: 'field' }, label, h('div', {}, h('input', { type: 'number', min: 0, value, onchange: (e) => onchange(Math.max(0, Number(e.target.value) || 0)) }), hint ? h('span', { class: 'muted' }, ` ${hint}`) : null));
  const save = (fn) => (v) => { fn(v); ctx.commit(); };

  const importInput = h('input', { type: 'file', accept: '.json', class: 'hidden', onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = importBackup(await f.text(), data);
    if (r.error) { ctx.alert(`불러오기 실패: ${r.error} (기존 데이터는 그대로입니다)`); return; }
    if (!confirm(`백업의 거래 ${r.state.transactions.length}건으로 현재 데이터를 바꿉니다. 계속할까요?`)) return;
    ctx.setData(r.state);
    ctx.alert(null);
    ctx.commit();
  } });

  el.append(
    h('div', { class: 'card' }, h('h2', {}, '내 정보'),
      numField('연간 총급여', st.annualSalary || '', save((v) => { st.annualSalary = v; }), '(원) 월급 입금 내역이 없을 때와 연말정산에 씁니다'),
      numField('현재 모은 비상금', st.emergencyNow || '', save((v) => { st.emergencyNow = v; }), '(원)'),
      numField('남는 돈 중 비상금 비율', Math.round(st.emergencyRatio * 100), save((v) => { st.emergencyRatio = Math.min(100, v) / 100; }), '(%) 나머지는 저축·투자')),
    h('div', { class: 'card' }, h('h2', {}, '카드 혜택 규칙'),
      h('p', { class: 'muted' }, '카드 상품 안내서를 보고 직접 적어 주세요.'),
      text('카드 이름', rule.name, save((v) => { rule.name = v; }), '예: 혼잡카드 Plus'),
      numField('전월 실적 기준', rule.minPrevMonthSpend, save((v) => { rule.minPrevMonthSpend = v; }), '(원)'),
      text('혜택 (카테고리:%)', formatBenefits(rule.benefits), save((v) => { rule.benefits = parseBenefits(v); }), '카페:10, 배달:5, 교통:10'),
      text('이 카드로 쓰는 계좌 이름', rule.accounts.join(', '), save((v) => { rule.accounts = v.split(',').map((s) => s.trim()).filter(Boolean); }), '업로드할 때 붙인 이름, 쉼표로 구분')),
    h('div', { class: 'card' }, h('h2', {}, '백업'),
      h('p', { class: 'muted' }, '데이터는 이 브라우저 안에만 있습니다. 브라우저 데이터를 지우거나 PC를 바꾸면 사라지니 가끔 백업 파일을 내려받아 두세요.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => download('돈관리-백업.json', new Blob([exportBackup(data)], { type: 'application/json' })) }, '백업 내려받기'),
        h('button', { class: 'ghost', onclick: () => importInput.click() }, '백업 불러오기'), importInput)),
    h('div', { class: 'card' }, h('h2', {}, '데모·초기화'),
      h('div', { class: 'row' },
        h('button', { class: 'ghost', disabled: data.transactions.length > 0, onclick: () => {
          data.transactions = makeDemoTransactions();
          data.settings.annualSalary = 42000000;
          data.settings.cardRule = { name: '혼잡카드 Plus', minPrevMonthSpend: 300000, benefits: { 카페: 0.1, 배달: 0.05, 교통: 0.1 }, accounts: ['혼잡카드'] };
          data.settings.emergencyNow = 4800000;
          ctx.go('ledger');
          ctx.save();
        } }, '데모 데이터로 체험 (가상 인물 3개월 치)'),
        h('button', { class: 'danger', onclick: () => {
          if (!confirm('저장된 거래·규칙·설정을 모두 지웁니다. 되돌릴 수 없어요. 백업은 하셨나요?')) return;
          ctx.setData({});
          ctx.commit();
        } }, '모든 데이터 삭제')),
      h('p', { class: 'muted' }, '데모는 저장된 거래가 없을 때만 쓸 수 있습니다(내 데이터와 섞이지 않게).')));
}
