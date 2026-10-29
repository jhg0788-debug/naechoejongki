/**
 * 질병관리청 2017 소아청소년 성장도표 · 연령별 신장 (LMS)
 *
 * 공식 LMS 표가 lib/growth-chart-lms.json 에 있으면 그것을 쓰고,
 * 없으면 아래 근사값(만 나이별 M·S, L=1)을 쓴다.
 * 공식 표 넣는 법: README의 '성장도표 원본 넣기' 참고 (npm run import:chart -- 파일.csv)
 */
import lms from "./growth-chart-lms.json" with { type: "json" };

export type Sex = "m" | "f";
type Row = { m: number; L: number; M: number; S: number }; // m = 월령
type Table = Record<Sex, Row[]>;

// 근사값: index 0 = 만 5세 … 13 = 만 18세
const APPROX: Record<Sex, { M: number[]; S: number[] }> = {
  m: {
    M: [110.0, 116.2, 122.1, 127.9, 133.4, 138.8, 144.7, 151.4, 158.6, 165.0, 169.2, 171.4, 172.6, 173.6],
    S: [4.6, 4.9, 5.2, 5.6, 6.0, 6.4, 7.0, 7.6, 7.8, 7.0, 6.2, 5.9, 5.8, 5.8],
  },
  f: {
    M: [109.0, 115.0, 120.8, 126.7, 132.6, 139.1, 145.8, 151.7, 155.9, 158.3, 159.5, 160.0, 160.6, 160.9],
    S: [4.5, 4.8, 5.1, 5.5, 6.0, 6.5, 6.6, 6.0, 5.5, 5.3, 5.2, 5.2, 5.2, 5.2],
  },
};
// 근사값의 S는 cm 단위 표준편차라 LMS의 S(변동계수)로 바꿔 넣는다
const approxTable = (): Table => {
  const t = { m: [] as Row[], f: [] as Row[] };
  for (const sex of ["m", "f"] as Sex[])
    APPROX[sex].M.forEach((M, i) => t[sex].push({ m: (5 + i) * 12, L: 1, M, S: APPROX[sex].S[i] / M }));
  return t;
};

const official = lms as unknown as Partial<Table> & { source?: string };
const TABLE: Table = official.m?.length && official.f?.length ? (official as Table) : approxTable();
export const CHART_SOURCE = official.m?.length ? (official.source ?? "질병관리청 2017 성장도표 LMS") : "근사값(프로토타입)";

export const CHART_MIN_AGE = 5;
export const CHART_MAX_AGE = 18;

function lmsAt(sex: Sex, age: number): { L: number; M: number; S: number } {
  const months = Math.min(CHART_MAX_AGE, Math.max(CHART_MIN_AGE, age)) * 12;
  const rows = TABLE[sex];
  if (months <= rows[0].m) return rows[0];
  if (months >= rows[rows.length - 1].m) return rows[rows.length - 1];
  let i = 0;
  while (i < rows.length - 2 && rows[i + 1].m < months) i++;
  const a = rows[i], b = rows[i + 1], t = (months - a.m) / (b.m - a.m);
  return { L: a.L + (b.L - a.L) * t, M: a.M + (b.M - a.M) * t, S: a.S + (b.S - a.S) * t };
}

/** 키 → z점수 */
export function zAt(sex: Sex, age: number, height: number): number {
  const { L, M, S } = lmsAt(sex, age);
  return Math.abs(L) < 1e-6 ? Math.log(height / M) / S : (Math.pow(height / M, L) - 1) / (L * S);
}

/** z점수 선 위의 키 */
export function heightAtZ(sex: Sex, age: number, z: number): number {
  const { L, M, S } = lmsAt(sex, age);
  return Math.abs(L) < 1e-6 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

/** 중앙값 (예측 로직의 성장속도 비교용) */
export const medianAt = (sex: Sex, age: number) => lmsAt(sex, age).M;

function erf(x: number) {
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
