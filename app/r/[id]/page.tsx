import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api, isUuid } from "@/lib/server";
import ReportView, { type ReportData } from "@/components/ReportView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = isUuid(id) ? await api<ReportData>("getReport", { id }) : null;
  const range = r?.ok ? `${r.data.free.lo}~${r.data.free.hi}cm` : "";
  const title = range ? `예상키 범위 ${range} · 내최종키` : "내최종키 · 예상키 리포트";
  return {
    title,
    description: "만 18세 무렵 예상키 범위. 질병관리청 공식 성장도표 기준 참고용 계산이에요.",
    openGraph: { title, description: "상세 리포트에서 가장 가능성 높은 키와 성장 곡선을 볼 수 있어요." },
    robots: { index: false, follow: false },
  };
}

export default async function ReportPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  // 결제 전에는 nk-api가 잠금 필드를 아예 내려주지 않는다
  const r = await api<ReportData>("getReport", { id });
  if (!r.ok) notFound();
  // p=1: 자녀가 보낸 링크로 들어온 보호자 · p=2: 보호자가 직접 입력 · 없음: 10대 본인
  const view = sp.p === "1" ? "parent" : sp.p === "2" ? "guardian" : "child";
  return <ReportView report={r.data} view={view} justPaid={sp.paid === "1"} />;
}
