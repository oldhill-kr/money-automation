# 돈 관리 자동화 웹앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드·은행 엑셀을 끌어다 놓으면 가계부, 새는 돈, 카드 실적, 연말정산 미리보기, 통장 쪼개기, 주간 브리핑이 채워지고 데이터가 브라우저에 누적되는 정적 웹앱을 만든다.

**Architecture:** 계산은 DOM·IndexedDB·SheetJS에 의존하지 않는 순수 ES 모듈(`src/*.js`)로 만들어 Node에서 테스트한다. 브라우저 전용 코드(`src/db.js`, `src/ui/*`)는 얇게 유지한다. 모든 모듈은 표준 거래 배열을 입력받는다.

**Tech Stack:** HTML + ES 모듈, SheetJS(`vendor/xlsx.full.min.js`, 파일 동봉), IndexedDB, 테스트는 `node --test`. 빌드 도구 없음.

**Spec:** `docs/superpowers/specs/2026-10-10-money-automation-design.md`

## Global Constraints
- 네트워크 호출, CDN, 외부 스크립트 금지. 사용자 데이터는 브라우저 밖으로 나가지 않는다.
- 금액은 원 단위 정수. 날짜는 `YYYY-MM-DD` 문자열.
- 모든 저장 레코드에 `schemaVersion: 1`.
- 세법 수치(의료비 문턱 3%, 안경 한도 500,000원, 문화비 총급여 한도 70,000,000원)는 `src/constants.js` 한 곳에만 둔다. 기준 연도 `TAX_YEAR = 2026`을 화면에 표시한다.
- 비상금 목표 = (고정비 + 생활비) × 3개월. 생활비 절감 목표 10%.
- 세금 화면 문구: "준비용입니다. 홈택스 간소화 자료와 회사 담당자 확인이 최종입니다."
- 지출 합계에서 `kind !== 'expense'`(카드대금, 저축, 입금)는 제외한다.
- 사용자에게 보이는 문구는 한국어.

## Review Focus
- 제목·합계 행이 헤더 위에 있는 엑셀(헤더가 1행이 아님) → 헤더를 찾아야 하고 실패 시 열 지정 화면으로 간다. (Task 2)
- 데이터가 1개월뿐일 때 정기결제 감지 → 오탐 없이 "데이터 부족" 표시. (Task 6)
- 12월→1월로 넘어가는 파일, `2026.04.03 14:22` 같은 날짜·시간 혼합 형식. (Task 2)
- 같은 파일 안의 같은 날 같은 가게 같은 금액 2건은 둘 다 남고, 다른 파일과 겹칠 때만 합쳐진다. (Task 3)
- 형식이 틀린 백업 파일을 불러와도 기존 데이터가 그대로다. (Task 3)

---

### Task 1: 프로젝트 골격, 상수, 테스트용 가상 데이터

**Files:**
- Create: `package.json` (`"type":"module"`, `"scripts":{"test":"node --test"}`), `src/constants.js`, `tests/fixtures.js`, `tests/fixtures.test.js`

**Interfaces:**
- Produces: `src/constants.js` exports `SCHEMA_VERSION=1`, `TAX_YEAR`, `MEDICAL_THRESHOLD_RATE=0.03`, `GLASSES_LIMIT=500000`, `CULTURE_SALARY_LIMIT=70000000`, `EMERGENCY_MONTHS=3`, `SPEND_CUT_RATE=0.1`, `CATEGORIES` (지출 15개: 식비, 카페, 배달, 교통, 쇼핑, 구독, 의료, 주거·공과금, 통신, 보험, 문화·여가, 여행, 교육, 경조사·선물, 기타), `KINDS=['expense','cardPayment','saving','income']`.
- Produces: `tests/fixtures.js` exports `makeDemoTransactions(): Transaction[]` — 3개월(2026-07~09), 약 330건. 포함 내용: 월급 3,100,000 입금(`kind:'income'`, `isSalary:true`), 더치페이 입금(`isSalary:false`), 월 59,000 헬스장, 8월 시작 9,900 사진앱, 멜론 1,900→11,900(9월), iCloud+구글 클라우드 중복, 소액 월 정액, 8월 1,290,000 석 달 할부 1건, 월 13회 배달, 병원/약국 거래, 카드대금 출금.
- Transaction 형태: `{date, merchant, amount, currency:'KRW', account, kind, category, canceled:false, source, isSalary?, installmentMonths?}`; `amount`는 항상 양수.

