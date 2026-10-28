import { heightAtZ, type Sex } from "@/lib/growth-chart";

/** 성장도표 3·50·97 백분위 + 지금 위치에서 만 18세까지 예상 경로 */
export function GrowthChart({ sex, age, height, zNow, zFinal, lo, hi }: {
  sex: Sex; age: number; height: number; zNow: number; zFinal: number; lo: number; hi: number;
}) {
  const W = 340, H = 230, L = 34, R = 14, T = 12, B = 26, a0 = 5, a1 = 18;
  const h0 = sex === "m" ? 100 : 95, h1 = sex === "m" ? 200 : 185;
  const X = (a: number) => L + ((a - a0) / (a1 - a0)) * (W - L - R);
  const Y = (h: number) => T + ((h1 - h) / (h1 - h0)) * (H - T - B);
  const line = (z: number) => {
    let d = "";
    for (let a = a0; a <= a1 + 1e-9; a += 0.5) d += (d ? "L" : "M") + X(a).toFixed(1) + "," + Y(heightAtZ(sex, a, z)).toFixed(1);
    return d;
  };
  let path = "";
  for (let k = 0; k <= 24; k++) {
    const t = k / 24, a = age + (18 - age) * t;
    path += (path ? "L" : "M") + X(a).toFixed(1) + "," + Y(heightAtZ(sex, a, zNow + (zFinal - zNow) * t)).toFixed(1);
  }
  const gridStep = 20;
  const grid: number[] = [];
  for (let h = Math.ceil(h0 / gridStep) * gridStep; h <= h1; h += gridStep) grid.push(h);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`성장 곡선: 3·50·97 백분위와 만 18세 예상 범위 ${lo}~${hi}cm`}>
      {grid.map(h => (
        <g key={h}>
          <line x1={L} x2={W - R} y1={Y(h)} y2={Y(h)} stroke="var(--line)" strokeWidth={1} />
          <text x={L - 6} y={Y(h) + 4} textAnchor="end" fontSize={10} fill="var(--muted)">{h}</text>
        </g>
      ))}
      {[6, 8, 10, 12, 14, 16, 18].map(a => (
        <text key={a} x={X(a)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">{a}세</text>
      ))}
      <rect x={X(18) - 7} y={Y(hi)} width={14} height={Math.max(2, Y(lo) - Y(hi))} fill="var(--band)" stroke="var(--accent)" strokeWidth={1.5} />
      <path d={line(-1.881)} fill="none" stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
      <path d={line(0)} fill="none" stroke="var(--muted)" strokeWidth={1.5} />
      <path d={line(1.881)} fill="none" stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={X(age)} cy={Y(height)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
      <text x={X(age) + 8} y={Y(height) + 14} fontSize={10} fill="var(--ink)">지금 {height}</text>
    </svg>
  );
}
