import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { GUIDES, guideBySlug } from "@/lib/guides";

export const dynamicParams = false;
export function generateStaticParams() {
  return GUIDES.map(g => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return {
    title: `${g.title} · 내최종키`,
    description: g.description,
    keywords: g.keywords,
    alternates: { canonical: `/guide/${g.slug}` },
    openGraph: { title: g.title, description: g.description, type: "article", locale: "ko_KR" },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const others = GUIDES.filter(x => x.slug !== g.slug);
  return (
    <Shell>
      <article className="doc guide">
        <div className="eyebrow">성장 가이드</div>
        <h1>{g.title}</h1>
        {g.body()}
        <div className="card cta">
          <h3>우리 아이 예상키, 1분이면 범위로 나와요</h3>
          <p className="note">엄마·아빠 키, 아이의 지금 키와 사춘기 단계로 만 18세 무렵 예상키를 계산해요. 회원가입 없이 무료예요.</p>
          <Link className="btn" href={`/?v=${g.code}`}>예상키 확인하기</Link>
        </div>
        <h2>다른 가이드</h2>
        <ul className="guide-links">
          {others.map(o => <li key={o.slug}><Link href={`/guide/${o.slug}`}>{o.title}</Link></li>)}
        </ul>
      </article>
    </Shell>
  );
}