- [ ] **Step 1: Write the failing test** — `fixtures.test.js`: `makeDemoTransactions().length`가 300~360, 월 3개(07,08,09)가 모두 존재, `isSalary:true` 거래가 월 1건씩 3건.
- [ ] **Step 2: Run** `npm test` → FAIL (모듈 없음).
- [ ] **Step 3: Implement** package.json, constants.js, fixtures.js. 난수 대신 고정 규칙으로 생성(재현 가능).
- [ ] **Step 4: Run** `npm test` → PASS.

### Task 2: 엑셀 파서

**Files:** Create `src/parser.js`, `tests/parser.test.js`

**Interfaces:**
- Produces:
  - `normalizeDate(v: string|number|Date): string|null` — `2026.04.03`, `2026-04-03 14:22`, `26/04/03`, `20260403`, 엑셀 일련번호 지원.
  - `normalizeAmount(v: string|number): number|null` — `"12,000원"`, `"-3,500"`, `"₩1,200"`; 해석 불가면 null.
  - `detectHeader(rows: any[][]): {headerRow:number, columns:{date?:number, merchant?:number, amount?:number, cancel?:number, balance?:number}}|null` — 앞 30행 안에서 "이용일/거래일/일자", "가맹점/적요/내용", "금액/이용금액/출금/입금" 계열 이름이 2개 이상 일치하는 행.
  - `parseRows(rows, {mapping?, account, source}): {transactions:Transaction[], skipped:{row:number, reason:string}[], needsMapping:boolean}` — 취소 행(취소 열 값 있음 또는 음수 승인)은 `canceled:true`, 달러 표기는 `currency:'USD'`와 추정 플래그 `estimated:true`.

- [ ] **Step 1: Write failing tests** — 날짜 5개 형식, 금액 4개 형식, 제목 3행이 위에 있는 표에서 `headerRow===3`, 헤더를 못 찾으면 `needsMapping===true`, 해석 불가 행은 `skipped`에 사유와 함께 담기고 나머지는 정상 반환, 12월→1월 파일의 연도 유지.
- [ ] **Step 2: Run** `node --test tests/parser.test.js` → FAIL.
- [ ] **Step 3: Implement** 위 시그니처. 열 이름 후보 사전은 파일 상단 상수 하나로 둔다.
- [ ] **Step 4: Run** → PASS.

### Task 3: 저장 로직(중복 제거, 마이그레이션, 백업)과 IndexedDB 래퍼

**Files:** Create `src/store.js`, `src/db.js`, `tests/store.test.js`

**Interfaces:**
- Consumes: Transaction (Task 1).
- Produces (`store.js`, 순수 함수):
  - `dedupeKey(t): string` — `date|merchant|amount|account`.
  - `mergeTransactions(existing, incoming): {merged, added:number, duplicates:number}` — 같은 `source` 파일 안의 동일 키는 모두 보존, 서로 다른 `source` 사이에서만 합침(기존 것 유지).
  - `migrate(record): record` — `schemaVersion`이 낮으면 올린다(현재는 1이라 통과만).
  - `validateBackup(obj): {ok:boolean, error?:string}` — `schemaVersion`, `transactions` 배열, `rules`, `settings` 객체 확인.
  - `exportBackup(state): string`(JSON), `importBackup(json, currentState): {state, error?}` — 검증 실패 시 `currentState`를 그대로 반환.
