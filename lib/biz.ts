/**
 * 사업자 정보 — 토스 라이브 심사와 전자상거래법 표시 의무용.
 * Vercel 환경변수로만 채운다. 비어 있으면 '등록 예정'으로 표시된다.
 */
export const BIZ = {
  service: "내최종키",
  name: process.env.NEXT_PUBLIC_BIZ_NAME || "",            // 상호
  ceo: process.env.NEXT_PUBLIC_BIZ_CEO || "",              // 대표자
  regNo: process.env.NEXT_PUBLIC_BIZ_REG_NO || "",         // 사업자등록번호
  mailOrderNo: process.env.NEXT_PUBLIC_BIZ_MAILORDER_NO || "", // 통신판매업 신고번호
  address: process.env.NEXT_PUBLIC_BIZ_ADDRESS || "",
  email: process.env.NEXT_PUBLIC_BIZ_EMAIL || "",
  phone: process.env.NEXT_PUBLIC_BIZ_PHONE || "",
  privacyOfficer: process.env.NEXT_PUBLIC_BIZ_PRIVACY_OFFICER || process.env.NEXT_PUBLIC_BIZ_CEO || "",
  effectiveDate: "2026년 11월 1일",
};

export const orPending = (v: string) => v || "등록 예정";
