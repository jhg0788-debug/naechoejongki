import Link from "next/link";
import { Shell } from "@/components/Shell";
import { api, isUuid } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "내최종키 · 결제 실패", robots: { index: false } };

export default async function PayFail({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const report = sp.report && isUuid(sp.report) ? sp.report : null;
  const code = (sp.code ?? "").slice(0, 60);
  const message = (sp.message ?? "결제가 취소됐어요.").slice(0, 200);
  const canceled = code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL";
  if (sp.orderId) await api("failOrder", { orderId: sp.orderId, code });

  return (
    <Shell>
      <section className="screen">
        <h2>{canceled ? "결제를 취소했어요" : "결제가 안 됐어요"}</h2>
        <p className="note">{message}</p>
        <p className="note">요금은 청구되지 않았어요.</p>
        <div className="actions">
          {report ? <Link className="btn" href={`/r/${report}/pay`}>다시 결제하기</Link> : null}
          {report ? <Link className="btn text" href={`/r/${report}?p=1`}>리포트로 돌아가기</Link> : <Link className="btn text" href="/">처음으로</Link>}
        </div>
      </section>
    </Shell>
  );
}
