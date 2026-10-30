import "server-only";

/**
 * 공유 카드(OG 이미지)용 한글 폰트.
 * Google Fonts에서 카드에 실제로 쓰이는 글자만 잘라 받아온다 (수 KB).
 * 실패하면 null → 카드는 숫자·영문만으로 그려진다.
 */
export async function loadFont(family: string, text: string, weight = 400): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36" } })).text();
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}
