import { heightAtZ, medianAt, normCdf, zAt, type Sex } from "./growth-chart.ts";

/**
 * 예측 로직 (기획서 '예측 로직' 그대로)
 * 1) 유전 예상키 = 중간부모키 (남 +13, 여 −13) / 2
 * 2) 백분위 유지 예측 = 지금 나이·키의 z를 만 18세에 그대로 적용
 * 3) 가중평균 + 사춘기 단계 보정, 성장속도로 범위 폭 보정
 * 생활습관은 cm를 더하거나 빼지 않는다. 범위 안 위치(아래·가운데·위)만 표시한다.
 */

export type Puberty = 0 | 1 | 2 | 3; // 전 · 초기 · 진행 · 후반
export interface Inputs {
  sex: Sex;
  birthYear: number;
  birthMonth: number; // 1~12
  height: number;
  weight: number | null;
  dad: number;
  mom: number;
  lastYear: number | null;
  puberty: Puberty;
  sleep: 0 | 1 | 2 | 3 | 4;
  exercise: 0 | 1 | 2 | 3;
  milk: 0 | 1 | 2 | 3;
  under14Consent?: boolean;
}

export interface FreeResult {
  lo: number;
  hi: number;
  peerTopPct: number; // 또래 중 상위 몇 %
  confidence: "높음" | "보통" | "낮음";
  ageYears: number;
  ageMonths: number;
}
export interface FullResult extends FreeResult {
  median: number;
  mph: number;
  pctPred: number;
  remaining: string;
  toGo: number;
  zNow: number;
  zFinal: number;
  habitPos: number; // 0~1, 범위 안 위치
  habitLabel: "범위 아래쪽" | "범위 가운데" | "범위 위쪽";
  wide: boolean;
  velocityFlag: boolean;
  halfWidth: number;
}

export function ageInYears(birthYear: number, birthMonth: number, now = new Date()) {
  return ((now.getFullYear() - birthYear) * 12 + (now.getMonth() + 1 - birthMonth)) / 12;
}

const PCT_WEIGHT = [0.35, 0.5, 0.65, 0.8] as const;
const MIN_REMAINING = [8, 6, 3, 0.5] as const;
const BASE_HALF = [5, 4.5, 3.5, 2.5] as const;
const REMAIN_M = ["약 4~6년", "약 3~5년", "약 2~3년", "1년 안팎"] as const;
const REMAIN_F = ["약 4~6년", "약 2~4년", "약 1~2년", "1년 안팎"] as const;

export class InputError extends Error {}

/** 남은 성장 기간: 사춘기 전 어린 나이는 '성장이 거의 끝나는 나이'(남 17, 여 15세)까지 남은 햇수로 */
function remainingText(sex: Sex, puberty: Puberty, age: number) {
  if (puberty === 0) {
    const left = Math.round((sex === "m" ? 17 : 15) - age);
    if (left > 6) return `약 ${left}년`;
  }
  return (sex === "m" ? REMAIN_M : REMAIN_F)[puberty];
}

export function validate(x: Inputs, now = new Date()): void {
  const age = ageInYears(x.birthYear, x.birthMonth, now);
  const inRange = (v: number, a: number, b: number) => Number.isFinite(v) && v >= a && v <= b;
  if (x.sex !== "m" && x.sex !== "f") throw new InputError("성별을 골라 주세요.");
  if (!(x.birthMonth >= 1 && x.birthMonth <= 12) || !(age >= 0 && age < 18)) throw new InputError("만 18세 미만만 계산할 수 있어요.");
  if (age < 14 && !x.under14Consent) throw new InputError("만 14세 미만은 보호자 확인이 필요해요.");
  if (!inRange(x.height, 40, 200)) throw new InputError("지금 키는 40~200cm 사이로 입력해 주세요.");
  if (x.weight != null && !inRange(x.weight, 2, 150)) throw new InputError("몸무게는 2~150kg 사이로 입력해 주세요.");
  if (!inRange(x.dad, 145, 205)) throw new InputError("아빠 키는 145~205cm 사이로 입력해 주세요.");
  if (!inRange(x.mom, 135, 190)) throw new InputError("엄마 키는 135~190cm 사이로 입력해 주세요.");
  if (x.lastYear != null && !inRange(x.lastYear, 40, x.height)) throw new InputError("작년 키는 지금 키보다 작거나 같아야 해요.");
  if (![0, 1, 2, 3].includes(x.puberty)) throw new InputError("사춘기 신호를 골라 주세요.");
  if (![0, 1, 2, 3, 4].includes(x.sleep) || ![0, 1, 2, 3].includes(x.exercise) || ![0, 1, 2, 3].includes(x.milk))
    throw new InputError("생활습관 문항을 모두 골라 주세요.");
}