- Produces (`db.js`, 브라우저 전용): `loadState(): Promise<{transactions,rules,settings}>`, `saveState(state): Promise<void>` (저장 실패는 throw → UI가 경고).

- [ ] **Step 1: Write failing tests** — 같은 파일 내 동일 거래 2건 보존 / 다른 파일과 겹치면 1건으로 / 4~6월 뒤 6~8월 병합 시 6월 중복 없음 / 잘못된 JSON·구조 백업은 `currentState` 불변.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** store.js. db.js는 객체 저장소 3개(transactions, rules, settings)를 IndexedDB에 쓰는 얇은 래퍼(테스트는 Task 11 수동 확인).
- [ ] **Step 4: Run** → PASS.

### Task 4: 분류기

**Files:** Create `src/classifier.js`, `tests/classifier.test.js`

**Interfaces:**
- Produces: `classify(t, rules): {category?:string, kind:string, unknown:boolean}` — 사용자 규칙 > 기본 키워드 사전 순. `kind` 판별: 카드대금/저축/입금 키워드와 입금 방향. 키워드는 **가맹점 이름 단어 단위**로 비교한다(부분 문자열 금지). `learn(rules, merchant, category): rules`.

- [ ] **Step 1: Write failing tests** — "스타벅스"→카페, "배달의민족"→배달, 카드대금→`kind:'cardPayment'`, 사전에 없는 "29CM"→`unknown:true`, `learn` 후 같은 가맹점은 `unknown:false`, "Claude subscription"이 헬스(PT)로 분류되지 않는다.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

### Task 5: 가계부 계산

**Files:** Create `src/ledger.js`, `tests/ledger.test.js`

**Interfaces:**
- Produces: `monthlyTotals(txs): {month:string, total:number, byCategory:Record<string,number>}[]`(월 오름차순, `kind==='expense'`이고 `canceled===false`만), `averageMonthly(txs): number`, `splitInstallments(txs): Transaction[]` — `installmentMonths=n`인 거래를 n개월에 균등 분할(나머지는 첫 달).

- [ ] **Step 1: Write failing tests** — 데모 데이터에서 카드대금·저축·입금 제외, 취소 제외, 8월 1,290,000 3개월 할부가 분할 후 8월 쇼핑이 430,000만큼 줄어든다(분할 전 대비), 나머지 1원 처리.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

### Task 6: 새는 돈 감지

**Files:** Create `src/leaks.js`, `tests/leaks.test.js`

**Interfaces:**
- Consumes: `Transaction[]`.
- Produces: `findRecurring(txs): {merchant, monthlyAmount, months:number, signals:('newlyStarted'|'priceUp'|'duplicate'|'small')[], category}[]`, `annualCost(monthly): number`(×12), `savings(items, cancelledMerchants:Set<string>): {monthly:number, yearly:number}`, `habitSpend(txs, category): {countPerMonth:number, yearly:number}`. 정기결제 조건: 같은 가맹점, 금액 차이 ≤ 최초 금액의 ±0%(가격 인상은 `priceUp`으로 별도 판정), 날짜 차이 ≤ 5일, 2개월 이상 반복. 월 수가 2 미만이면 빈 배열과 `insufficientData:true`는 호출 측에서 `monthsCovered(txs)`로 판단. 할부 거래와 카테고리(의료, 쇼핑)는 제외. 중복 판정은 `DUPLICATE_GROUPS`(클라우드, 음악 등) 상수로.
- Produces: `monthsCovered(txs): number`.

- [ ] **Step 1: Write failing tests** — 데모에서 정기결제가 기대 후보들로 나오고 합계가 `1,018,200/12`와 일치(데모 설계 시 맞춤) / 할부 1건은 정기결제가 아님(회귀 ①) / 병원 반복 방문은 priceUp이 아님(회귀 ②) / "Claude subscription"이 헬스장 항목으로 합쳐지지 않음(회귀 ③) / 1개월 데이터면 `monthsCovered===1`이고 결과 빈 배열(Review Focus) / `savings`가 체크 해제 시 줄어듦.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

