import Link from "next/link";
import { BIZ, orPending } from "@/lib/biz";

export function Disclaimer() {
  return (
    <footer className="disc">
      <div><b>의료기기가 아닙니다.</b> 중간부모키 공식과 질병관리청 2017 소아청소년 성장도표 기준으로 계산한 참고용 추정치예요. 정확한 판단은 소아청소년과·성장클리닉 진료로 확인하세요.</div>
      <div>이름·연락처는 받지 않아요. 입력값과 결과는 리포트 링크로 다시 보기 위해 180일 동안 보관돼요.</div>
      <nav className="legal">
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy"><b>개인정보처리방침</b></Link>
        <Link href="/refund">환불정책</Link>
      </nav>
      <div className="biz">
        {orPending(BIZ.name)} · 대표 {orPending(BIZ.ceo)} · 사업자등록번호 {orPending(BIZ.regNo)}<br />
        통신판매업 신고 {orPending(BIZ.mailOrderNo)} · {orPending(BIZ.address)}<br />
        문의 {orPending(BIZ.email)}{BIZ.phone ? ` · ${BIZ.phone}` : ""}
      </div>
    </footer>
  );
}

export function Shell({ children, progress, onBack }: {
  children: React.ReactNode;
  progress?: { idx: number; total: number } | null;
  onBack?: (() => void) | null;
}) {
  return (
    <div className="wrap">
      <header className="top">
        <div className="toprow">
          <Link href="/" className="brand"><i aria-hidden="true" />내최종키</Link>
          {onBack ? <button className="back" onClick={onBack}>← 이전</button> : null}
        </div>
        {progress ? (
          <div className="tape" role="progressbar" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.idx}>
            <div className="fill" style={{ width: `${(progress.idx / progress.total) * 100}%` }} />
            <div className="lbl">{progress.idx}/{progress.total}</div>
          </div>
        ) : null}
      </header>
      <main>{children}</main>
      <Disclaimer />
    </div>
  );
}
