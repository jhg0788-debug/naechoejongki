"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shell } from "./Shell";
import { captureSource, currentSrc, sessionId, track } from "@/lib/track";
import { ageInYears } from "@/lib/predict";

type Sex = "m" | "f";
interface S {
  sex: Sex | null; by: number | null; bm: number | null; consent: boolean;
  h: number | null; w: number | null; dad: number | null; mom: number | null; last: number | null;
  pub: number | null; sleep: number | null; ex: number | null; milk: number | null;
  guardianId: string | null;
}
const EMPTY: S = { sex: null, by: null, bm: null, consent: false, h: null, w: null, dad: null, mom: null, last: null, pub: null, sleep: null, ex: null, milk: null, guardianId: null };

const K_RESUME = "nk_ob_resume";
type PublicConfig = { portoneStoreId: string | null; portoneChannelKey: string | null };

type NumKey = "h" | "w" | "dad" | "mom" | "last";
interface NumStep { id: NumKey; q: string; why: string; unit: string; min: number; max: number; step: number; def: (s: S) => number; skip?: boolean }
const NUM: Record<NumKey, NumStep> = {
  h: { id: "h", q: "지금 키는 몇 cm예요?", why: "최근 3개월 안에 잰 키가 가장 정확해요. 아침에 잰 키를 추천해요.", unit: "cm", min: 90, max: 200, step: 0.5, def: s => (s.sex === "f" ? 155 : 160) },
  w: { id: "w", q: "몸무게는요?", why: "월별 기록에 쓰여요. 예상키 범위 계산에는 넣지 않아요.", unit: "kg", min: 15, max: 150, step: 0.5, def: s => (s.sex === "f" ? 47 : 52) },
  dad: { id: "dad", q: "아빠 키는 몇 cm예요?", why: "부모 키 평균(중간부모키)은 최종 키를 가늠하는 가장 기본 자료예요.", unit: "cm", min: 145, max: 205, step: 1, def: () => 174 },
  mom: { id: "mom", q: "엄마 키는 몇 cm예요?", why: "아빠 키와 함께 중간부모키 공식에 들어가요.", unit: "cm", min: 135, max: 190, step: 1, def: () => 161 },
  last: { id: "last", q: "작년 이맘때 키는요?", why: "1년 동안 자란 양으로 성장 속도를 봐요. 모르면 건너뛰어도 돼요. 대신 범위가 조금 넓어져요.", unit: "cm", min: 85, max: 200, step: 0.5, def: s => (s.h ? Math.round(s.h - 5) : 150), skip: true },
};

const ORDER = ["intro", "sex", "birth", "consent", "h", "w", "dad", "mom", "last", "pub", "sleep", "habit", "calc"] as const;
type StepId = (typeof ORDER)[number];

