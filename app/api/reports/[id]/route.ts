import { NextResponse } from "next/server";
import { api } from "@/lib/server";

// 리포트 삭제: 만든 기기(session_id 일치)에서만. 결제 기록은 남는다.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session_id = new URL(req.url).searchParams.get("s");
  const r = await api("deleteReport", { id, session_id });
  return NextResponse.json(r.data, { status: r.status });
}
