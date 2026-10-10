import { test } from 'node:test';
import assert from 'node:assert/strict';
import { medicalCandidates, classifyPharmacyItem, medicalCheck, glassesDeductible, cultureCheck } from '../src/yearEndTax.js';
import { makeDemoTransactions } from './fixtures.js';

test('의료비 후보: 데모의 내과·약국 6건, 합계 270,000', () => {
  const c = medicalCandidates(makeDemoTransactions());
  assert.equal(c.length, 6);
  assert.equal(c.reduce((s, t) => s + t.amount, 0), 270000);
});

test('약국 품목: 치료용 의약품만 의료비', () => {
  assert.equal(classifyPharmacyItem('타이레놀'), 'medical');
  assert.equal(classifyPharmacyItem('비타민C'), 'excluded');
  assert.equal(classifyPharmacyItem('종합영양제'), 'excluded');
  assert.equal(classifyPharmacyItem('반창고'), 'excluded');
});

test('3% 문턱: 연봉 4,200만 원이면 문턱 126만 원, 지금 속도로는 공제 0', () => {
  const r = medicalCheck({ salary: 42000000, medicalSoFar: 270000, monthsCovered: 3 });
  assert.equal(r.threshold, 1260000);
  assert.equal(r.projectedYear, 1080000);
  assert.equal(r.deductible, 0);
  assert.equal(r.willDeduct, false);
});

test('3% 문턱을 넘으면 넘은 만큼 공제', () => {
  const r = medicalCheck({ salary: 42000000, medicalSoFar: 600000, monthsCovered: 3 });
  assert.equal(r.projectedYear, 2400000);
  assert.equal(r.deductible, 1140000);
  assert.equal(r.willDeduct, true);
});

test('안경은 연 50만 원 한도', () => {
  assert.equal(glassesDeductible(700000), 500000);
  assert.equal(glassesDeductible(300000), 300000);
});

test('문화비: 총급여 7천만 원 초과면 대상 아님, 이하면 확인 필요', () => {
  assert.equal(cultureCheck({ salary: 42000000, gymAmount: 59000 }), 'needsVerification');
  assert.equal(cultureCheck({ salary: 80000000, gymAmount: 59000 }), 'notEligible');
});
