import { h, download, put } from './dom.js';
import { exportBackup, importBackup } from '../store.js';
import { parseBenefits, formatBenefits, emptyCard } from '../cardPerformance.js';
import { makeDemoTransactions } from '../../tests/fixtures.js';
import { MODES, connectFolder, reconnect, useBrowserOnly } from '../syncController.js';
import { folderSupported } from '../folderStore.js';
import { filesCard } from './filesCard.js';
import { keywordCard, rulesCard } from './classifyCards.js';

const HINTS = {
  local: '예: C:\돈관리 처럼 새 폴더를 하나 만들어 고르세요. (바탕화면·문서·다운로드 폴더 자체나 C:\ 루트는 브라우저가 막습니다)',
  cloud: '구글 드라이브 데스크톱 앱이 깔린 PC에서 드라이브 안의 폴더(예: G:\내 드라이브\돈관리)를 고르세요. 다른 PC에서도 같은 폴더를 고르면 같은 가계부가 열립니다.',
};

// 규칙 삭제로 다시 그려져도 접히지 않게 펼쳐 둔다. 규칙이 없으면 카드가 없다.
const openCard = (el) => { if (el) el.open = true; return el; };

function storageCard(ctx) {
  const s = ctx.sync;
  const supported = folderSupported();
  const choose = (mode) => async () => {
    if (mode === 'browser') {
      if (s.mode === 'browser') return;
      if (!confirm('폴더 연결을 끊고 이 브라우저 안에만 저장합니다. 폴더에 있는 파일은 그대로 남습니다. 계속할까요?')) return;
      await useBrowserOnly(ctx);
      return;
    }
    await connectFolder(ctx, mode);
  };
  const option = (mode) => h('button', {
    class: `choice${s.mode === mode ? ' active' : ''}`, disabled: mode !== 'browser' && !supported, onclick: choose(mode),
  }, h('b', {}, MODES[mode].label), h('span', { class: 'muted' }, {
    browser: '설치·설정 없이 바로. 이 브라우저에서만 보여요',
    local: '내가 고른 PC 폴더에 파일로 저장',
    cloud: '구글 드라이브 폴더에 저장 → 어느 PC에서든',
  }[mode]));
  const folderMode = s.mode !== 'browser' && s.handle;
  const when = s.savedAt ? new Date(s.savedAt).toLocaleString('ko-KR') : '아직 없음';
  return h('div', { class: 'card' }, h('h2', {}, '저장 위치'),
    h('p', { class: 'muted' }, '가계부 데이터를 어디에 둘지 고릅니다. 어느 쪽이든 서버로 올라가지 않고, 브라우저에는 항상 사본이 남습니다.'),
    h('div', { class: 'choices' }, option('browser'), option('local'), option('cloud')),
    supported ? null : h('p', { class: 'notice warn' }, '이 브라우저는 폴더 저장을 지원하지 않습니다. 크롬이나 엣지에서 열어 주세요.'),
    folderMode ? h('div', { class: 'row' },
      h('span', {}, `폴더: ${s.handle.name} · ${s.connected ? '연결됨' : '연결 끊김'} · 마지막 저장 ${when}`),
      s.connected ? null : h('button', { class: 'primary', onclick: () => reconnect(ctx) }, '다시 허용'),
      h('button', { class: 'ghost', onclick: () => connectFolder(ctx, s.mode) }, '폴더 변경')) : null,
    s.mode !== 'browser' ? h('p', { class: 'muted' }, `${HINTS[s.mode]} 브라우저는 보안상 폴더 이름만 보여 줍니다.`) : null,
    s.mode === 'cloud' ? h('p', { class: 'muted' }, '다른 PC에서 저장한 내용은 구글 드라이브가 동기화한 뒤에 보입니다. 이 창으로 돌아오면 자동으로 확인해요. 두 PC에서 동시에 고치면 거래는 중복 없이 합쳐집니다.') : null);
}

// 저장된 거래가 없을 때만 가상 인물 데이터를 넣는다(내 데이터와 섞이지 않게).
export function loadDemo(ctx) {
  const { data } = ctx;
  if (data.transactions.length) return;
  data.transactions = makeDemoTransactions();
  data.settings.annualSalary = 42000000;
  data.settings.cards = [{ name: '혼잡카드 Plus', minPrevMonthSpend: 300000, benefits: { 카페: 0.1, 배달: 0.05, 교통: 0.1 }, accounts: ['혼잡카드'] }];
  data.settings.emergencyNow = 4800000;
  ctx.go('ledger');
  ctx.save();
}

