import { NextResponse } from "next/server";
import { api } from "@/lib/server";

export async function POST(req: Request) {
  let b: any;
  try { b = JSON.parse(await req.text()); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const r = await api("track", b && typeof b === "object" ? b : {});
  return NextResponse.json(r.data, { status: r.status });
}
