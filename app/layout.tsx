import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

const site = (process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
  || "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "내최종키 · 예상키 범위 확인",
  description: "엄마·아빠 키와 아이의 지금 키, 사춘기 단계로 만 18세 무렵 예상키 범위를 확인해요. 질병관리청 공식 성장도표 기준 참고용 서비스.",
  openGraph: {
    title: "내최종키 · 우리 아이 최종 키는?",
    description: "질문 10개, 1분이면 아이 예상키 범위가 나와요.",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F2F5F7" }, { media: "(prefers-color-scheme: dark)", color: "#0E151B" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500;600&display=swap" />
      </head>
      <body>
        {children}
        {kakaoKey ? (
          <Script id="kakao-sdk" src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" strategy="afterInteractive" />
        ) : null}
      </body>
    </html>
  );
}