export function render(el, ctx) {
  const { data } = ctx;
  const st = data.settings;
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
    ctx.commit({ force: true });
  } });


  // 카드 혜택 규칙: 카드마다 한 벌씩. 카드 실적 탭은 이 목록 전부를 보여 준다.
  const cardsCard = () => h('div', { class: 'card' }, h('h2', {}, '카드 혜택 규칙'),
    h('p', { class: 'muted' }, '카드 상품 안내서를 보고 직접 적어 주세요. 카드가 여러 장이면 "카드 추가"로 늘리세요.'),
    st.cards.map((rule, i) => h('div', { class: 'rule-box' },
      h('div', { class: 'row' }, h('b', {}, `카드 ${i + 1}${rule.name ? ` · ${rule.name}` : ''}`),
        h('button', { class: 'danger', style: 'margin-left:auto', onclick: () => {
          if (!confirm(`'${rule.name || `카드 ${i + 1}`}' 규칙을 삭제할까요? (거래는 그대로입니다)`)) return;
          st.cards.splice(i, 1);
          ctx.commit();
        } }, '카드 삭제')),
      text('카드 이름', rule.name, save((v) => { rule.name = v; }), '예: 혼잡카드 Plus'),
      numField('전월 실적 기준', rule.minPrevMonthSpend, save((v) => { rule.minPrevMonthSpend = v; }), '(원)'),
      text('혜택 (카테고리:%)', formatBenefits(rule.benefits), save((v) => { rule.benefits = parseBenefits(v); }), '카페:10, 배달:5, 교통:10'),
      text('이 카드로 쓰는 계좌 이름', rule.accounts.join(', '), save((v) => { rule.accounts = v.split(',').map((x) => x.trim()).filter(Boolean); }), '업로드할 때 붙인 이름, 쉼표로 구분'))),
    h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: () => { st.cards.push(emptyCard()); ctx.commit(); } }, '＋ 카드 추가')));

  put(el,
    storageCard(ctx),
    filesCard(ctx, { open: true }),
    keywordCard(ctx),
    openCard(rulesCard(ctx)),
    h('div', { class: 'card' }, h('h2', {}, '내 정보'),
      numField('연간 총급여', st.annualSalary || '', save((v) => { st.annualSalary = v; }), '(원) 월급 입금 내역이 없을 때와 연말정산에 씁니다'),
      numField('남는 돈 중 비상금 비율', Math.round(st.emergencyRatio * 100), save((v) => { st.emergencyRatio = Math.min(100, v) / 100; }), '(%) 나머지는 저축·투자')),
    cardsCard(),
    h('div', { class: 'card' }, h('h2', {}, '백업'),
      h('p', { class: 'muted' }, ctx.sync.mode === 'browser' ? '데이터는 이 브라우저 안에만 있습니다. 브라우저 데이터를 지우거나 PC를 바꾸면 사라지니 가끔 백업 파일을 내려받아 두세요.' : '폴더에도 사본이 있지만, 백업 파일을 따로 내려받아 두면 더 안전합니다.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => download('돈관리-백업.json', new Blob([exportBackup(data)], { type: 'application/json' })) }, '백업 내려받기'),
        h('button', { class: 'ghost', onclick: () => importInput.click() }, '백업 불러오기'), importInput)),
    h('div', { class: 'card' }, h('h2', {}, '데모·초기화'),
      h('div', { class: 'row' },
        h('button', { class: 'ghost', disabled: data.transactions.length > 0, onclick: () => loadDemo(ctx) }, '데모 데이터로 체험 (가상 인물 3개월 치)'),
        h('button', { class: 'danger', onclick: () => {
          if (!confirm('저장된 거래·규칙·설정을 모두 지웁니다. 되돌릴 수 없어요. 백업은 하셨나요?')) return;
          ctx.setData({});
          ctx.commit({ force: true });
        } }, '모든 데이터 삭제')),
      h('p', { class: 'muted' }, '데모는 저장된 거래가 없을 때만 쓸 수 있습니다(내 데이터와 섞이지 않게).')));
}
