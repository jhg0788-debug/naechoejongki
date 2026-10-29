import { NextResponse } from "next/server";
import { api } from "@/lib/server";

// 주문 생성: 금액은 nk-api가 고정값으로 정한다
export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "요청 형식이 잘못됐어요." }, { status: 400 }); }
  const r = await api("createOrder", { report_id: b?.report_id, session_id: b?.session_id });
  return NextResponse.json(r.data, { status: r.status });
}
