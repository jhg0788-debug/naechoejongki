import { Shell } from "@/components/Shell";
import { BIZ, orPending } from "@/lib/biz";
import { PRODUCTS } from "@/lib/server";

export const metadata = { title: "환불정책 · 내최종키" };

export default function Refund() {
  const price = PRODUCTS.report_single.amount.toLocaleString("ko-KR");
  return (
    <Shell>
      <article className="doc">
        <h1>환불정책</h1>
        <p className="meta">시행일 {BIZ.effectiveDate}</p>

        <h2>상품</h2>
        <p>내최종키 상세 리포트 1건 · {price}원 · 1회 결제 (정기결제 아님)</p>

        <h2>청약철회 제한</h2>
        <p>상세 리포트는 결제 즉시 화면에 제공되는 디지털 콘텐츠입니다. 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항 제5호에 따라, 결제 후 리포트가 열리면 단순 변심에 의한 청약철회가 제한됩니다. 회사는 결제 전에 이 사실을 알리고, 예상키 범위와 또래 백분위를 무료로 먼저 보여줍니다.</p>

        <h2>전액 환불되는 경우</h2>
        <ul>
          <li>결제는 됐는데 상세 리포트가 열리지 않은 경우</li>
          <li>같은 리포트를 두 번 이상 결제한 경우</li>
          <li>서비스 오류로 리포트 내용이 표시되지 않거나 명백히 잘못 계산된 경우</li>
          <li>보호자 동의 없이 미성년자가 결제한 경우 (민법 제5조)</li>
        </ul>

        <h2>요청 방법</h2>
        <p>{orPending(BIZ.email)}로 결제일, 결제 금액, 리포트 링크를 보내 주세요. 확인 후 3영업일 안에 결제 취소합니다. 카드사 사정에 따라 환불이 반영되기까지 3~7영업일이 걸릴 수 있습니다.</p>
      </article>
    </Shell>
  );
}
