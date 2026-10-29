import "server-only";

/**
 * 모든 DB·결제 작업은 Supabase Edge Function `nk-api`가 한다.
 * 이 앱(Vercel)은 공개 키만 쓰므로 Vercel에 비밀 환경변수가 필요 없다.
 * (Supabase 공개 키는 브라우저에 노출돼도 되는 키다. 테이블은 RLS로 전부 막혀 있다.)
 */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kltukfalawlrjrfzoyam.supabase.co";
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_pEWonwCXK092FG8eVEc_MA_TubdM8Vc";
const API = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/nk-api`;

export type ApiResult<T = any> = { ok: boolean; status: number; data: T };

export async function api<T = any>(op: string, body: Record<string, unknown> = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: PUBLISHABLE_KEY },
      body: JSON.stringify({ op, ...body }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    console.error("[api]", op, e);
    return { ok: false, status: 502, data: { error: "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요." } as T };
  }
}

/** 가격 표시용 (실제 결제 금액은 nk-api가 정한다) */
export const PRODUCTS = {
  report_single: { name: "내최종키 상세 리포트", amount: 4900 },
} as const;

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` || "http://localhost:3000").replace(/\/$/, "");
}
