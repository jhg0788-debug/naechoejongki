"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Shell } from "./Shell";
import { GrowthChart, pathAt } from "./GrowthChart";
import { share } from "@/lib/share";
import { captureSource, sessionId, track } from "@/lib/track";
import type { FreeResult, FullResult } from "@/lib/predict";

export interface ReportData {
  id: string;
  sex: "m" | "f";
  height: number;
  paid: boolean;
  free: FreeResult;
  full: FullResult | null;
  habits: { sleep: number; exercise: number; milk: number; weight: number | null } | null;
  price: number;
}

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function ReportView({ report, view, justPaid }: { report: ReportData; view: "child" | "parent" | "guardian"; justPaid: boolean }) {
  const { free, full } = report;
  const sexK = report.sex === "m" ? "남자" : "여자";
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    captureSource();
    if (view === "parent") track("parent_open", { report_id: report.id });
  }, [view, report.id]);

  const base = typeof window !== "undefined" ? location.origin : "";
  const parentUrl = `${base}/r/${report.id}?p=1`;
  const homeUrl = `${base}/`;

  const sendToParent = async () => {
    const ch = await share({
      title: "내최종키 · 예상키 리포트",
      text: `엄마 아빠, 내 예상키 범위 나왔어 (${free.lo}~${free.hi}cm). 중앙값이랑 성장 곡선 나오는 상세 리포트 한번 봐줘!`,
      url: parentUrl, button: "리포트 보기", image: `/r/${report.id}/opengraph-image`,
    });
    track("parent_send", { report_id: report.id, props: { channel: ch } });
  };
  const shareFriend = async () => {
    const ch = await share({
      title: "내최종키 · 내 예상키는?",
      text: view === "guardian"
        ? "엄마·아빠 키랑 아이 지금 키로 최종 예상키 범위를 볼 수 있어요. 돌 아기부터 돼요."
        : `내최종키에서 예상키 범위 ${free.lo}~${free.hi}cm 나옴. 너도 해봐`,
      url: homeUrl, button: "나도 해보기",
    });
    track("share_friend", { report_id: report.id, props: { channel: ch } });
  };

  return (
    <Shell>
      <section className="screen">
        {view === "parent" && !report.paid ? (
          <div>
            <div className="eyebrow">보호자용</div>
            <h2 style={{ marginTop: 6 }}>자녀가 예상키 리포트를 보냈어요</h2>
          </div>
        ) : (
          <div className="eyebrow">만 {free.ageYears}세 {free.ageMonths}개월 · {sexK} · 지금 {report.height}cm</div>
        )}
        {justPaid && report.paid ? <div className="notice" role="status">결제가 완료됐어요. 이 링크로 언제든 다시 볼 수 있어요.</div> : null}

        <div className="card">
          <div className="note">만 18세 무렵 예상키 범위</div>
          <div className="range">{free.lo} – {free.hi}<small>cm</small></div>
          <Meter lo={free.lo} hi={free.hi} now={report.height} />
          <div className="statrow">
            <div className="stat"><div className="k">또래 {sexK} 중 지금 키</div><div className="v">상위 {free.peerTopPct}%</div></div>
            <div className="stat"><div className="k">예측 신뢰도</div><div className="v">{free.confidence}</div></div>
          </div>
          {view === "child" ? <button className="btn ghost" onClick={shareFriend}>친구랑 비교하기</button> : null}
          {view === "guardian" ? <button className="btn ghost" onClick={shareFriend}>다른 부모에게 알려주기</button> : null}
        </div>

        {full && report.habits ? (
          <Detail full={full} report={report} />
        ) : (
          <div className="card">
            <div>
              <div className="eyebrow">상세 리포트</div>
              <h3 style={{ marginTop: 4 }}>{view === "child" ? "보호자 확인 후 열려요" : "보호자 결제 후 열려요"}</h3>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <Lock name="가장 가능성 높은 키" sub="범위 안 중앙값" blur="17?.? cm" />
              <Lock name="남은 성장 기간" sub="사춘기 단계 기준 추정" blur="약 ?년" />
              <Lock name="성장 곡선" sub="성장도표 위 지금 위치와 예상 경로" blur="〰〰〰" />
              <Lock name="생활습관 위치" sub="수면·운동·영양이 범위 어디쯤인지" blur="▮▮▯▯" />
            </div>
            {view !== "child" ? (
              <>
                <Link className="btn" href={`/r/${report.id}/pay`}>상세 리포트 열기 · {won(report.price)}</Link>
                <p className="note">1회 결제로 이 리포트를 계속 볼 수 있어요. 정기결제가 아니에요.</p>
              </>
            ) : (
              <>
                <button className="btn" onClick={sendToParent}>부모님께 리포트 보내기</button>
                <p className="note">부모님이 링크에서 확인하면 이 화면도 같이 열려요.</p>
              </>
            )}
          </div>
        )}

        <div className="statrow noprint">
          <Link className="btn ghost" href="/kids">내 아이 기록장</Link>
          <button className="btn ghost" onClick={() => window.print()}>PDF로 저장</button>
        </div>
        <Link className="btn text noprint" href="/">{view === "child" ? "처음부터 다시 하기" : "다른 자녀도 확인하기"}</Link>
        <DeleteReport id={report.id} />
      </section>
    </Shell>
  );
}

