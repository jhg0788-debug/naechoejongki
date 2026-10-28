/**
 * 질병관리청 2017 소아청소년 성장도표 · 신장
 *
 * ⚠️ 프로토타입용 근사값이다. 만 나이별 중앙값(M)과 표준편차(S)를 손으로 넣었다.
 * 출시 전, 질병관리청이 배포하는 LMS 원본(월령별 L·M·S)으로 이 파일만 교체하면 된다.
 * 교체할 때는 refAt()이 같은 모양({M,S} 또는 LMS로 계산한 z)을 돌려주도록 유지한다.
 */
export type Sex = "m" | "f";

// index 0 = 만 5세 … 13 = 만 18세
const TABLE: Record<Sex, { M: number[]; S: number[] }> = {
  m: {
    M: [110.0, 116.2, 122.1, 127.9, 133.4, 138.8, 144.7, 151.4, 158.6, 165.0, 169.2, 171.4, 172.6, 173.6],
    S: [4.6, 4.9, 5.2, 5.6, 6.0, 6.4, 7.0, 7.6, 7.8, 7.0, 6.2, 5.9, 5.8, 5.8],
  },
  f: {
    M: [109.0, 115.0, 120.8, 126.7, 132.6, 139.1, 145.8, 151.7, 155.9, 158.3, 159.5, 160.0, 160.6, 160.9],
    S: [4.5, 4.8, 5.1, 5.5, 6.0, 6.5, 6.6, 6.0, 5.5, 5.3, 5.2, 5.2, 5.2, 5.2],
  },
};

export const CHART_MIN_AGE = 5;
export const CHART_MAX_AGE = 18;

export function refAt(sex: Sex, age: number): { M: number; S: number } {
  const a = Math.min(CHART_MAX_AGE, Math.max(CHART_MIN_AGE, age)) - CHART_MIN_AGE;
  const i = Math.floor(a);
  const t = a - i;
  const c = TABLE[sex];
  if (i >= c.M.length - 1) return { M: c.M[c.M.length - 1], S: c.S[c.S.length - 1] };
  return { M: c.M[i] + (c.M[i + 1] - c.M[i]) * t, S: c.S[i] + (c.S[i + 1] - c.S[i]) * t };
}

/** 백분위 선(z) 위의 키 */
export const heightAtZ = (sex: Sex, age: number, z: number) => {
  const r = refAt(sex, age);
  return r.M + z * r.S;
};

function erf(x: number) {
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