export default function Onboarding() {
  const router = useRouter();
  const [s, setS] = useState<S>(EMPTY);
  const [cur, setCur] = useState<StepId>("intro");
  const [err, setErr] = useState("");
  const tracked = useRef(false);
  const now = useMemo(() => new Date(), []);
  const age = s.by && s.bm ? ageInYears(s.by, s.bm, now) : null;

  const [ivBusy, setIvBusy] = useState(false);
  const [ivErr, setIvErr] = useState("");
  // 포트원 설정은 서버(nk-api)에 있을 때만 켜진다
  const [cfg, setCfg] = useState<PublicConfig>({ portoneStoreId: null, portoneChannelKey: null });
  useEffect(() => { fetch("/api/config").then(r => r.json()).then(setCfg).catch(() => {}); }, []);
  const PORTONE_STORE = cfg.portoneStoreId || "", PORTONE_CHANNEL = cfg.portoneChannelKey || "";
  const GUARDIAN_IDV = !!(PORTONE_STORE && PORTONE_CHANNEL);

  const verifyGuardian = async (identityVerificationId: string, base: S) => {
    setIvBusy(true); setIvErr("");
    try {
      const res = await fetch("/api/guardian", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ identityVerificationId, session_id: sessionId() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "본인인증을 확인하지 못했어요.");
      setS({ ...base, consent: true, guardianId: identityVerificationId });
      setCur("h");
      track("step", { props: { q: "h", guardian: "verified" } });
    } catch (e: any) {
      setS(base); setCur("consent");
      setIvErr(e?.message || "본인인증을 확인하지 못했어요.");
    } finally { setIvBusy(false); }
  };

  const startGuardianIdv = async () => {
    setIvErr("");
    const identityVerificationId = `nkiv_${crypto.randomUUID()}`;
    try { sessionStorage.setItem(K_RESUME, JSON.stringify({ s, identityVerificationId })); } catch { /* noop */ }
    try {
      const PortOne = await import("@portone/browser-sdk/v2");
      const r = await PortOne.requestIdentityVerification({
        storeId: PORTONE_STORE, channelKey: PORTONE_CHANNEL, identityVerificationId,
        redirectUrl: `${location.origin}/?guardian=1`,
      });
      // 데스크톱(팝업)은 여기로 결과가 온다. 모바일은 redirectUrl로 돌아온다.
      if (!r) return;
      if (r.code) { setIvErr(r.message || "본인인증이 취소됐어요."); return; }
      await verifyGuardian(identityVerificationId, s);
    } catch (e: any) {
      setIvErr(e?.message || "본인인증 창을 열지 못했어요.");
    }
  };

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    captureSource();
    // 모바일 본인인증 후 돌아온 경우: 입력하던 내용을 복원하고 인증 결과를 확인
    const q = new URLSearchParams(location.search);
    if (q.get("guardian") === "1") {
      let saved: { s: S; identityVerificationId: string } | null = null;
      try { saved = JSON.parse(sessionStorage.getItem(K_RESUME) || "null"); sessionStorage.removeItem(K_RESUME); } catch { /* noop */ }
      try { history.replaceState(null, "", location.pathname); } catch { /* noop */ }
      if (saved?.s) {
        const id = q.get("identityVerificationId") || saved.identityVerificationId;
        if (q.get("code")) { setS(saved.s); setCur("consent"); setIvErr(q.get("message") || "본인인증이 취소됐어요."); }
        else verifyGuardian(id, saved.s);
        return;
      }
    }
    track("landing", { props: { path: location.pathname } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = ORDER.filter(id => id !== "consent" || (age != null && age < 14));
  const questions = visible.filter(id => id !== "intro" && id !== "calc");
  const qIdx = questions.indexOf(cur as any);

  const go = (d: 1 | -1) => {
    const i = visible.indexOf(cur);
    const next = visible[Math.max(0, Math.min(visible.length - 1, i + d))];
    setErr("");
    setCur(next);
    if (d === 1 && next !== "calc") track("step", { props: { q: next } });
    window.scrollTo(0, 0);
  };
  const set = (patch: Partial<S>) => setS(p => ({ ...p, ...patch }));
  const pick = (patch: Partial<S>) => { set(patch); setTimeout(() => go(1), 180); };

  // 결과 계산 & 저장
  useEffect(() => {
    if (cur !== "calc") return;
    let cancelled = false;
    const started = Date.now();
    (async () => {
      try {
        const res = await fetch("/api/reports", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId(), src: currentSrc(),
            sex: s.sex, birthYear: s.by, birthMonth: s.bm, under14Consent: s.consent, guardianVerificationId: s.guardianId,
            height: s.h, weight: s.w, dad: s.dad, mom: s.mom, lastYear: s.last,
            puberty: s.pub, sleep: s.sleep, exercise: s.ex, milk: s.milk,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || "계산하지 못했어요.");
        const wait = Math.max(0, 1800 - (Date.now() - started));
        setTimeout(() => { if (!cancelled) router.push(`/r/${body.id}`); }, wait);
      } catch (e: any) {
        if (!cancelled) { setErr(e?.message || "계산하지 못했어요. 다시 시도해 주세요."); }
      }
    })();
    return () => { cancelled = true; };
  }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = qIdx >= 0 ? { idx: qIdx + 1, total: questions.length } : null;
  const back = qIdx >= 0 ? () => go(-1) : null;

  return (
    <Shell progress={progress} onBack={back}>
      {cur === "intro" && (
        <section className="screen">
          <div className="hero-ruler">
            <div className="ruler" aria-hidden="true" />
            <div className="hero-copy">
              <div className="eyebrow">만 5~17세 · 질문 10개 · 1분</div>
              <h1>내 최종 예상키,<br />범위로 확인해 봐</h1>
              <p className="note">부모님 키, 지금 키, 사춘기 단계로 만 18세 무렵 예상키 범위를 계산해요.</p>
              <div className="facts">
                <div><b>공식</b><span>중간부모키 (아빠 키 + 엄마 키 ± 13) ÷ 2</span></div>
                <div><b>도표</b><span>질병관리청 2017 소아청소년 성장도표 백분위</span></div>
                <div><b>보정</b><span>사춘기 단계에 따라 두 값의 비중 조정</span></div>
              </div>
            </div>
          </div>
          <div className="actions"><button className="btn" onClick={() => { track("start"); go(1); }}>예상키 확인하기</button></div>
        </section>
      )}

      {cur === "sex" && (
        <Chips title="성별이 뭐예요?" why="남녀는 성장 시기와 성장도표가 달라요." two
          value={s.sex} options={[{ v: "m", t: "남자", big: true }, { v: "f", t: "여자", big: true }]}
          onPick={v => pick({ sex: v as Sex, pub: null })} />
      )}

      {cur === "birth" && <Birth s={s} now={now} onDone={(by, bm) => { set({ by, bm }); go(1); }} />}

      {cur === "consent" && (
        <section className="screen">
          <h2>보호자와 함께 입력해 주세요</h2>
          <p className="note">만 {Math.floor(age ?? 0)}세는 만 14세 미만이라 개인정보 수집에 보호자 동의가 필요해요.</p>
          {GUARDIAN_IDV ? (
            <>
              <div className="why"><b>어떻게 하나요</b><span>보호자(만 19세 이상) 휴대폰으로 본인인증을 한 번 해요. 이름·전화번호는 저장하지 않고 인증 여부만 확인해요.</span></div>
              <p className="note">아래 버튼을 누르면 <Link href="/privacy" target="_blank">개인정보처리방침</Link>에 보호자가 동의하는 것으로 봐요.</p>
              {ivErr ? <p className="err" role="alert">{ivErr}</p> : null}
              <div className="actions">
                {s.guardianId
                  ? <button className="btn" onClick={() => go(1)}>인증 완료 · 다음</button>
                  : <button className="btn" disabled={ivBusy} onClick={startGuardianIdv}>{ivBusy ? "확인하는 중…" : "보호자 휴대폰 본인인증"}</button>}
              </div>
            </>
          ) : (
            <>
              <label className="check">
                <input type="checkbox" id="consent" checked={s.consent} onChange={e => set({ consent: e.target.checked })} />
                <span>보호자가 <Link href="/privacy" target="_blank">개인정보처리방침</Link>을 확인했고, 함께 입력하고 있어요.</span>
              </label>
              <div className="actions"><button className="btn" disabled={!s.consent} onClick={() => go(1)}>다음</button></div>
            </>
          )}
        </section>
      )}

      {(cur === "h" || cur === "w" || cur === "dad" || cur === "mom" || cur === "last") && (
        <NumInput key={cur} step={NUM[cur]} s={s}
          onDone={v => { set({ [cur]: v } as Partial<S>); go(1); }}
          onSkip={() => { set({ last: null }); go(1); }} />
      )}

      {cur === "pub" && (
        s.sex === "m" ? (
          <Chips title="변성기나 수염 같은 변화가 있어요?" why="사춘기가 얼마나 진행됐는지에 따라 남은 성장 기간이 달라져요."
            value={s.pub} onPick={v => pick({ pub: +v })} options={[
              { v: 0, t: "아직 없어요" },
              { v: 1, t: "막 시작됐어요", s: "목소리가 갈라지기 시작" },
              { v: 2, t: "한창 진행 중이에요", s: "변성기·수염·겨드랑이 털" },
              { v: 3, t: "거의 끝났어요", s: "1년 동안 키가 거의 그대로" },
            ]} />
        ) : (
          <Chips title="초경을 했어요?" why="사춘기가 얼마나 진행됐는지에 따라 남은 성장 기간이 달라져요."
            value={s.pub} onPick={v => pick({ pub: +v })} options={[
              { v: 0, t: "아직이고, 가슴 변화도 없어요" },
              { v: 1, t: "가슴 변화는 있지만 초경 전이에요" },
              { v: 2, t: "초경한 지 1년이 안 됐어요" },
              { v: 3, t: "초경한 지 1년이 넘었어요" },
            ]} />
        )
      )}

      {cur === "sleep" && (
        <Chips title="평일엔 보통 몇 시간 자요?" why="생활습관은 예측 범위 안에서 위치를 표시하는 데만 써요."
          value={s.sleep} onPick={v => pick({ sleep: +v })}
          options={["6시간 미만", "6~7시간", "7~8시간", "8~9시간", "9시간 이상"].map((t, i) => ({ v: i, t }))} />
      )}

      {cur === "habit" && (
        <section className="screen">
          <h2>운동이랑 우유·단백질은요?</h2>
          <Why text="이것도 범위 안 위치 표시에만 쓰여요. cm를 더하거나 빼지 않아요." />
          <Group title="땀 날 정도 운동, 일주일에" value={s.ex} opts={["거의 안 해요", "1~2일", "3~4일", "5일 이상"]} onPick={v => set({ ex: v })} />
          <Group title="우유·유제품·고기·달걀, 하루에" value={s.milk} opts={["거의 안 먹어요", "1번", "2번", "3번 이상"]} onPick={v => set({ milk: v })} />
          <div className="actions"><button className="btn" disabled={s.ex == null || s.milk == null} onClick={() => go(1)}>결과 보기</button></div>
        </section>
      )}

      {cur === "calc" && <Calculating error={err} onRetry={() => { setErr(""); setCur("habit"); }} />}
    </Shell>
  );
}

/* ---------- 작은 컴포넌트들 ---------- */
function Why({ text }: { text: string }) {
  return <div className="why"><b>왜 묻나요</b><span>{text}</span></div>;
}

function Chips({ title, why, options, value, onPick, two }: {
  title: string; why: string; two?: boolean; value: string | number | null;
  options: { v: string | number; t: string; s?: string; big?: boolean }[]; onPick: (v: string | number) => void;
}) {
  return (
    <section className="screen">
      <h2>{title}</h2>
      <Why text={why} />
      <div className={`chips${two ? " two" : ""}`}>
        {options.map(o => (
          <button key={o.v} className={`chip${o.big ? " big" : ""}`} aria-pressed={value === o.v} onClick={() => onPick(o.v)}>
            {o.t}{o.s ? <small>{o.s}</small> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function Group({ title, opts, value, onPick }: { title: string; opts: string[]; value: number | null; onPick: (v: number) => void }) {
  return (
    <div>
      <div className="label">{title}</div>
      <div className="chips two">
        {opts.map((t, i) => <button key={t} className="chip" aria-pressed={value === i} onClick={() => onPick(i)}>{t}</button>)}
      </div>
    </div>
  );
}

function Birth({ s, now, onDone }: { s: S; now: Date; onDone: (by: number, bm: number) => void }) {
  const [by, setBy] = useState(s.by ? String(s.by) : "");
  const [bm, setBm] = useState(s.bm ? String(s.bm) : "");
  const [err, setErr] = useState("");
  const Y = now.getFullYear();
  const years = Array.from({ length: 14 }, (_, i) => Y - 5 - i);
  const submit = () => {
    if (!by || !bm) return setErr("태어난 해와 월을 모두 골라 주세요.");
    const a = ageInYears(+by, +bm, now);
    if (a < 5 || a >= 18) return setErr("만 5세 이상, 만 18세 미만만 계산할 수 있어요.");
    onDone(+by, +bm);
  };
  return (
    <section className="screen">
      <h2>생년월이 언제예요?</h2>
      <Why text="같은 나이 또래와 비교하려면 개월 수까지 필요해요." />
      <div className="selects">
        <div><label className="label" htmlFor="by">태어난 해</label>
          <select id="by" value={by} onChange={e => setBy(e.target.value)}><option value="">선택</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
        <div><label className="label" htmlFor="bm">월</label>
          <select id="bm" value={bm} onChange={e => setBm(e.target.value)}><option value="">선택</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}월</option>)}</select></div>
      </div>
      <div className="err">{err}</div>
      <div className="actions"><button className="btn" onClick={submit}>다음</button></div>
    </section>
  );
}

function NumInput({ step, s, onDone, onSkip }: { step: NumStep; s: S; onDone: (v: number) => void; onSkip: () => void }) {
  const [val, setVal] = useState(String(s[step.id] ?? step.def(s)));
  const [err, setErr] = useState("");
  const bump = (d: number) => setVal(v => String(Math.round(((parseFloat(v) || step.def(s)) + d) * 10) / 10));
  const submit = () => {
    const v = parseFloat(val);
    if (Number.isNaN(v) || v < step.min || v > step.max) return setErr(`${step.min}~${step.max}${step.unit} 사이로 입력해 주세요.`);
    if (step.id === "last" && s.h != null && v > s.h) return setErr(`지금 키(${s.h}cm)보다 작거나 같아야 해요.`);
    onDone(Math.round(v * 10) / 10);
  };
  return (
    <section className="screen">
      <h2>{step.q}</h2>
      <Why text={step.why} />
      <div className="numrow">
        <button className="step" aria-label={`${step.step} 줄이기`} onClick={() => bump(-step.step)}>−</button>
        <label className="numbox">
          <input id={`num-${step.id}`} type="number" inputMode="decimal" step={step.step} min={step.min} max={step.max}
            value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} aria-label={step.q} />
          <span>{step.unit}</span>
        </label>
        <button className="step" aria-label={`${step.step} 늘리기`} onClick={() => bump(step.step)}>+</button>
      </div>
      <div className="err">{err}</div>
      <div className="actions">
        <button className="btn" onClick={submit}>다음</button>
        {step.skip ? <button className="btn text" onClick={onSkip}>모르겠어요, 건너뛰기</button> : null}
      </div>
    </section>
  );
}

function Calculating({ error, onRetry }: { error: string; onRetry: () => void }) {
  const items = ["중간부모키 계산", "성장도표에서 또래 백분위 찾기", "사춘기 단계로 비중 조정", "예상 범위 정리"];
  const [k, setK] = useState(0);
  useEffect(() => {
    if (k >= items.length) return;
    const t = setTimeout(() => setK(k + 1), 420);
    return () => clearTimeout(t);
  }, [k, items.length]);
  return (
    <section className="screen">
      <h2>{error ? "계산하지 못했어요" : "계산하고 있어요"}</h2>
      {error ? (
        <>
          <p className="err">{error}</p>
          <div className="actions"><button className="btn" onClick={onRetry}>다시 시도</button></div>
        </>
      ) : (
        <div className="calc">{items.map((t, i) => <div key={t} className={i < k ? "on" : ""}><i />{t}</div>)}</div>
      )}
    </section>
  );
}
