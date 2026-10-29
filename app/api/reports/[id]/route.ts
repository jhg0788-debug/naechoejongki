import { NextResponse } from "next/server";
import { cleanSession, db, isUuid } from "@/lib/server";

/**
 * 리포트 삭제 (개인정보 삭제 요청)
 * 리포트를 만든 기기(session_id 일치)에서만 지울 수 있다. 결제 기록(orders)은 법정 보관을 위해 남는다.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "리포트를 찾을 수 없어요." }, { status: 404 });
  const session_id = cleanSession(new URL(req.url).searchParams.get("s"));
  if (session_id === "anon") return NextResponse.json({ error: "이 기기에서 만든 리포트만 지울 수 있어요." }, { status: 403 });

  const { data, error } = await db().from("reports").delete().eq("id", id).eq("session_id", session_id).select("id");
  if (error) return NextResponse.json({ error: "삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "이 기기에서 만든 리포트만 지울 수 있어요. 다른 기기라면 고객센터로 요청해 주세요." }, { status: 403 });
  // 통계용 이벤트는 남기되 리포트와의 연결만 끊는다 (개인 입력값은 이벤트에 없음)
  await db().from("events").update({ report_id: null }).eq("report_id", id);
  return NextResponse.json({ ok: true });
}
