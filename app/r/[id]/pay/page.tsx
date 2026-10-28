import { notFound, redirect } from "next/navigation";
import { db, isUuid, PRODUCTS } from "@/lib/server";
import PayWidget from "@/components/PayWidget";

export const dynamic = "force-dynamic";
export const metadata = { title: "내최종키 · 상세 리포트 결제", robots: { index: false } };

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data } = await db().from("reports").select("id, paid, result").eq("id", id).maybeSingle();
  if (!data) notFound();
  if (data.paid) redirect(`/r/${id}?p=1`);
  const r = data.result as { lo: number; hi: number };
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
  return <PayWidget reportId={id} clientKey={clientKey} product={PRODUCTS.report_single} range={`${r.lo}~${r.hi}cm`} />;
}
