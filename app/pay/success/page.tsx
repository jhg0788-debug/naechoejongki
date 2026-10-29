import { redirect } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/server";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "내최종키 · 결제 확인", robots: { index: false } };

type Outcome = { ok: boolean; reportId: string | null; message?: string; code?: string };

// 토스 결제창 → successUrl?paymentKey&orderId&amount 로 돌아오면 nk-api가 금액 대조 후 승인한다
export default async function PaySuccess({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const r = await api<Outcome>("confirmPayment", { paymentKey: sp.paymentKey ?? "", orderId: sp.orderId ?? "", amount: Number(sp.amount) });
  const outcome: Outcome = r.data?.ok !== undefined ? r.data : { ok: false, reportId: null, message: "결제를 확인하지 못했어요." };
  if (outcome.ok && outcome.reportId) redirect(`/r/${outcome.reportId}?p=1&paid=1`);

  return (
    <Shell>
      <section className="screen">
        <h2>결제를 완료하지 못했어요</h2>
        <p className="note">{outcome.message}{outcome.code ? ` (${outcome.code})` : ""}</p>
        <p className="note">결제가 승인되지 않았다면 요금은 청구되지 않아요.</p>
        <div className="actions">
          {outcome.reportId ? <Link className="btn" href={`/r/${outcome.reportId}/pay`}>다시 결제하기</Link> : null}
          <Link className="btn text" href="/">처음으로</Link>
        </div>
      </section>
    </Shell>
  );
}
