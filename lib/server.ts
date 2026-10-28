import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** 서버 전용 Supabase 클라이언트 (service role). 브라우저로 절대 내보내지 않는다. */
export function db(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** 상품 가격은 서버에서만 정한다. 클라이언트가 보낸 금액은 믿지 않는다. */
export const PRODUCTS = {
  report_single: { name: "내최종키 상세 리포트", amount: 4900 },
} as const;
export type ProductId = keyof typeof PRODUCTS;

/** ?v= 값 정리: 영문·숫자·-·_ 32자 */
export function cleanSrc(v: unknown): string {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return /^[a-z0-9_-]{1,32}$/.test(s) ? s : "direct";
}
export function cleanSession(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  return /^[a-zA-Z0-9-]{8,64}$/.test(s) ? s : "anon";
}
export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function logEvent(e: {
  session_id: string; src: string; name: string; report_id?: string | null; props?: Record<string, unknown>; utm?: Record<string, string>;
}) {
  const { error } = await db().from("events").insert({
    session_id: e.session_id, src: e.src, name: e.name, report_id: e.report_id ?? null, props: e.props ?? {}, utm: e.utm ?? {},
  });
  if (error) console.error("[event]", e.name, error.message);
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