function DeleteReport({ id }: { id: string }) {
  const [step, setStep] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const del = async () => {
    setStep("busy"); setErr("");
    try {
      const res = await fetch(`/api/reports/${id}?s=${encodeURIComponent(sessionId())}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "삭제하지 못했어요.");
      setStep("done");
    } catch (e: any) { setErr(e?.message || "삭제하지 못했어요."); setStep("confirm"); }
  };
  if (step === "done") return <p className="notice" role="status">리포트와 입력한 정보를 삭제했어요. 결제 기록은 법에 따라 5년간 보관돼요.</p>;
  if (step === "idle") return <button className="btn text" style={{ fontSize: 13 }} onClick={() => setStep("confirm")}>이 리포트 삭제하기</button>;
  return (
    <div className="card" style={{ gap: 10 }}>
      <p className="note">리포트와 입력한 키·생년월 정보가 지워지고 이 링크는 더 이상 열리지 않아요. 결제한 리포트도 다시 볼 수 없어요.</p>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <div className="statrow">
        <button className="btn ghost" onClick={() => setStep("idle")}>취소</button>
        <button className="btn" disabled={step === "busy"} onClick={del}>{step === "busy" ? "삭제 중…" : "삭제"}</button>
      </div>
    </div>
  );
}

function Meter({ lo, hi, now }: { lo: number; hi: number; now: number }) {
  // 지금 키가 140cm보다 작으면 눈금 시작을 내려서 지금 위치도 보이게 한다
  const a = Math.min(140, Math.floor((now - 5) / 10) * 10), b = 200, x = (v: number) => ((Math.min(b, Math.max(a, v)) - a) / (b - a)) * 100;
  const step = b - a > 80 ? 20 : 10;
  const marks: number[] = []; for (let m = a; m <= b; m += step) marks.push(m);
  return (
    <div className="meter" role="img" aria-label={`예상 범위 ${lo}에서 ${hi}cm, 지금 키 ${now}cm`}>
      <div className="ticks" />
      <div className="bandv" style={{ left: `${x(lo)}%`, width: `${x(hi) - x(lo)}%` }} />
      <div className="now" style={{ left: `${x(now)}%` }} />
      {marks.map(m => <div key={m} className="mk" style={{ left: `${x(m)}%` }}>{m}</div>)}
    </div>
  );
}

function Lock({ name, sub, blur }: { name: string; sub: string; blur: string }) {
  return (
    <div className="lockitem">
      <div className="nm">{name}<small>{sub}</small></div>
      <div className="blur" aria-hidden="true">{blur}</div>
    </div>
  );
}

const SLEEP = ["6시간 미만", "6~7시간", "7~8시간", "8~9시간", "9시간 이상"];
const EX = ["거의 안 함", "주 1~2일", "주 3~4일", "주 5일 이상"];
const MILK = ["거의 안 먹음", "하루 1번", "하루 2번", "하루 3번 이상"];

function Detail({ full, report }: { full: FullResult; report: ReportData }) {
  const h = report.habits!;
  const age = full.ageYears + full.ageMonths / 12;
  return (
    <div className="card">
      <div className="eyebrow">상세 리포트</div>
      <div className="statrow">
        <div className="stat"><div className="k">가장 가능성 높은 키</div><div className="v">{full.median.toFixed(1)}cm</div></div>
        <div className="stat"><div className="k">남은 성장 기간</div><div className="v">{full.remaining}</div></div>
      </div>
      <p className="note">
        지금 키에서 중앙값까지 약 {full.toGo.toFixed(1)}cm 남았어요. 중간부모키 {full.mph.toFixed(1)}cm와
        성장도표 백분위 기준 {full.pctPred.toFixed(1)}cm를 사춘기 단계에 맞춰 섞은 값이에요.
      </p>
      <div>
        <div className="label">성장 곡선</div>
        <div className="chartbox">
          <GrowthChart sex={report.sex} age={age} height={report.height} zNow={full.zNow} zFinal={full.zFinal} lo={full.lo} hi={full.hi} />
        </div>
        <div className="legend">
          <span><i style={{ background: "var(--muted)" }} />3·50·97 백분위</span>
          <span><i style={{ background: "var(--accent)" }} />예상 경로</span>
          <span><i style={{ background: "var(--band)", height: 10 }} />만 18세 예상 범위</span>
        </div>
      </div>
      <Schedule full={full} sex={report.sex} age={age} height={report.height} />
      <Signals full={full} />
      <div className="habit">
        <div className="label" style={{ margin: 0 }}>생활습관 위치 · 지금 습관은 <b>{full.habitLabel}</b>에 가까워요</div>
        <div className="meter" style={{ height: 14, marginBottom: 8 }} aria-hidden="true">
          <div className="bandv" style={{ left: 0, width: "100%" }} />
          <div className="now" style={{ left: `${full.habitPos * 100}%` }} />
        </div>
        <div className="row"><span>수면</span><em>{SLEEP[h.sleep]}</em></div>
        <div className="row"><span>운동</span><em>{EX[h.exercise]}</em></div>
        <div className="row"><span>우유·단백질</span><em>{MILK[h.milk]}</em></div>
        <p className="note">권장 수면은 나이마다 달라요. 미국수면의학회 기준 1~2세 11~14시간, 3~5세 10~13시간, 6~12세 9~12시간, 청소년 8~10시간이에요. 습관은 예측 범위 안에서 위치를 보여주는 참고 지표이고, 키를 늘린다는 뜻이 아니에요.</p>
      </div>
      {full.wide || full.velocityFlag ? (
        <div className="notice">
          {full.velocityFlag ? "작년 대비 자란 양이 또래 평균과 차이가 커서 범위를 넓게 잡았어요. " : ""}
          범위를 더 좁히고 싶다면 소아청소년과·성장클리닉에서 골연령 검사로 확인할 수 있어요.
        </div>
      ) : null}
      {h.weight ? <p className="note">몸무게 {h.weight}kg은 월별 기록용으로만 표시돼요.</p> : null}
    </div>
  );
}

/** 생일마다 가장 가능성 높은 경로 위의 키. 남은 해가 많으면 2년 간격 */
function Schedule({ full, sex, age, height }: { full: FullResult; sex: "m" | "f"; age: number; height: number }) {
  const start = Math.floor(age) + 1;
  if (start > 18) return null;
  const step = 18 - start + 1 > 8 ? 2 : 1;
  const ages: number[] = [];
  for (let a = start; a < 18; a += step) ages.push(a);
  ages.push(18);
  const at = (a: number) => pathAt(sex, age, full.zNow, full.zFinal, a);
  const nextYear = age < 17 ? at(age + 1) - height : null;
  return (
    <div className="sched">
      <div className="label">나이별 예상 키 <small>가장 가능성 높은 경로 기준</small></div>
      {nextYear != null ? <p className="note">앞으로 1년 동안 약 <b>{nextYear.toFixed(1)}cm</b> 자라는 경로예요. 1년 뒤 재서 비교해 보세요.</p> : null}
      <table>
        <thead><tr><th>나이</th><th>예상 키</th><th>지금부터</th></tr></thead>
        <tbody>
          {ages.map(a => (
            <tr key={a}><td>만 {a}세</td><td>{at(a).toFixed(1)}cm</td><td>+{(at(a) - height).toFixed(1)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="note">실제 키는 해마다 이 경로 위아래로 움직여요. 몇 달 단위로 다시 재면 경로가 더 정확해져요.</p>
    </div>
  );
}

/** 진료로 확인해 볼 만한 신호. 진단이 아니라 일반적인 확인 기준과 해당 여부만 보여준다 */
function Signals({ full }: { full: FullResult }) {
  const items: { t: string; on: boolean | null }[] = [
    { t: "지금 키가 또래 100명 중 작은 쪽 3명 안에 들어요", on: full.zNow < -1.881 },
    { t: "작년 대비 자란 양이 또래 평균과 많이 달라요", on: full.velocityFlag },
    { t: "지금 키로 본 예상치가 엄마·아빠 키로 본 예상치보다 8cm 넘게 낮아요", on: full.pctPred < full.mph - 8 },
    { t: "만 4세 이후 사춘기 전인데 1년에 4cm 미만으로 자랐어요", on: null },
    { t: "사춘기 변화가 여아 만 8세 전, 남아 만 9세 전에 시작됐어요", on: null },
  ];
  const any = items.some(i => i.on);
  return (
    <div className="signals">
      <div className="label">진료로 확인해 볼 신호</div>
      <ul>
        {items.map(i => (
          <li key={i.t} className={i.on ? "on" : ""}>
            <span>{i.t}</span>
            <em>{i.on == null ? "직접 확인" : i.on ? "해당" : "해당 없음"}</em>
          </li>
        ))}
      </ul>
      <p className="note">{any ? "해당하는 항목이 있어요. " : ""}하나라도 해당되면 소아청소년과에서 성장 상태를 확인해 보세요. 이 목록은 진단이 아니에요.</p>
    </div>
  );
}
