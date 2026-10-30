"use client";

export function toast(text: string) {
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = text;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2400);
}

export async function copyText(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(ok);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let done = false;
    try { done = document.execCommand("copy"); } catch { /* noop */ }
    ta.remove();
    toast(done ? ok : "복사가 안 됐어요. 문구를 길게 눌러 복사해 주세요");
  }
}

declare global { interface Window { Kakao?: any } }

/**
 * 공유 순서: 카카오톡(키 설정 시) → 기기 공유 시트 → 복사
 * 반환값: 사용한 채널
 */
export async function share(opts: { title: string; text: string; url: string; button: string; image?: string }): Promise<"kakao" | "native" | "copy"> {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  const K = window.Kakao;
  if (key && K) {
    try {
      if (!K.isInitialized()) K.init(key);
      K.Share.sendDefault({
        objectType: "feed",
        content: {
          title: opts.title, description: opts.text,
          imageUrl: new URL(opts.image || "/opengraph-image", location.origin).toString(),
          link: { mobileWebUrl: opts.url, webUrl: opts.url },
        },
        buttons: [{ title: opts.button, link: { mobileWebUrl: opts.url, webUrl: opts.url } }],
      });
      return "kakao";
    } catch { /* fall through */ }
  }
  if (navigator.share) {
    try { await navigator.share({ title: opts.title, text: opts.text, url: opts.url }); return "native"; }
    catch (e: any) { if (e?.name === "AbortError") return "native"; }
  }
  await copyText(`${opts.text}\n${opts.url}`, "복사했어요. 카톡에 붙여넣기 해 주세요");
  return "copy";
}
