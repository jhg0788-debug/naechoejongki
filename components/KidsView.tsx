"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "./Shell";
import { GrowthChart } from "./GrowthChart";
import { ageInYears } from "@/lib/predict";
import { addRecord, lastYearHeight, loadKids, reminderIcs, saveKids, type Kid } from "@/lib/kids";
import { currentSrc, sessionId, track } from "@/lib/track";

const fmt = (d: string) => `${d.slice(0, 4)}.${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

export default function KidsView() {
  const [kids, setKids] = useState<Kid[] | null>(null);
  useEffect(() => { setKids(loadKids()); track("landing", { props: { path: "/kids" } }); }, []);
  const refresh = () => setKids(loadKids());

  if (kids == null) return <Shell><section className="screen" /></Shell>;

  return (
    <Shell>
      <section className="screen">
        <div>
          <div className="eyebrow">이 기기에 저장된 기록</div>
          <h2 style={{ marginTop: 6 }}>내 아이 기록장</h2>
        </div>
        {kids.length === 0 ? (
          <div className="card">
            <p>아직 기록이 없어요. 예상키를 한 번 확인하면 여기에 자동으로 쌓여요.</p>
            <Link className="btn" href="/">예상키 확인하기</Link>
          </div>
        ) : kids.map(k => <KidCard key={k.id} kid={k} onChange={refresh} />)}
        <p className="note">기록은 이 휴대폰 브라우저에만 저장돼요. 브라우저 기록을 지우거나 다른 기기에서 열면 보이지 않아요.</p>
        {kids.length ? <Link className="btn text" href="/">다른 아이 추가하기</Link> : null}
      </section>
    </Shell>
  );
}

function KidCard({ kid, onChange }: { kid: Kid; onChange: () => void }) {
  const now = new Date();
  const age = ageInYears(kid.by, kid.bm, now);
  const last = kid.records.at(-1);
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState(kid.nick);
  const sexK = kid.sex === "m" ? "남자" : "여자";
  const ageAt = (d: string) => ageInYears(kid.by, kid.bm, new Date(d));

  const saveNick = () => {
    const list = loadKids(); const k = list.find(x => x.id === kid.id);
    if (k) { k.nick = nick.trim().slice(0, 12); saveKids(list); onChange(); }
  };
  const remove = () => {
    if (!confirmDelete()) return;
    saveKids(loadKids().filter(x => x.id !== kid.id)); onChange();
  };
  const reminder = () => {
    const blob = new Blob([reminderIcs(location.origin, kid.nick)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "내최종키-키재는날.ics"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    track("step", { props: { q: "reminder" } });
  };

  return (
    <div className="card">
      <div className="kidhead">
        <input className="nick" value={nick} placeholder="아이 이름 (이 기기에만 저장)" maxLength={12}
          onChange={e => setNick(e.target.value)} onBlur={saveNick} aria-label="아이 이름" />
        <div className="note">만 {Math.floor(age)}세 {Math.floor((age % 1) * 12)}개월 · {sexK}</div>
      </div>
      {last ? (
        <>
          <div className="note">만 18세 무렵 예상키 범위 · {fmt(last.date)} 기준</div>
          <div className="range">{last.lo} – {last.hi}<small>cm</small></div>
          <div className="chartbox">
            <GrowthChart sex={kid.sex} age={ageAt(last.date)} height={last.height} lo={last.lo} hi={last.hi}
              points={kid.records.map(r => ({ age: ageAt(r.date), height: r.height }))} />
          </div>
          <table className="records">
            <thead><tr><th>잰 날</th><th>키</th><th>예상 범위</th></tr></thead>
            <tbody>
              {kid.records.slice().reverse().map(r => (
                <tr key={r.reportId}>
                  <td><Link href={`/r/${r.reportId}?p=2`}>{fmt(r.date)}</Link></td>
                  <td>{r.height}cm</td>
                  <td>{r.lo}–{r.hi}cm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {open ? <Measure kid={kid} age={age} onDone={() => { setOpen(false); onChange(); }} onCancel={() => setOpen(false)} />
        : <button className="btn" onClick={() => setOpen(true)}>새로 잰 키 넣기</button>}
      <div className="statrow">
        <button className="btn ghost" onClick={reminder}>매달 재는 날 알림</button>
        <button className="btn ghost" onClick={remove}>기기에서 지우기</button>
      </div>
      <p className="note">알림은 휴대폰 캘린더에 매달 일정으로 추가돼요.</p>
    </div>
  );
}

function confirmDelete() {
  // 브라우저 확인창 대신 두 번 누르기
  const k = "nk_del_arm", t = Date.now();
  const prev = Number(sessionStorage.getItem(k) || 0);
  sessionStorage.setItem(k, String(t));
  if (t - prev < 4000) return true;
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = "한 번 더 누르면 이 기기에서 지워져요";
  document.body.appendChild(d); setTimeout(() => d.remove(), 2400);
  return false;
}

function Measure({ kid, age, onDone, onCancel }: { kid: Kid; age: number; onDone: () => void; onCancel: () => void }) {
  const lastH = kid.records.at(-1)?.height ?? 100;
  const [h, setH] = useState<string>(String(lastH));
  const [pub, setPub] = useState<number>(kid.puberty);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const under14 = age < 14;
  const pubOn = age >= (kid.sex === "f" ? 7 : 8);
  const pubOpts = kid.sex === "m"
    ? ["아직 변화 없음", "막 시작됨", "한창 진행 중", "거의 끝남"]
    : ["가슴 변화 없음", "가슴 변화, 초경 전", "초경 1년 안", "초경 1년 넘음"];

  const submit = async () => {
    const height = Number(h);
    if (!(height >= 40 && height <= 200)) { setErr("키는 40~200cm 사이로 넣어 주세요."); return; }
    if (under14 && !consent) { setErr("보호자 동의에 체크해 주세요."); return; }
    setBusy(true); setErr("");
    try {
      const ly = lastYearHeight(kid);
      const body = {
        session_id: sessionId(), src: currentSrc(),
        sex: kid.sex, birthYear: kid.by, birthMonth: kid.bm, under14Consent: under14 ? consent : false,
        height, weight: kid.weight, dad: kid.dad, mom: kid.mom, lastYear: ly != null && ly <= height ? ly : null,
        puberty: pubOn ? pub : 0, sleep: kid.sleep, exercise: kid.ex, milk: kid.milk,
      };
      const res = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "저장하지 못했어요.");
      addRecord({ sex: kid.sex, by: kid.by, bm: kid.bm, dad: kid.dad, mom: kid.mom, weight: kid.weight,
        puberty: body.puberty, sleep: kid.sleep, ex: kid.ex, milk: kid.milk, height }, out.id, out.free);
      onDone();
    } catch (e: any) { setErr(e?.message || "저장하지 못했어요."); }
    finally { setBusy(false); }
  };

  return (
    <div className="measure">
      <div className="label">오늘 잰 키</div>
      <div className="numbox">
        <input inputMode="decimal" value={h} onChange={e => setH(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="오늘 잰 키" />
        <span>cm</span>
      </div>
      {pubOn ? (
        <div>
          <div className="label">사춘기 변화</div>
          <div className="chips two">
            {pubOpts.map((t, i) => (
              <button key={t} className="chip" aria-pressed={pub === i} onClick={() => setPub(i)}>{t}</button>
            ))}
          </div>
        </div>
      ) : null}
      {under14 ? (
        <label className="check">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
          <span>저는 이 아이의 보호자(법정대리인)이고, <Link href="/privacy" target="_blank">개인정보처리방침</Link>에 동의해요.</span>
        </label>
      ) : null}
      <p className="note">엄마·아빠 키와 생활습관은 지난번 입력을 그대로 써요. 1년 전쯤 잰 기록이 있으면 성장 속도도 자동으로 반영해요.</p>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <div className="statrow">
        <button className="btn ghost" onClick={onCancel}>취소</button>
        <button className="btn" disabled={busy} onClick={submit}>{busy ? "계산 중…" : "저장하고 다시 계산"}</button>
      </div>
    </div>
  );
}
