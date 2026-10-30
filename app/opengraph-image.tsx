import { ImageResponse } from "next/og";
import { loadFont } from "@/lib/og-font";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "내최종키 · 내 최종 예상키, 범위로 확인";

// 쇼츠 고정댓글·설명란 링크를 붙였을 때 뜨는 미리보기 카드
export default async function Image() {
  const brand = "내최종키";
  const line1 = "내 최종 예상키,";
  const line2 = "범위로 확인해 봐";
  const sub = "부모 키 · 지금 키 · 질병관리청 2017 성장도표 · 만 0~17세 · 1분";
  const [display, body] = await Promise.all([
    loadFont("Black Han Sans", brand + line1 + line2),
    loadFont("Noto Sans KR", sub, 700),
  ]);
  const fonts = [
    ...(display ? [{ name: "Display", data: display, weight: 400 as const }] : []),
    ...(body ? [{ name: "Body", data: body, weight: 700 as const }] : []),
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F2F5F7", fontFamily: "Body" }}>
        <div style={{ width: 90, height: "100%", background: "#FFC93C", display: "flex", flexDirection: "column" }}>
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} style={{ height: 20, display: "flex" }}>
              <div style={{ width: i % 5 === 0 ? 56 : 30, height: 3, background: "#3A2C00" }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "64px 72px", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "Display", fontSize: 44, color: "#13202A" }}>{brand}</div>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Display", fontSize: 104, color: "#13202A", lineHeight: 1.15 }}>
            <div>{line1}</div>
            <div style={{ color: "#FF5A36" }}>{line2}</div>
          </div>
          <div style={{ fontSize: 28, color: "#5B6B77" }}>{sub}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