### Task 7: 카드 실적·놓친 혜택

**Files:** Create `src/cardPerformance.js`, `tests/cardPerformance.test.js`

**Interfaces:**
- Produces: `cardReport(txs, cardRule, month): {met:boolean, spent:number, remaining:number, missedBenefit:number, missedByCategory:Record<string,number>}`. `cardRule = {name, minPrevMonthSpend:number, benefits:Record<category, rate>, accounts:string[]}`. 실적은 **전월** 해당 카드(`accounts`) 지출 기준. 놓친 혜택 = 해당 카테고리 지출 중 혜택 카드가 아닌 계좌로 결제한 금액 × 혜택률.

- [ ] **Step 1: Write failing tests** — 데모(카페를 체크카드로 결제)에서 놓친 혜택이 카페 지출×10%와 일치, 전월 실적 미달 시 `met:false`와 `remaining`.
- [ ] **Step 2–4:** Run FAIL → Implement → Run PASS.

### Task 8: 연말정산 미리보기

**Files:** Create `src/yearEndTax.js`, `tests/yearEndTax.test.js`

**Interfaces:**
- Produces: `medicalCandidates(txs): Transaction[]`(의료 카테고리 + 약국), `classifyPharmacyItem(name): 'medical'|'excluded'`(치료용 의약품 포함, 영양제·건강기능식품·반창고 제외), `medicalCheck({salary, medicalSoFar, monthsCovered}): {threshold:number, projectedYear:number, deductible:number, willDeduct:boolean}`(threshold = salary×3%, projectedYear = medicalSoFar / monthsCovered × 12, deductible = max(0, projectedYear − threshold)), `glassesDeductible(amount): number`(≤ 500,000), `cultureCheck({salary, gymAmount}): 'needsVerification'|'notEligible'`(총급여 > 70,000,000 이면 notEligible).

- [ ] **Step 1: Write failing tests** — 연봉 42,000,000이면 threshold 1,260,000 / 3개월 270,000이면 projectedYear 1,080,000, `willDeduct:false`, `deductible:0` / 타이레놀→medical, 비타민→excluded / 안경 700,000→500,000 / 연봉 80,000,000이면 notEligible.
- [ ] **Step 2–4:** Run FAIL → Implement → Run PASS.

### Task 9: 통장 쪼개기와 주간 브리핑

**Files:** Create `src/accountSplit.js`, `src/briefing.js`, `tests/accountSplit.test.js`, `tests/briefing.test.js`

**Interfaces:**
- Produces:
  - `monthlySalary(txs): number` — `isSalary===true` 입금의 월평균만(더치페이 제외, 회귀 ④).
  - `splitPlan({salary, fixedCosts, avgLiving, leakSavings, emergencyNow}): {fixed, living, livingPerWeek, emergency, invest, emergencyGoal, monthsToGoal}` — living = avgLiving×(1−SPEND_CUT_RATE), emergencyGoal = (fixed+living)×3, 남은 돈은 emergency와 invest로 배분하되 `leakSavings`는 invest에 더한다.
  - `weeklyBriefing(txs, today:string, {weeklyBudget, fixedItems}): {lastWeekLiving, budgetDiff, upcomingFixed:{merchant,amount,date}[], upcomingTotal}`.

- [ ] **Step 1: Write failing tests** — 더치페이 입금이 월급에 섞이지 않는다 / 비상금 목표 계산과 개월 수(4,800,000 보유, 월 270,000 적립 → 목표 7,290,000에 10개월) / 브리핑이 지난 월~일 구간 생활비를 계산하고 다음 7일의 고정 지출을 나열.
- [ ] **Step 2–4:** Run FAIL → Implement → Run PASS.

### Task 10: 화면 골격 — 업로드 흐름, 열 지정, 미리보기, 설정, 백업

