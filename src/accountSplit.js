import { EMERGENCY_MONTHS, SPEND_CUT_RATE } from './constants.js';

// '급여'로 표시된 입금만 월급으로 센다(더치페이 입금 제외).
export function monthlySalary(txs) {
  const pays = txs.filter((t) => t.kind === 'income' && t.isSalary === true && !t.canceled);
  const months = new Set(pays.map((t) => t.date.slice(0, 7))).size;
  return months ? Math.round(pays.reduce((s, t) => s + t.amount, 0) / months) : 0;
}

// 네 칸의 합은 항상 월급이다. 해지로 아낀 돈(leakSavings)은 고정비에서 빼서 저축·투자 칸에 더한다.
export function splitPlan({ salary, fixedCosts, avgLiving, leakSavings = 0, emergencyNow = 0, emergencyRatio = 0.4, cutRate = SPEND_CUT_RATE, emergencyMonths = EMERGENCY_MONTHS }) {
  const living = Math.round(avgLiving * (1 - cutRate));
  const remaining = salary - fixedCosts - living;
  const emergency = remaining > 0 ? Math.round(remaining * emergencyRatio) : 0;
  const invest = (remaining > 0 ? remaining - emergency : 0) + leakSavings;
  const emergencyGoal = (fixedCosts + living) * emergencyMonths;
  const gap = emergencyGoal - emergencyNow;
  const monthsToGoal = gap <= 0 ? 0 : emergency > 0 ? Math.ceil(gap / emergency) : null;
  return {
    fixed: fixedCosts - leakSavings, living, livingPerWeek: Math.round((living * 12) / 52),
    emergency, invest, emergencyGoal, monthsToGoal, deficit: Math.max(0, -remaining),
  };
}
