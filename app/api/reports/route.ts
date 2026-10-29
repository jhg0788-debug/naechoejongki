import { NextResponse } from "next/server";
import { api } from "@/lib/server";

// 입력 검증·예측·저장은 nk-api(createReport)가 서버에서 한다
export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "요청 형식이 잘못됐어요." }, { status: 400 }); }
  const r = await api("createReport", b && typeof b === "object" ? b : {});
  return NextResponse.json(r.data, { status: r.status });
}