**Files:** Create `index.html`, `css/style.css`, `src/main.js`, `src/ui/upload.js`, `src/ui/settings.js`, `vendor/xlsx.full.min.js`

**Interfaces:**
- Consumes: parser, store, classifier, db.
- Produces: `src/ui/upload.js` exports `initUpload(rootEl, onChange)`: 파일 끌어다 놓기 → SheetJS로 `rows` 변환 → 계좌/카드 이름 입력 → `parseRows` → (`needsMapping`이면 열 지정 화면) → 미리보기("추가 N건, 중복 M건, 읽지 못한 행 K개 목록") → 확인 시 분류·병합·저장. `src/ui/settings.js`: 월급일, 총급여, 카드 혜택 규칙, 통장 비율 입력, 백업 내려받기/불러오기. 저장 실패 시 경고 + 백업 안내.
- SheetJS는 `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`에서 받아 `vendor/`에 둔다(받은 뒤 `index.html`은 로컬 파일만 참조).

- [ ] **Step 1:** SheetJS 다운로드 후 파일 크기 확인. `index.html`이 외부 URL을 하나도 참조하지 않음을 `grep -n "http" index.html src -r`로 확인(주석 제외).
- [ ] **Step 2:** 로컬 서버(`python -m http.server`)로 열어 데모 엑셀(Task 1 데이터를 xlsx로 내보내는 `tests/make-demo-xlsx.js`)을 업로드 → 미리보기 → 확인 → 새로고침 후에도 데이터가 남는지 확인.
- [ ] **Step 3:** 같은 파일을 한 번 더 올리면 "중복 N건"으로 표시되고 건수가 늘지 않는지 확인.

### Task 11: 탭 화면 5개

**Files:** Create `src/ui/ledgerTab.js`, `leaksTab.js`, `cardTab.js`, `taxTab.js`, `splitTab.js`(통장 쪼개기 + 주간 브리핑), `src/ui/chart.js`(SVG 막대 그래프)

**Interfaces:**
- Consumes: Task 5–9의 모듈 함수. 각 탭은 `render(el, state)` 하나를 export하고 계산은 모듈에 맡긴다.
- 새는 돈 탭: 항목별 해지 체크박스 → `savings()` 결과가 통장 쪼개기 탭의 저축·투자 칸에 즉시 반영. 모르는 가맹점은 카테고리를 묻고 `learn`으로 저장. 연말정산 탭에 Global Constraints의 세금 문구와 `TAX_YEAR` 표시.

- [ ] **Step 1:** 데모 데이터를 올린 상태에서 5개 탭을 차례로 열어 콘솔 오류가 없고 기대값(월평균 지출, 새는 돈 합계 월 84,850원/연 1,018,200원, 3% 문턱 경고)이 화면에 보이는지 확인.
- [ ] **Step 2:** 헬스장 체크를 해제하면 저축·투자 칸이 그만큼 줄어드는지 확인.
- [ ] **Step 2b:** 가계부 탭의 "엑셀로 내보내기" 버튼(`XLSX.writeFile`, 열: 날짜·가맹점·금액·카테고리·계좌)으로 받은 파일을 다시 업로드해 같은 건수로 읽히는지 확인.
- [ ] **Step 3:** 백업 내려받기 → 저장 데이터 삭제 → 불러오기로 복원되는지, 잘못된 JSON을 불러오면 기존 데이터가 유지되는지 확인.

### Task 12: 최종 점검과 검수용 안내

**Files:** Create `README.md`(실행 방법: `python -m http.server` 후 `localhost:8000`, 데모 엑셀 사용법)

- [ ] **Step 1:** `npm test` 전체 통과 확인 후 결과를 그대로 보고한다.
- [ ] **Step 2:** `index.html`이 외부 URL을 참조하지 않는지 재확인.
- [ ] **Step 3:** 사용자 검수용 로컬 실행 방법과 데모 엑셀 위치를 안내한다. GitHub 저장소 생성·공개는 하지 않는다(사용자 최종 승인 후).
