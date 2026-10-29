import { NextResponse } from "next/server";
import { cleanSession, db } from "@/lib/server";

/**
 * 만 14세 미만 보호자 본인인증 확인 (포트원 V2)
 * 브라우저가 본인인증을 마치면 identityVerificationId를 보내고,
 * 서버가 포트원 API로 상태를 직접 조회해 성인 보호자인지 확인한다.
 * 이름·전화번호·CI 등은 저장하지 않고 '성인 인증 완료' 여부만 남긴다.
 */
export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "요청 형식이 잘못됐어요." }, { status: 400 }); }
  const id = typeof b?.identityVerificationId === "string" ? b.identityVerificationId : "";
  if (!/^nkiv_[a-zA-Z0-9-]{8,60}$/.test(id)) return NextResponse.json({ error: "인증 정보가 올바르지 않아요." }, { status: 400 });
  const session_id = cleanSession(b?.session_id);

  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) return NextResponse.json({ error: "본인인증 설정이 아직 없어요." }, { status: 503 });

  const res = await fetch(`https://api.portone.io/identity-verifications/${encodeURIComponent(id)}`, {
    headers: { Authorization: `PortOne ${secret}` },
    cache: "no-store",
  });
  const v: any = await res.json().catch(() => ({}));
  if (!res.ok || v?.status !== "VERIFIED") {
    return NextResponse.json({ error: "본인인증이 완료되지 않았어요. 다시 시도해 주세요." }, { status: 422 });
  }

  const birth = String(v?.verifiedCustomer?.birthDate ?? ""); // YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  let adult = false;
  if (m) {
    const now = new Date();
    let age = now.getFullYear() - +m[1];
    if (now.getMonth() + 1 < +m[2] || (now.getMonth() + 1 === +m[2] && now.getDate() < +m[3])) age--;
    adult = age >= 19;
  }

  const { error } = await db().from("guardian_verifications").upsert({ id, session_id, adult });
  if (error) {
    console.error("[guardian]", error.message);
    return NextResponse.json({ error: "인증 결과를 저장하지 못했어요." }, { status: 500 });
  }
  if (!adult) return NextResponse.json({ error: "보호자(만 19세 이상) 명의로 인증해 주세요." }, { status: 422 });
  return NextResponse.json({ ok: true });
}
