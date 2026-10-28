import { NextResponse } from "next/server";
import { cleanSession, cleanSrc, isUuid, logEvent } from "@/lib/server";

// 클라이언트가 보낼 수 있는 이벤트만 허용. complete·checkout·paid는 서버가 직접 기록한다.
const CLIENT_EVENTS = new Set(["landing", "start", "step", "share_friend", "parent_send", "parent_open", "pay_view"]);

export async function POST(req: Request) {
  let b: any;
  try { b = JSON.parse(await req.text()); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!CLIENT_EVENTS.has(b?.name)) return NextResponse.json({ ok: false }, { status: 400 });
  const report_id = typeof b.report_id === "string" && isUuid(b.report_id) ? b.report_id : null;
  if ((b.name === "parent_open" || b.name === "pay_view" || b.name === "parent_send") && !report_id)
    return NextResponse.json({ ok: false }, { status: 400 });

  const utm: Record<string, string> = {};
  if (b.utm && typeof b.utm === "object")
    for (const [k, v] of Object.entries(b.utm)) if (k.startsWith("utm_") && typeof v === "string") utm[k.slice(0, 20)] = v.slice(0, 80);
  const props: Record<string, unknown> = {};
  if (b.props && typeof b.props === "object")
    for (const [k, v] of Object.entries(b.props).slice(0, 8))
      if (["string", "number", "boolean"].includes(typeof v)) props[k.slice(0, 24)] = typeof v === "string" ? v.slice(0, 60) : v;

  await logEvent({ session_id: cleanSession(b.session_id), src: cleanSrc(b.src), name: b.name, report_id, props, utm });
  return NextResponse.json({ ok: true });
}
