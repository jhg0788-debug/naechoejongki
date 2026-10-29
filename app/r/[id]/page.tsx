import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api, isUuid } from "@/lib/server";
import ReportView, { type ReportData } from "@/components/ReportView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내최종키 · 예상키 리포트",
  robots: { index: false, follow: false },
};

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
  const view = sp.p === "1" ? "parent" : "child";
  return <ReportView report={r.data} view={view} justPaid={sp.paid === "1"} />;
}
