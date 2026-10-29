import { NextResponse } from "next/server";
import { api } from "@/lib/server";

// 보호자 본인인증 확인: nk-api가 포트원 API로 직접 재검증한다
export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "요청 형식이 잘못됐어요." }, { status: 400 }); }
  const r = await api("guardian", { identityVerificationId: b?.identityVerificationId, session_id: b?.session_id });
  return NextResponse.json(r.data, { status: r.status });
}
