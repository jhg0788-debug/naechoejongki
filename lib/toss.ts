import "server-only";
import { db, logEvent } from "./server";

/**
 * 토스페이먼츠 결제 승인
 * - 주문 금액은 DB 값과 대조한다 (쿼리스트링 금액 위조 방지)
 * - Idempotency-Key = orderId 로 중복 승인 방지
 */
export type ConfirmOutcome =
  | { ok: true; reportId: string }
  | { ok: false; reportId: string | null; message: string; code?: string };

export async function confirmPayment(paymentKey: string, orderId: string, amount: number): Promise<ConfirmOutcome> {
  const { data: order } = await db().from("orders").select("*").eq("order_id", orderId).maybeSingle();
  if (!order) return { ok: false, reportId: null, message: "주문을 찾을 수 없어요." };
  if (order.status === "paid") return { ok: true, reportId: order.report_id };
  if (order.amount !== amount) {
    await db().from("orders").update({ status: "failed", fail_code: "AMOUNT_MISMATCH" }).eq("order_id", orderId);
    return { ok: false, reportId: order.report_id, message: "결제 금액이 주문과 달라 승인하지 않았어요.", code: "AMOUNT_MISMATCH" };
  }

  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) return { ok: false, reportId: order.report_id, message: "결제 설정이 아직 끝나지 않았어요.", code: "NO_SECRET" };

  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(secret + ":").toString("base64"),
      "Content-Type": "application/json",
      "Idempotency-Key": orderId,
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
    cache: "no-store",
  });
  const body: any = await res.json().catch(() => ({}));

  if (!res.ok || body?.status !== "DONE") {
    await db().from("orders").update({ status: "failed", fail_code: body?.code ?? String(res.status), raw: body }).eq("order_id", orderId);
    await logEvent({ session_id: "server", src: order.src, name: "pay_fail", report_id: order.report_id, props: { code: body?.code ?? res.status } });
    return { ok: false, reportId: order.report_id, message: body?.message || "결제 승인에 실패했어요.", code: body?.code };
  }

  const approvedAt = body.approvedAt ?? new Date().toISOString();
  await db().from("orders").update({
    status: "paid", payment_key: paymentKey, method: body.method ?? null, approved_at: approvedAt, raw: body,
  }).eq("order_id", orderId);
  await db().from("reports").update({ paid: true, paid_at: approvedAt }).eq("id", order.report_id);
  await logEvent({ session_id: "server", src: order.src, name: "paid", report_id: order.report_id, props: { amount, method: body.method ?? "" } });
  return { ok: true, reportId: order.report_id };
}
