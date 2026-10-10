# 돈 관리 자동화 — 작업 안내 (Claude Code용)

카드·은행 엑셀을 브라우저에서 분석하는 정적 웹앱. 서버 없음, 데이터는 브라우저 IndexedDB에만 저장.
배포: GitHub Pages (`main` 푸시 = 배포). 사이트: https://oldhill-kr.github.io/money-automation/

## 작업 흐름 (어느 PC에서든 동일)
1. 저장소가 없으면: `git clone https://github.com/oldhill-kr/money-automation.git`, 있으면 먼저 `git pull`.
2. 수정 → `npm test` (Node 18+, 외부 패키지 없음) 통과 확인.
3. 화면 확인이 필요하면 `python serve.py 8791` 후 `http://localhost:8791` (no-store 헤더라 JS 캐시 문제 없음).
4. 사용자가 "올려줘"를 하지 않아도, 기능 수정이 끝나고 테스트가 통과하면 `main`에 커밋·푸시한다 (사용자가 GitHub 자동 반영을 요청함).
   커밋 메시지는 한국어로 변경 요지를 적는다.
5. 푸시 후 사용자에게 바뀐 점과 "사이트는 1~2분 뒤 Ctrl+F5"를 알린다.

## 꼭 지킬 것
- **외부 통신 금지**: `fetch`/XHR/CDN/분석 스크립트를 넣지 않는다. 화면에 "파일은 내 컴퓨터 밖으로 나가지 않아요"라고 약속했다.
- **엑셀 속 문자열은 항상 텍스트 노드로**: `src/ui/dom.js`의 `h()`만 쓰고 `innerHTML`을 쓰지 않는다.
- 계산 모듈(`src/*.js`)은 DOM을 모른다. 화면은 `src/ui/`.
- 세법 수치는 `src/constants.js`에서만 바꾼다.

## 데이터 모델 메모
- 거래: `{date, merchant, amount, account, kind(expense|cardPayment|saving|income), category, canceled, memo, installmentMonths, estimated, source}`.
- **취소 거래는 마이너스 금액**(`parser.negateCancel`)으로 저장해 원래 결제와 상쇄한다. `canceled` 플래그로 합계에서 빼지 않는다.
- 중복 제거 키: `날짜|가맹점|금액|계좌` (`store.dedupeKey`). 같은 파일을 다시 올려도 늘지 않는다.
- 계좌 이름은 파일 이름에서 숫자를 떼어 만든다(`upload.accountFromFileName`), 같은 카드의 월별 파일이 합쳐지게.
- CSV는 UTF-8/EUC-KR 자동 판별. 열 인식 실패 시 사용자가 열을 지정하는 화면이 뜬다.

## 분류 규칙 우선순위 (`src/classifier.js`)
입금/카드대금/저축 판별 → 가맹점별 규칙(`rules.categories`, 지점명 뗀 `merchantKey`) → 키워드 규칙(`rules.keywords`) → 패턴(휴게소·구독·관공서·쇼핑) → 기본 키워드.
새 기본 규칙을 넣으면 `tests/classifier.test.js`에 사례를 추가한다. 앱 로드 시 분류가 비어 있는 지출은 현재 규칙으로 다시 분류된다(`main.normalize`).

## 사용자(데이터) 관련 주의
- 브라우저 저장소는 **주소별·브라우저별로 분리**된다. localhost와 github.io, 크롬과 엣지의 데이터는 서로 보이지 않는다.
  옮길 때는 설정·백업 탭의 "백업 내려받기" → 다른 곳에서 "백업 불러오기". 사용자 데이터를 개발 중 시험하다 지우지 않도록 시험은 별도 브라우저 프로필이나 가상 데이터로 한다.
- 줄바꿈: Windows에서 `core.autocrlf=true`라 diff가 전부 달라 보일 수 있다. 내용 비교는 `tr -d '\r'` 후에 한다.
