import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cleanSession, db, isUuid, logEvent, PRODUCTS } from "@/lib/server";

export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "요청 형식이 잘못됐어요." }, { status: 400 }); }
  const reportId = typeof b?.report_id === "string" && isUuid(b.report_id) ? b.report_id : null;
  if (!reportId) return NextResponse.json({ error: "리포트를 찾을 수 없어요." }, { status: 404 });

  const { data: rep } = await db().from("reports").select("id, src, paid").eq("id", reportId).maybeSingle();
  if (!rep) return NextResponse.json({ error: "리포트를 찾을 수 없어요." }, { status: 404 });
  if (rep.paid) return NextResponse.json({ error: "이미 열린 리포트예요.", paid: true }, { status: 409 });

  const product = PRODUCTS.report_single;
  const orderId = `nk_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
  const { error } = await db().from("orders").insert({
    order_id: orderId, report_id: rep.id, src: rep.src, product: "report_single", amount: product.amount,
  });
  if (error) {
    console.error("[orders]", error.message);
    return NextResponse.json({ error: "주문을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  }
  await logEvent({ session_id: cleanSession(b?.session_id), src: rep.src, name: "checkout", report_id: rep.id, props: { orderId } });
  return NextResponse.json({ orderId, amount: product.amount, orderName: product.name });
}