export function predict(x: Inputs, now = new Date()): FullResult {
  const age = ageInYears(x.birthYear, x.birthMonth, now);
  const mph = x.sex === "m" ? (x.dad + x.mom + 13) / 2 : (x.dad + x.mom - 13) / 2;
  const zNow = zAt(x.sex, age, x.height);
  const pctPred = heightAtZ(x.sex, 18, zNow);

  // 어릴수록 지금 백분위가 최종 키를 덜 말해준다 (만 2~3세 전에는 성장 궤도가 자주 바뀐다)
  let w: number = PCT_WEIGHT[x.puberty];
  if (age < 8) w = Math.min(w, 0.3);
  if (age < 4) w = Math.min(w, 0.2);
  if (age < 2) w = Math.min(w, 0.1);
  let median = (1 - w) * mph + w * pctPred;
  const minAdd = MIN_REMAINING[x.puberty];
  if (age < 17.5 && median < x.height + minAdd) median = x.height + minAdd;
  if (median < x.height) median = x.height;

  let half: number = BASE_HALF[x.puberty];
  if (x.lastYear == null) half += 1;
  if (age < 4) half += 1;
  if (age < 2) half += 1;
  let velocityFlag = false;
  if (x.lastYear != null) {
    const v = x.height - x.lastYear;
    const expected = medianAt(x.sex, age) - medianAt(x.sex, age - 1);
    if (v > 0 && Math.abs(v - expected) > 2.5) {
      half += 1.5;
      velocityFlag = true;
    }
  }
  if (Math.abs(mph - pctPred) > 8) half += 1;

  // 사춘기 후반엔 남은 성장이 작으므로 지금 키 + 최대치로 막는다.
  // 막힐 때는 범위 폭은 유지하고 중앙값을 아래로 옮긴다 (예: 한창 사춘기인데 지금 키가 작은 경우)
  const maxAdd = (x.sex === "m" ? [Infinity, Infinity, 16, 5] : [Infinity, Infinity, 9, 3])[x.puberty];
  const cap = x.height + maxAdd;
  const capped = median + half > cap;
  if (capped) median = Math.max(x.height + minAdd, Math.min(median, cap - half));
  const lo = Math.round(Math.max(x.height, median - half));
  const hi = Math.round(Math.max(lo + 2, Math.min(median + half, cap)));
  const peerTopPct = Math.max(1, Math.min(99, 100 - Math.round(normCdf(zNow) * 100)));
  const confidence = capped ? (half <= 5 ? "보통" : "낮음") : half <= 3.5 ? "높음" : half <= 5 ? "보통" : "낮음";

  const score = [0, 1, 2, 3, 3][x.sleep] + x.exercise + x.milk; // 0~9
  const habitPos = 0.2 + 0.6 * (score / 9);
  const habitLabel = habitPos < 0.4 ? "범위 아래쪽" : habitPos > 0.6 ? "범위 위쪽" : "범위 가운데";

  return {
    lo, hi, peerTopPct, confidence,
    ageYears: Math.floor(age), ageMonths: Math.round((age % 1) * 12) % 12,
    median: Math.round(median * 10) / 10,
    mph: Math.round(mph * 10) / 10,
    pctPred: Math.round(pctPred * 10) / 10,
    remaining: remainingText(x.sex, x.puberty, age),
    toGo: Math.round((median - x.height) * 10) / 10,
    zNow, zFinal: zAt(x.sex, 18, median),
    habitPos, habitLabel,
    wide: half >= 5 || capped, velocityFlag, halfWidth: half,
  };
}

/** 결제 전 공개되는 필드만 남긴다 */
export function toFree(r: FullResult): FreeResult {
  const { lo, hi, peerTopPct, confidence, ageYears, ageMonths } = r;
  return { lo, hi, peerTopPct, confidence, ageYears, ageMonths };
}
