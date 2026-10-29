/**
 * 질병관리청 2017 성장도표 '연령별 신장' LMS 표를 앱 데이터로 변환
 *
 * 사용법: npm run import:chart -- ./신장LMS.csv
 * CSV 열 (머리글 이름은 아래 중 하나면 됨, 순서 무관):
 *   성별  : sex | 성별          (1/남/m/male = 남, 2/여/f/female = 여)
 *   월령  : months | 개월 | 월령 | 만나이(개월)   (또는 age_years | 만나이 → ×12)
 *   L, M, S
 * 엑셀이면 '다른 이름으로 저장 → CSV UTF-8'로 저장해서 넣는다.
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("CSV 파일 경로를 넣어 주세요: npm run import:chart -- 파일.csv"); process.exit(1); }

const text = readFileSync(file, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter(l => l.trim());
const head = lines[0].split(",").map(h => h.trim().toLowerCase());
const col = (...names: string[]) => head.findIndex(h => names.some(n => h === n.toLowerCase()));
const iSex = col("sex", "성별"), iMon = col("months", "개월", "월령", "만나이(개월)"), iYr = col("age_years", "만나이", "나이");
const iL = col("l"), iM = col("m"), iS = col("s");
if (iSex < 0 || (iMon < 0 && iYr < 0) || iL < 0 || iM < 0 || iS < 0) {
  console.error("머리글을 찾지 못했어요. 필요: 성별, 월령(또는 만나이), L, M, S\n받은 머리글:", head.join(", "));
  process.exit(1);
}
const out: { source: string; m: any[]; f: any[] } = { source: "질병관리청 2017 소아청소년 성장도표 · 연령별 신장 LMS", m: [], f: [] };
for (const line of lines.slice(1)) {
  const c = line.split(",").map(v => v.trim());
  const sx = c[iSex].toLowerCase();
  const sex = ["1", "남", "남자", "m", "male", "boy"].includes(sx) ? "m" : ["2", "여", "여자", "f", "female", "girl"].includes(sx) ? "f" : null;
  const months = iMon >= 0 ? Number(c[iMon]) : Number(c[iYr]) * 12;
  const L = Number(c[iL]), M = Number(c[iM]), S = Number(c[iS]);
  if (!sex || ![months, L, M, S].every(Number.isFinite)) continue;
  if (months < 5 * 12 - 12 || months > 18 * 12 + 12) continue; // 앱이 쓰는 구간만
  (out as any)[sex].push({ m: months, L, M, S });
}
for (const s of ["m", "f"] as const) out[s].sort((a, b) => a.m - b.m);
if (out.m.length < 10 || out.f.length < 10) { console.error(`행이 너무 적어요 (남 ${out.m.length}, 여 ${out.f.length}).`); process.exit(1); }
const bad = [...out.m, ...out.f].find(r => r.M < 80 || r.M > 200 || r.S <= 0 || r.S > 0.2);
if (bad) { console.error("값 범위가 이상해요. 신장 표가 맞는지 확인해 주세요:", bad); process.exit(1); }
writeFileSync(new URL("../lib/growth-chart-lms.json", import.meta.url), JSON.stringify(out));
console.log(`저장 완료: 남 ${out.m.length}행, 여 ${out.f.length}행 → lib/growth-chart-lms.json`);
console.log(`확인: 남 18세 M=${out.m.at(-1).M}, 여 18세 M=${out.f.at(-1).M}`);
