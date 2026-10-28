// 예측 엔진 샘플 실행: npm run test:predict
import { predict, validate, type Inputs } from "../lib/predict.ts";

const now = new Date("2026-10-28");
const cases: [string, Inputs][] = [
  ["중2 남 168 / 아빠175 엄마160 / 사춘기 진행", { sex: "m", birthYear: 2012, birthMonth: 4, height: 168, weight: 55, dad: 175, mom: 160, lastYear: 161, puberty: 2, sleep: 2, exercise: 2, milk: 1 }],
  ["고1 여 160 / 아빠172 엄마158 / 초경 1년+", { sex: "f", birthYear: 2010, birthMonth: 9, height: 160, weight: 50, dad: 172, mom: 158, lastYear: null, puberty: 3, sleep: 1, exercise: 0, milk: 0 }],
  ["초5 남 140 / 아빠180 엄마165 / 사춘기 전 (보호자)", { sex: "m", birthYear: 2015, birthMonth: 2, height: 140, weight: 36, dad: 180, mom: 165, lastYear: 134, puberty: 0, sleep: 3, exercise: 3, milk: 3, under14Consent: true }],
  ["중1 여 150 / 아빠168 엄마155 / 성장속도 빠름", { sex: "f", birthYear: 2013, birthMonth: 6, height: 150, weight: 42, dad: 168, mom: 155, lastYear: 140, puberty: 1, sleep: 2, exercise: 1, milk: 2, under14Consent: true }],
];
for (const [name, x] of cases) {
  validate(x, now);
  const r = predict(x, now);
  console.log(`${name}\n  범위 ${r.lo}~${r.hi}cm · 중앙값 ${r.median} · 상위 ${r.peerTopPct}% · 신뢰도 ${r.confidence} · 남은기간 ${r.remaining} · 습관 ${r.habitLabel}` +
    ` · (MPH ${r.mph} / 백분위 ${r.pctPred})${r.velocityFlag ? " · 속도보정" : ""}`);
}
