/**
 * 내최종키 서버 API (Supabase Edge Function)
 *
 * 비밀 키가 필요한 작업을 전부 여기서 한다. Supabase가 SUPABASE_SERVICE_ROLE_KEY를 자동 주입하므로
 * Vercel에는 비밀 키가 하나도 필요 없다. 결제·본인인증 키도 이 함수의 Secrets에만 둔다.
 *   TOSS_CLIENT_KEY, TOSS_SECRET_KEY            (토스 결제위젯)
 *   PORTONE_STORE_ID, PORTONE_IDV_CHANNEL_KEY, PORTONE_API_SECRET  (보호자 본인인증)
 *   ADMIN_KEY (선택, 없으면 app_config.admin_password_sha256)
 *
 * 모든 요청: POST { op, ...payload }. 각 op는 혼자 호출돼도 안전하도록 검증한다.
 */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { ageInYears, InputError, predict, toFree, validate, type FullResult, type Inputs } from "./predict.ts";
import lms from "./growth-chart-lms.json" with { type: "json" };

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const env = (k: string) => Deno.env.get(k) ?? "";

const PRODUCT = { id: "report_single", name: "내최종키 상세 리포트", amount: 4900 };
const CLIENT_EVENTS = new Set(["landing", "start", "step", "share_friend", "parent_send", "parent_open", "pay_view", "guardian_handoff"]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status);

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const cleanSrc = (v: unknown) => { const s = typeof v === "string" ? v.trim().toLowerCase() : ""; return /^[a-z0-9_-]{1,32}$/.test(s) ? s : "direct"; };
const cleanSession = (v: unknown) => { const s = typeof v === "string" ? v : ""; return /^[a-zA-Z0-9-]{8,64}$/.test(s) ? s : "anon"; };
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN);
const numOrNull = (v: unknown) => (v == null || v === "" ? null : num(v));

async function sha256hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function logEvent(e: { session_id: string; src: string; name: string; report_id?: string | null; props?: Record<string, unknown>; utm?: Record<string, string> }) {
  const { error } = await sb.from("events").insert({ ...e, report_id: e.report_id ?? null, props: e.props ?? {}, utm: e.utm ?? {} });
  if (error) console.error("[event]", e.name, error.message);
}
const guardianEnforced = () => !!(env("PORTONE_API_SECRET") && env("PORTONE_STORE_ID") && env("PORTONE_IDV_CHANNEL_KEY"));

