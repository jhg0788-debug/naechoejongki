import { NextResponse } from "next/server";
import { cleanSession, cleanSrc, db, guardianVerificationEnabled, logEvent } from "@/lib/server";
import { ageInYears, InputError, predict, toFree, validate, type Inputs } from "@/lib/predict";

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN);
const numOrNull = (v: unknown) => (v == null || v === "" ? null : num(v));

export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "요청 형식이 잘못됐어요." }, { status: 400 }); }

  const x: Inputs = {
    sex: b?.sex, birthYear: num(b?.birthYear), birthMonth: num(b?.birthMonth),
    height: num(b?.height), weight: numOrNull(b?.weight), dad: num(b?.dad), mom: num(b?.mom),
    lastYear: numOrNull(b?.lastYear), puberty: num(b?.puberty) as Inputs["puberty"],
    sleep: num(b?.sleep) as Inputs["sleep"], exercise: num(b?.exercise) as Inputs["exercise"], milk: num(b?.milk) as Inputs["milk"],
    under14Consent: b?.under14Consent === true,
  };
  const session_id = cleanSession(b?.session_id);
  const src = cleanSrc(b?.src);

  // 만 14세 미만: 본인인증이 설정돼 있으면 보호자 인증 기록을 서버에서 확인한다
  const under14 = Number.isFinite(x.birthYear) && ageInYears(x.birthYear, x.birthMonth) < 14;
  let guardianId: string | null = null;
  if (under14 && guardianVerificationEnabled()) {
    const gid = typeof b?.guardianVerificationId === "string" ? b.guardianVerificationId : "";
    const { data: g } = gid
      ? await db().from("guardian_verifications").select("id, session_id, adult, used_report_id").eq("id", gid).maybeSingle()
      : { data: null };
    if (!g || !g.adult || g.session_id !== session_id || g.used_report_id) {
      return NextResponse.json({ error: "보호자 본인인증을 먼저 완료해 주세요.", needGuardian: true }, { status: 422 });
    }
    guardianId = g.id;
    x.under14Consent = true;
  }

  try { validate(x); } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }

  const result = predict(x);
  const { under14Consent, sex, birthYear, birthMonth, ...rest } = x;

  const { data, error } = await db().from("reports").insert({
    session_id, src, sex,
    birth_ym: `${birthYear}-${String(birthMonth).padStart(2, "0")}`,
    under14_consent: !!under14Consent,
    guardian_verification_id: guardianId,
    inputs: rest, result,
  }).select("id").single();
  if (error || !data) {
    console.error("[reports]", error?.message);
    return NextResponse.json({ error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  }
  if (guardianId) await db().from("guardian_verifications").update({ used_report_id: data.id }).eq("id", guardianId);
  await logEvent({ session_id, src, name: "complete", report_id: data.id, props: { puberty: x.puberty, sex } });
  return NextResponse.json({ id: data.id, free: toFree(result) });
}
