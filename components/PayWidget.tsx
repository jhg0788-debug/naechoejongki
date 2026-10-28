"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ANONYMOUS, loadTossPayments, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { Shell } from "./Shell";
import { sessionId, track } from "@/lib/track";

type Order = { orderId: string; amount: number; orderName: string };

export default function PayWidget({ reportId, clientKey, product, range }: {
  reportId: string; clientKey: string; product: { name: string; amount: number }; range: string;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const widgets = useRef<TossPaymentsWidgets | null>(null);
  const order = useRef<Order | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track("pay_view", { report_id: reportId });
    (async () => {
      try {
        if (!clientKey) throw new Error("결제 설정(NEXT_PUBLIC_TOSS_CLIENT_KEY)이 아직 없어요.");
        const res = await fetch("/api/orders", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ report_id: reportId, session_id: sessionId() }),
        });
        const body = await res.json();
        if (res.status === 409 && body?.paid) { location.href = `/r/${reportId}?p=1`; return; }
        if (!res.ok) throw new Error(body?.error || "주문을 만들지 못했어요.");
        order.current = body;

        const toss = await loadTossPayments(clientKey);
        const w = toss.widgets({ customerKey: ANONYMOUS });
        await w.setAmount({ currency: "KRW", value: body.amount });
        await Promise.all([
          w.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
          w.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
        ]);
        widgets.current = w;
        setReady(true);
      } catch (e: any) {
        setErr(e?.message || "결제 화면을 불러오지 못했어요.");
      }
    })();
  }, [clientKey, reportId]);

  const pay = async () => {
    if (!widgets.current || !order.current) return;
    setBusy(true); setErr("");
    try {
      await widgets.current.requestPayment({
        orderId: order.current.orderId,
        orderName: order.current.orderName,
        successUrl: `${location.origin}/pay/success`,
        failUrl: `${location.origin}/pay/fail?report=${reportId}`,
      });
    } catch (e: any) {
      // 사용자가 결제창을 닫은 경우 등
      setErr(e?.code === "USER_CANCEL" ? "" : e?.message || "결제를 요청하지 못했어요.");
      setBusy(false);
    }
  };

  return (
    <Shell onBack={() => history.back()}>
      <section className="screen">
        <div>
          <div className="eyebrow">상세 리포트 결제</div>
          <h2 style={{ marginTop: 6 }}>{product.name}</h2>
          <p className="note" style={{ marginTop: 6 }}>예상 범위 {range}의 중앙값, 남은 성장 기간, 성장 곡선, 생활습관 위치를 볼 수 있어요.</p>
        </div>
        <div className="lockitem" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="nm">결제 금액<small>1회 결제 · 정기결제 아님</small></div>
          <div className="price">{product.amount.toLocaleString("ko-KR")}원</div>
        </div>
        <div className="paybox">
          <div id="payment-method" />
          <div id="agreement" />
        </div>
        {err ? <p className="err" role="alert">{err}</p> : null}
        <div className="actions">
          <button className="btn" disabled={!ready || busy} onClick={pay}>
            {busy ? "결제창 여는 중…" : `${product.amount.toLocaleString("ko-KR")}원 결제하기`}
          </button>
          <Link className="btn text" href={`/r/${reportId}?p=1`}>리포트로 돌아가기</Link>
        </div>
        <p className="note">보호자 본인 명의 결제수단으로 결제해 주세요.</p>
      </section>
    </Shell>
  );
}
