import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, siteUrl } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "내최종키 · 영상별 전환", robots: { index: false, follow: false } };

// 비밀번호 검증과 데이터 조회는 nk-api가 한다. 쿠키에는 nk-api가 발급한 세션 토큰만 둔다.
const COOKIE = "nk_admin";
const token = async () => (await cookies()).get(COOKIE)?.value ?? "";

async function login(form: FormData) {
  "use server";
  const r = await api<{ token?: string }>("adminLogin", { password: String(form.get("key") ?? "") });
  if (r.ok && r.data.token) {
    (await cookies()).set(COOKIE, r.data.token, { httpOnly: true, secure: true, sameSite: "lax", path: "/admin", maxAge: 60 * 60 * 24 * 30 });
    redirect("/admin");
  }
  redirect("/admin?e=pw");
}

async function saveVideo(form: FormData) {
  "use server";
  const r = await api("adminSaveVideo", {
    token: await token(), code: form.get("code"), title: form.get("title"), url: form.get("url"), views: form.get("views"),
  });
  if (r.status === 401) redirect("/admin");
  revalidatePath("/admin");
  redirect(r.ok ? "/admin" : "/admin?e=code");
}

type Row = { src: string; title: string | null; views: number; landing: number; started: number; completed: number; shared: number;
  parent_sent: number; parent_opened: number; checkout: number; paid: number; revenue: number; url?: string };

const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "–");
const per10k = (a: number, views: number) => (views > 0 ? ((a / views) * 10000).toFixed(1) : "–");
const won = (n: number) => n.toLocaleString("ko-KR") + "원";

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const dash = await api<{ funnel: Row[]; videos: { code: string; title: string; url: string; views: number }[] }>("adminDashboard", { token: await token() });
  if (!dash.ok) {
    return (
      <div className="wrap"><main className="screen">
        <h2>관리자 확인</h2>
        <form action={login} className="form" style={{ gridTemplateColumns: "1fr" }}>
          <input id="key" name="key" type="password" placeholder="관리자 비밀번호" autoComplete="current-password" />
          <button className="btn" type="submit">들어가기</button>
        </form>
        {sp.e === "pw" ? <p className="err" role="alert">비밀번호가 맞지 않아요.</p> : null}
      </main></div>
    );
  }
  const { funnel, videos } = dash.data;
  const rows = new Map<string, Row>();
  for (const f of (funnel ?? []) as Row[]) rows.set(f.src, { ...f });
  for (const v of videos ?? []) {
    const r = rows.get(v.code);
    if (r) { r.views = v.views; r.title = v.title; r.url = v.url; }
    else rows.set(v.code, { src: v.code, title: v.title, url: v.url, views: v.views, landing: 0, started: 0, completed: 0, shared: 0, parent_sent: 0, parent_opened: 0, checkout: 0, paid: 0, revenue: 0 });
  }
  const list = [...rows.values()].sort((a, b) => b.paid - a.paid || b.completed - a.completed);
  const tot = list.reduce((t, r) => ({
    views: t.views + r.views, landing: t.landing + r.landing, completed: t.completed + r.completed,
    parent_sent: t.parent_sent + r.parent_sent, paid: t.paid + r.paid, revenue: t.revenue + r.revenue,
  }), { views: 0, landing: 0, completed: 0, parent_sent: 0, paid: 0, revenue: 0 });
  const site = siteUrl();

  return (
    <div className="wrap admin">
      <main className="screen" style={{ gap: 22 }}>
        <div>
          <div className="eyebrow">내최종키 · 관리자</div>
          <h2 style={{ marginTop: 6 }}>영상별 전환</h2>
          <p className="note" style={{ marginTop: 4 }}>세션 기준 중복 제거. 조회수는 아래에서 직접 입력해요. 핵심 지표는 &lsquo;1만 뷰당 결제&rsquo;예요.</p>
        </div>

        <div className="kpis">
          <div className="stat"><div className="k">입력한 조회수</div><div className="v">{tot.views.toLocaleString()}</div></div>
          <div className="stat"><div className="k">방문 → 예측 완료</div><div className="v">{tot.completed.toLocaleString()} <small className="note">{pct(tot.completed, tot.landing)}</small></div></div>
          <div className="stat"><div className="k">부모 결제</div><div className="v">{tot.paid.toLocaleString()}건</div></div>
          <div className="stat"><div className="k">매출</div><div className="v">{won(tot.revenue)}</div></div>
          <div className="stat"><div className="k">1만 뷰당 결제</div><div className="v">{per10k(tot.paid, tot.views)}</div></div>
        </div>

        <div className="tablewrap">
          <table>
            <thead><tr>
              <th>영상</th><th>조회수</th><th>방문</th><th>클릭률</th><th>시작</th><th>완료</th><th>완료율</th>
              <th>부모 전송</th><th>부모 열람</th><th>결제 진입</th><th>결제</th><th>결제율(완료 대비)</th><th>매출</th><th>1만 뷰당 결제</th><th>1만 뷰당 매출</th>
            </tr></thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={15} style={{ textAlign: "left" }}>아직 데이터가 없어요. 아래에서 영상을 등록하고 링크를 쇼츠에 붙여 주세요.</td></tr>
              ) : list.map(r => (
                <tr key={r.src}>
                  <td className="key">{r.src}{r.title ? <div className="note" style={{ fontFamily: "var(--body)", fontWeight: 400 }}>{r.title}</div> : null}</td>
                  <td>{r.views.toLocaleString()}</td><td>{r.landing}</td><td>{pct(r.landing, r.views)}</td>
                  <td>{r.started}</td><td>{r.completed}</td><td>{pct(r.completed, r.landing)}</td>
                  <td>{r.parent_sent}</td><td>{r.parent_opened}</td><td>{r.checkout}</td>
                  <td className="hl">{r.paid}</td><td>{pct(r.paid, r.completed)}</td><td>{won(r.revenue)}</td>
                  <td className="hl">{per10k(r.paid, r.views)}</td><td>{r.views > 0 ? won(Math.round(r.revenue / r.views * 10000)) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>영상 등록 · 조회수 갱신</h3>
          <p className="note">같은 코드로 다시 저장하면 조회수가 갱신돼요. 코드는 영문 소문자·숫자·-·_ 만 써요.{sp.e === "code" ? " 코드를 확인해 주세요." : ""}</p>
          <form action={saveVideo} className="form">
            <div><label className="label" htmlFor="code">코드</label><input id="code" name="code" placeholder="s01" required /></div>
            <div><label className="label" htmlFor="title">제목</label><input id="title" name="title" placeholder="댓글 답장형 #1" /></div>
            <div><label className="label" htmlFor="url">영상 URL</label><input id="url" name="url" placeholder="https://youtube.com/shorts/…" /></div>
            <div><label className="label" htmlFor="views">조회수</label><input id="views" name="views" type="number" min={0} inputMode="numeric" placeholder="0" /></div>
            <button className="btn" type="submit">저장</button>
          </form>
        </div>

        <div className="card">
          <h3>쇼츠에 붙일 링크</h3>
          <p className="note">영상마다 코드만 바꿔서 고정댓글·설명란에 붙여요.</p>
          <div className="tablewrap"><table><tbody>
            {(videos ?? []).length === 0 ? <tr><td>{site}/?v=s01</td></tr> :
              (videos ?? []).map(v => <tr key={v.code}><td className="key">{v.code}</td><td style={{ textAlign: "left" }}>{site}/?v={v.code}</td></tr>)}
          </tbody></table></div>
        </div>
      </main>
    </div>
  );
}
