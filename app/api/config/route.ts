import { NextResponse } from "next/server";
import { api } from "@/lib/server";

export const dynamic = "force-dynamic";

// 브라우저에 필요한 공개 설정 (토스 클라이언트 키, 포트원 상점·채널). 전부 공개돼도 되는 값이다.
export async function GET() {
  const r = await api("config");
  return NextResponse.json(r.ok ? r.data : { tossClientKey: null, portoneStoreId: null, portoneChannelKey: null });
}
