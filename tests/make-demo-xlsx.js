// 데모 거래를 카드사/은행 엑셀처럼 어수선한 모양(제목줄, 천 단위 쉼표 문자열, 시각 포함)으로 내보낸다.
// 사용: node tests/make-demo-xlsx.js  →  demo/ 폴더에 xlsx 3개
import { createRequire } from 'node:module';
import fs, { mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeDemoTransactions } from './fixtures.js';

// package.json이 ESM이라 UMD 파일은 .js로 require할 수 없다. .cjs 임시 복사본으로 읽는다.
const cjs = join(tmpdir(), 'money-automation-xlsx.cjs');
copyFileSync('vendor/xlsx.full.min.js', cjs);
const XLSX = createRequire(import.meta.url)(cjs);
XLSX.set_fs(fs);
mkdirSync('demo', { recursive: true });

const txs = makeDemoTransactions();
const fmtDate = (d) => `${d.replace(/-/g, '.')} 14:22`;
const won = (n) => `${n.toLocaleString('en-US')}원`;

function save(account, header, rows, title) {
  const aoa = [[title], ['조회기간: 2026.07.01 ~ 2026.09.30'], [], header, ...rows];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
  XLSX.writeFile(wb, `demo/${account}.xlsx`);
}

for (const account of ['혼잡카드', '체크카드']) {
  const rows = txs.filter((t) => t.account === account).sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [fmtDate(t.date), t.merchant, won(t.amount), t.installmentMonths ? String(t.installmentMonths) : '일시불', '']);
  save(account, ['이용일', '가맹점명', '이용금액', '할부개월', '취소여부'], rows, `${account} 이용내역`);
}
const bank = txs.filter((t) => t.account === '국민은행').sort((a, b) => a.date.localeCompare(b.date))
  .map((t) => [fmtDate(t.date), t.merchant, t.kind === 'income' ? '' : won(t.amount), t.kind === 'income' ? won(t.amount) : '']);
save('국민은행', ['거래일자', '적요', '출금액', '입금액'], bank, '국민은행 거래내역');
console.log('demo/ 에 3개 파일을 만들었습니다.');
