import { notFound, redirect } from "next/navigation";
import { api, isUuid, PRODUCTS } from "@/lib/server";
import PayWidget from "@/components/PayWidget";

export const dynamic = "force-dynamic";
export const metadata = { title: "내최종키 · 상세 리포트 결제", robots: { index: false } };

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [rep, cfg] = await Promise.all([api("getReport", { id }), api("config")]);
  if (!rep.ok) notFound();
  if (rep.data.paid) redirect(`/r/${id}?p=1`);
  const { lo, hi } = rep.data.free as { lo: number; hi: number };
  return <PayWidget reportId={id} clientKey={cfg.data?.tossClientKey || ""} product={PRODUCTS.report_single} range={`${lo}~${hi}cm`} />;
}
