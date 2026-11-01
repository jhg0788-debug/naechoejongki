import Link from "next/link";
import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "성장 가이드 · 내최종키",
  description: "예상키 계산 공식, 나이별 키 백분위, 1년 성장량, 초경 후 키, 남자아이 사춘기까지. 질병관리청 성장도표 기준으로 정리했어요.",
  alternates: { canonical: "/guide" },
};

export default function GuideIndex() {
  return (
    <Shell>
      <article className="doc guide">
        <div className="eyebrow">성장 가이드</div>
        <h1>아이 키, 부모가 궁금한 것들</h1>
        <ul className="guide-links">
          {GUIDES.map(g => (
            <li key={g.slug}><Link href={`/guide/${g.slug}`}><b>{g.title}</b><span>{g.description}</span></Link></li>
          ))}
        </ul>
        <Link className="btn" href="/?v=g00">우리 아이 예상키 확인하기</Link>
      </article>
    </Shell>
  );
}
