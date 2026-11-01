import type { Metadata } from "next";
import KidsView from "@/components/KidsView";

export const metadata: Metadata = {
  title: "내 아이 기록장 · 내최종키",
  description: "아이 키를 잴 때마다 넣으면 성장 곡선과 예상 범위가 갱신돼요.",
  robots: { index: false, follow: false },
};

export default function KidsPage() {
  return <KidsView />;
}
