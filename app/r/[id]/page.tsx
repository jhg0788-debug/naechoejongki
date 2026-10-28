import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db, isUuid } from "@/lib/server";
import { toFree, type FullResult } from "@/lib/predict";
import ReportView, { type ReportData } from "@/components/ReportView";
import { PRODUCTS } from "@/lib/server";

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

  const { data } = await db().from("reports").select("id, sex, inputs, result, paid, expires_at").eq("id", id).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) notFound();

  const full = data.result as FullResult;
  const inputs = data.inputs as Record<string, any>;
  // 결제 전에는 잠금 필드를 브라우저로 보내지 않는다
  const report: ReportData = {
    id: data.id,
    sex: data.sex,
    height: inputs.height,
    paid: data.paid,
    free: toFree(full),
    full: data.paid ? full : null,
    habits: data.paid ? { sleep: inputs.sleep, exercise: inputs.exercise, milk: inputs.milk, weight: inputs.weight ?? null } : null,
    price: PRODUCTS.report_single.amount,
  };
  const view = sp.p === "1" ? "parent" : "child";
  return <ReportView report={report} view={view} justPaid={sp.paid === "1"} />;
}
