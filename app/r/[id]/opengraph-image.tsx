import { ImageResponse } from "next/og";
import { api, isUuid } from "@/lib/server";
import { loadFont } from "@/lib/og-font";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "내최종키 예상키 리포트";

type R = { sex: "m" | "f"; height: number; free: { lo: number; hi: number; ageYears: number; ageMonths: number } };

// 카톡·문자로 리포트 링크를 보낼 때 뜨는 미리보기 카드. 무료로 공개되는 범위만 담는다.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = isUuid(id) ? await api<R>("getReport", { id }) : null;
  const ok = !!r?.ok;
  const d = r?.data;

  const age = ok ? (d!.free.ageYears >= 2 ? `만 ${d!.free.ageYears}세` : `${d!.free.ageYears * 12 + d!.free.ageMonths}개월`) : "";
  const who = ok ? `${age} ${d!.sex === "m" ? "남자" : "여자"} · 지금 ${d!.height}cm` : "";
  const range = ok ? `${d!.free.lo} – ${d!.free.hi}` : "예상키 범위";
  const title = "만 18세 무렵 예상키 범위";
  const foot = "상세 리포트: 가장 가능성 높은 키 · 성장 곡선 · 남은 성장 기간";
  const brand = "내최종키";

  const [display, body] = await Promise.all([
    loadFont("Black Han Sans", brand + range + "cm–0123456789 "),
    loadFont("Noto Sans KR", who + title + foot + "0123456789·cm ", 700),
  ]);
  const fonts = [
    ...(display ? [{ name: "Display", data: display, weight: 400 as const }] : []),
    ...(body ? [{ name: "Body", data: body, weight: 700 as const }] : []),
  ];

  // 신장계 눈금: 140~200cm, 예상 범위를 띠로
  const a = 140, b = 200, pct = (v: number) => ((Math.min(b, Math.max(a, v)) - a) / (b - a)) * 100;
  const lo = ok ? d!.free.lo : 165, hi = ok ? d!.free.hi : 178;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F2F5F7", fontFamily: "Body" }}>
        {/* 줄자 */}
        <div style={{ width: 90, height: "100%", background: "#FFC93C", display: "flex", flexDirection: "column" }}>
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} style={{ height: 20, display: "flex", alignItems: "flex-start" }}>
              <div style={{ width: i % 5 === 0 ? 56 : 30, height: 3, background: "#3A2C00" }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 64px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "Display", fontSize: 44, color: "#13202A" }}>{brand}</div>
            <div style={{ fontSize: 26, color: "#5B6B77" }}>{who}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, color: "#5B6B77" }}>{title}</div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 8 }}>
              <div style={{ fontFamily: "Display", fontSize: 168, color: "#13202A", lineHeight: 1 }}>{range}</div>
              <div style={{ fontSize: 48, color: "#5B6B77", marginLeft: 18 }}>cm</div>
            </div>
            <div style={{ position: "relative", height: 54, marginTop: 28, background: "#E7ECF0", borderRadius: 6, display: "flex" }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`, background: "#FFE3D9", borderLeft: "5px solid #FF5A36", borderRight: "5px solid #FF5A36" }} />
            </div>
          </div>
          <div style={{ fontSize: 24, color: "#5B6B77" }}>{foot}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
