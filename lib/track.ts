"use client";

/**
 * 유입 추적 (첫 유입 기준)
 * 쇼츠 링크 예: https://도메인/?v=s01  또는  ?utm_source=youtube&utm_content=s01
 * v → utm_content → utm_campaign 순으로 영상 코드를 잡는다.
 */
const K_SID = "nk_sid", K_SRC = "nk_src", K_UTM = "nk_utm";

const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };

export function sessionId(): string {
  return safe(() => {
    let s = localStorage.getItem(K_SID);
    if (!s) { s = crypto.randomUUID(); localStorage.setItem(K_SID, s); }
    return s;
  }, "anon");
}

export function captureSource(): { src: string; utm: Record<string, string>; isNew: boolean } {
  const q = new URLSearchParams(location.search);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = q.get(k); if (v) utm[k] = v.slice(0, 80);
  }
  const fromUrl = q.get("v") || utm.utm_content || utm.utm_campaign || "";
  const prev = safe(() => localStorage.getItem(K_SRC), null);
  if (fromUrl && !prev) {
    safe(() => { localStorage.setItem(K_SRC, fromUrl); localStorage.setItem(K_UTM, JSON.stringify(utm)); }, undefined);
    return { src: fromUrl, utm, isNew: true };
  }
  const src = prev || fromUrl || "direct";
  const savedUtm = safe(() => JSON.parse(localStorage.getItem(K_UTM) || "{}"), {});
  return { src, utm: savedUtm, isNew: !prev };
}

export function currentSrc(): string {
  return safe(() => localStorage.getItem(K_SRC), null) || "direct";
}

export function track(name: string, extra: { report_id?: string; props?: Record<string, unknown> } = {}) {
  const body = JSON.stringify({
    name, session_id: sessionId(), src: currentSrc(),
    utm: safe(() => JSON.parse(localStorage.getItem(K_UTM) || "{}"), {}),
    ...extra,
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch { /* fall through */ }
  fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}