/* ───────────── ops ───────────── */
const ops: Record<string, (b: any) => Promise<Response>> = {
  async selfcheck() {
    const sum = (r: any[], k: string) => Math.round(r.reduce((a, x) => a + x[k], 0) * 10000) / 10000;
    const t = lms as any;
    return json({ m: [t.m.length, sum(t.m, "L"), sum(t.m, "M"), sum(t.m, "S")], f: [t.f.length, sum(t.f, "L"), sum(t.f, "M"), sum(t.f, "S")] });
  },

  async config() {
    return json({
      tossClientKey: env("TOSS_CLIENT_KEY") || null,
      portoneStoreId: guardianEnforced() ? env("PORTONE_STORE_ID") : null,
      portoneChannelKey: guardianEnforced() ? env("PORTONE_IDV_CHANNEL_KEY") : null,
      price: PRODUCT.amount,
    });
  },

  async track(b) {
    if (!CLIENT_EVENTS.has(b?.name)) return fail("bad event");
    const report_id = isUuid(b.report_id) ? b.report_id : null;
    if (["parent_open", "pay_view", "parent_send"].includes(b.name) && !report_id) return fail("report required");
    const utm: Record<string, string> = {};
    if (b.utm && typeof b.utm === "object")
      for (const [k, v] of Object.entries(b.utm)) if (k.startsWith("utm_") && typeof v === "string") utm[k.slice(0, 20)] = v.slice(0, 80);
    const props: Record<string, unknown> = {};
    if (b.props && typeof b.props === "object")
      for (const [k, v] of Object.entries(b.props).slice(0, 8))
        if (["string", "number", "boolean"].includes(typeof v)) props[k.slice(0, 24)] = typeof v === "string" ? (v as string).slice(0, 60) : v;
    await logEvent({ session_id: cleanSession(b.session_id), src: cleanSrc(b.src), name: b.name, report_id, props, utm });
    return json({ ok: true });
  },

  async createReport(b) {
    const x: Inputs = {
      sex: b?.sex, birthYear: num(b?.birthYear), birthMonth: num(b?.birthMonth),
      height: num(b?.height), weight: numOrNull(b?.weight), dad: num(b?.dad), mom: num(b?.mom),
      lastYear: numOrNull(b?.lastYear), puberty: num(b?.puberty) as Inputs["puberty"],
      sleep: num(b?.sleep) as Inputs["sleep"], exercise: num(b?.exercise) as Inputs["exercise"], milk: num(b?.milk) as Inputs["milk"],
      under14Consent: b?.under14Consent === true,
    };
    const session_id = cleanSession(b?.session_id), src = cleanSrc(b?.src);
    const under14 = Number.isFinite(x.birthYear) && ageInYears(x.birthYear, x.birthMonth) < 14;
    let guardianId: string | null = null;
    if (under14 && guardianEnforced()) {
      const gid = typeof b?.guardianVerificationId === "string" ? b.guardianVerificationId : "";
      const { data: g } = gid ? await sb.from("guardian_verifications").select("id, session_id, adult, used_report_id").eq("id", gid).maybeSingle() : { data: null };
      if (!g || !g.adult || g.session_id !== session_id || g.used_report_id) return fail("보호자 본인인증을 먼저 완료해 주세요.", 422, { needGuardian: true });
      guardianId = g.id; x.under14Consent = true;
    }
    try { validate(x); } catch (e) { if (e instanceof InputError) return fail(e.message, 422); throw e; }
    const result = predict(x);
    const { under14Consent, sex, birthYear, birthMonth, ...rest } = x;
    const { data, error } = await sb.from("reports").insert({
      session_id, src, sex, birth_ym: `${birthYear}-${String(birthMonth).padStart(2, "0")}`,
      under14_consent: !!under14Consent, guardian_verification_id: guardianId, inputs: rest, result,
    }).select("id").single();
    if (error || !data) { console.error("[reports]", error?.message); return fail("저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.", 500); }
    if (guardianId) await sb.from("guardian_verifications").update({ used_report_id: data.id }).eq("id", guardianId);
    await logEvent({ session_id, src, name: "complete", report_id: data.id, props: { puberty: x.puberty, sex } });
    return json({ id: data.id, free: toFree(result) });
  },

  async getReport(b) {
    if (!isUuid(b?.id)) return fail("not found", 404);
    const { data } = await sb.from("reports").select("id, sex, inputs, result, paid, expires_at").eq("id", b.id).maybeSingle();
    if (!data || new Date(data.expires_at) < new Date()) return fail("not found", 404);
    const full = data.result as FullResult, inp = data.inputs as Record<string, any>;
    // 결제 전에는 잠금 필드를 내보내지 않는다
    return json({
      id: data.id, sex: data.sex, height: inp.height, paid: data.paid, price: PRODUCT.amount,
      free: toFree(full), full: data.paid ? full : null,
      habits: data.paid ? { sleep: inp.sleep, exercise: inp.exercise, milk: inp.milk, weight: inp.weight ?? null } : null,
    });
  },

  async deleteReport(b) {
    const session_id = cleanSession(b?.session_id);
    if (!isUuid(b?.id) || session_id === "anon") return fail("이 기기에서 만든 리포트만 지울 수 있어요.", 403);
    const { data, error } = await sb.from("reports").delete().eq("id", b.id).eq("session_id", session_id).select("id");
    if (error) return fail("삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.", 500);
    if (!data?.length) return fail("이 기기에서 만든 리포트만 지울 수 있어요. 다른 기기라면 고객센터로 요청해 주세요.", 403);
    await sb.from("events").update({ report_id: null }).eq("report_id", b.id);
    return json({ ok: true });
  },

  async createOrder(b) {
    if (!isUuid(b?.report_id)) return fail("리포트를 찾을 수 없어요.", 404);
    const { data: rep } = await sb.from("reports").select("id, src, paid").eq("id", b.report_id).maybeSingle();
    if (!rep) return fail("리포트를 찾을 수 없어요.", 404);
    if (rep.paid) return fail("이미 열린 리포트예요.", 409, { paid: true });
    const rnd = [...crypto.getRandomValues(new Uint8Array(6))].map(x => x.toString(16).padStart(2, "0")).join("");
    const orderId = `nk_${Date.now().toString(36)}_${rnd}`;
    const { error } = await sb.from("orders").insert({ order_id: orderId, report_id: rep.id, src: rep.src, product: PRODUCT.id, amount: PRODUCT.amount });
    if (error) { console.error("[orders]", error.message); return fail("주문을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.", 500); }
    await logEvent({ session_id: cleanSession(b?.session_id), src: rep.src, name: "checkout", report_id: rep.id, props: { orderId } });
    return json({ orderId, amount: PRODUCT.amount, orderName: PRODUCT.name });
  },

  async confirmPayment(b) {
    const paymentKey = typeof b?.paymentKey === "string" ? b.paymentKey : "";
    const orderId = typeof b?.orderId === "string" ? b.orderId : "";
    const amount = Number(b?.amount);
    if (!paymentKey || !orderId || !Number.isFinite(amount)) return json({ ok: false, reportId: null, message: "결제 정보가 올바르지 않아요." });
    const { data: order } = await sb.from("orders").select("*").eq("order_id", orderId).maybeSingle();
    if (!order) return json({ ok: false, reportId: null, message: "주문을 찾을 수 없어요." });
    if (order.status === "paid") return json({ ok: true, reportId: order.report_id });
    if (order.amount !== amount) {
      await sb.from("orders").update({ status: "failed", fail_code: "AMOUNT_MISMATCH" }).eq("order_id", orderId);
      return json({ ok: false, reportId: order.report_id, message: "결제 금액이 주문과 달라 승인하지 않았어요.", code: "AMOUNT_MISMATCH" });
    }
    const secret = env("TOSS_SECRET_KEY");
    if (!secret) return json({ ok: false, reportId: order.report_id, message: "결제 설정이 아직 끝나지 않았어요.", code: "NO_SECRET" });
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(secret + ":"), "Content-Type": "application/json", "Idempotency-Key": orderId },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const t: any = await res.json().catch(() => ({}));
    if (!res.ok || t?.status !== "DONE") {
      await sb.from("orders").update({ status: "failed", fail_code: t?.code ?? String(res.status), raw: t }).eq("order_id", orderId);
      await logEvent({ session_id: "server", src: order.src, name: "pay_fail", report_id: order.report_id, props: { code: t?.code ?? res.status } });
      return json({ ok: false, reportId: order.report_id, message: t?.message || "결제 승인에 실패했어요.", code: t?.code });
    }
    const approvedAt = t.approvedAt ?? new Date().toISOString();
    await sb.from("orders").update({ status: "paid", payment_key: paymentKey, method: t.method ?? null, approved_at: approvedAt, raw: t }).eq("order_id", orderId);
    if (order.report_id) await sb.from("reports").update({ paid: true, paid_at: approvedAt }).eq("id", order.report_id);
    await logEvent({ session_id: "server", src: order.src, name: "paid", report_id: order.report_id, props: { amount, method: t.method ?? "" } });
    return json({ ok: true, reportId: order.report_id });
  },

  async failOrder(b) {
    const orderId = typeof b?.orderId === "string" ? b.orderId.slice(0, 64) : "";
    const code = typeof b?.code === "string" ? b.code.slice(0, 60) : "";
    if (!orderId) return json({ ok: true });
    const { data } = await sb.from("orders").select("src, report_id, status").eq("order_id", orderId).maybeSingle();
    if (data && data.status === "ready") {
      const canceled = code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL";
      await sb.from("orders").update({ status: canceled ? "canceled" : "failed", fail_code: code || null }).eq("order_id", orderId);
      await logEvent({ session_id: "server", src: data.src, name: "pay_fail", report_id: data.report_id, props: { code } });
    }
    return json({ ok: true });
  },

  async guardian(b) {
    const id = typeof b?.identityVerificationId === "string" ? b.identityVerificationId : "";
    if (!/^nkiv_[a-zA-Z0-9-]{8,60}$/.test(id)) return fail("인증 정보가 올바르지 않아요.");
    const secret = env("PORTONE_API_SECRET");
    if (!secret) return fail("본인인증 설정이 아직 없어요.", 503);
    const res = await fetch(`https://api.portone.io/identity-verifications/${encodeURIComponent(id)}`, { headers: { Authorization: `PortOne ${secret}` } });
    const v: any = await res.json().catch(() => ({}));
    if (!res.ok || v?.status !== "VERIFIED") return fail("본인인증이 완료되지 않았어요. 다시 시도해 주세요.", 422);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v?.verifiedCustomer?.birthDate ?? ""));
    let adult = false;
    if (m) {
      const n = new Date(); let age = n.getFullYear() - +m[1];
      if (n.getMonth() + 1 < +m[2] || (n.getMonth() + 1 === +m[2] && n.getDate() < +m[3])) age--;
      adult = age >= 19;
    }
    const { error } = await sb.from("guardian_verifications").upsert({ id, session_id: cleanSession(b?.session_id), adult });
    if (error) return fail("인증 결과를 저장하지 못했어요.", 500);
    if (!adult) return fail("보호자(만 19세 이상) 명의로 인증해 주세요.", 422);
    return json({ ok: true });
  },

  /* 관리자: 비밀번호 → 세션 토큰. 토큰 = sha256("nk-session:" + 비밀번호해시) */
  async adminLogin(b) {
    const h = await adminHash();
    const pw = typeof b?.password === "string" ? b.password : "";
    if (!h || !pw || !safeEq(await sha256hex("nk-admin:" + pw), h)) return fail("비밀번호가 맞지 않아요.", 401);
    return json({ token: await sha256hex("nk-session:" + h) });
  },
  async adminDashboard(b) {
    if (!(await adminOk(b?.token))) return fail("unauthorized", 401);
    const [{ data: funnel }, { data: videos }] = await Promise.all([
      sb.from("funnel_by_src").select("*"),
      sb.from("videos").select("code, title, url, views, updated_at").order("created_at", { ascending: true }),
    ]);
    return json({ funnel: funnel ?? [], videos: videos ?? [] });
  },
  async adminSaveVideo(b) {
    if (!(await adminOk(b?.token))) return fail("unauthorized", 401);
    const code = cleanSrc(b?.code);
    if (code === "direct") return fail("코드를 확인해 주세요.");
    const views = Math.max(0, Math.floor(Number(b?.views || 0)));
    const { error } = await sb.from("videos").upsert({
      code, title: String(b?.title ?? "").slice(0, 120), url: String(b?.url ?? "").slice(0, 300), views, updated_at: new Date().toISOString(),
    });
    if (error) return fail("저장하지 못했어요.", 500);
    return json({ ok: true });
  },
};

async function adminHash(): Promise<string | null> {
  const k = env("ADMIN_KEY");
  if (k) return sha256hex("nk-admin:" + k);
  const { data } = await sb.from("app_config").select("value").eq("key", "admin_password_sha256").maybeSingle();
  return data?.value && /^[0-9a-f]{64}$/.test(data.value) ? data.value : null;
}
async function adminOk(token: unknown) {
  const h = await adminHash();
  return !!h && typeof token === "string" && /^[0-9a-f]{64}$/.test(token) && safeEq(token, await sha256hex("nk-session:" + h));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);
  let b: any;
  try { b = await req.json(); } catch { return fail("요청 형식이 잘못됐어요."); }
  const fn = typeof b?.op === "string" ? ops[b.op] : undefined;
  if (!fn) return fail("unknown op", 404);
  try { return await fn(b); }
  catch (e) { console.error("[nk-api]", b.op, e); return fail("서버 오류가 났어요. 잠시 뒤 다시 시도해 주세요.", 500); }
});
