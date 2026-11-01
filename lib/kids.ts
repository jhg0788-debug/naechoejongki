"use client";

/**
 * 내 아이 기록장 — 이 기기 브라우저에만 저장한다 (로그인 없이).
 * 리포트를 만들 때마다 같은 아이(성별·생년월)로 묶어서 측정 기록을 쌓는다.
 */
import type { FreeResult } from "./predict";

export type Sex = "m" | "f";
export interface KidRecord { reportId: string; date: string; height: number; lo: number; hi: number }
export interface Kid {
  id: string; nick: string; sex: Sex; by: number; bm: number;
  dad: number; mom: number; weight: number | null;
  puberty: number; sleep: number; ex: number; milk: number;
  records: KidRecord[];
}
export interface KidInput {
  sex: Sex; by: number; bm: number; dad: number; mom: number; weight: number | null;
  puberty: number; sleep: number; ex: number; milk: number; height: number;
}

const K = "nk_kids";

export function loadKids(): Kid[] {
  try {
    const v = JSON.parse(localStorage.getItem(K) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

export function saveKids(list: Kid[]) {
  try { localStorage.setItem(K, JSON.stringify(list)); } catch { /* 저장 공간이 막힌 브라우저 */ }
}

/** 새 리포트를 기록장에 넣는다. 같은 성별·생년월이면 같은 아이로 본다. */
export function addRecord(x: KidInput, reportId: string, free: Pick<FreeResult, "lo" | "hi">, date = new Date()): Kid {
  const list = loadKids();
  let kid = list.find(k => k.sex === x.sex && k.by === x.by && k.bm === x.bm);
  if (!kid) {
    kid = { id: crypto.randomUUID(), nick: "", sex: x.sex, by: x.by, bm: x.bm, dad: x.dad, mom: x.mom, weight: x.weight,
      puberty: x.puberty, sleep: x.sleep, ex: x.ex, milk: x.milk, records: [] };
    list.push(kid);
  }
  Object.assign(kid, { dad: x.dad, mom: x.mom, weight: x.weight, puberty: x.puberty, sleep: x.sleep, ex: x.ex, milk: x.milk });
  if (!kid.records.some(r => r.reportId === reportId))
    kid.records.push({ reportId, date: date.toISOString().slice(0, 10), height: x.height, lo: free.lo, hi: free.hi });
  kid.records.sort((a, b) => a.date.localeCompare(b.date));
  saveKids(list);
  return kid;
}

/** 10~14개월 전에 잰 기록이 있으면 '작년 키'로 쓴다 */
export function lastYearHeight(kid: Kid, now = new Date()): number | null {
  const days = (d: string) => (now.getTime() - Date.parse(d)) / 864e5;
  const cand = kid.records.filter(r => days(r.date) >= 300 && days(r.date) <= 430);
  if (!cand.length) return null;
  return cand.sort((a, b) => Math.abs(days(a.date) - 365) - Math.abs(days(b.date) - 365))[0].height;
}

/** 다음 달부터 매달 '키 재는 날' 캘린더 파일 (.ics) */
export function reminderIcs(origin: string, nick: string, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() + 1, Math.min(from.getDate(), 28));
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const who = nick ? `${nick} ` : "아이 ";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//naechoejongki//KR", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@naechoejongki`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd}`, "RRULE:FREQ=MONTHLY;COUNT=12",
    `SUMMARY:${who}키 재는 날 · 내최종키`,
    `DESCRIPTION:아침에 키를 재고 기록장에 넣어 주세요. ${origin}/kids`,
    `URL:${origin}/kids`,
    "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY", `DESCRIPTION:${who}키 재는 날`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
