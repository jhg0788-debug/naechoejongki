# 내최종키

쇼츠 링크로 들어온 10대가 예상키 범위를 무료로 받고, 상세 리포트는 부모가 토스로 결제해서 여는 모바일 웹.
영상별로 `방문 → 예측 완료 → 부모 전송 → 부모 열람 → 결제`를 자동으로 집계한다.

## 구조

```
app/
  page.tsx               온보딩 (질문 11단계, 14세 미만 보호자 확인)
  r/[id]/page.tsx        리포트. 결제 전엔 무료 필드만 브라우저로 보냄. ?p=1 이면 보호자 화면
  r/[id]/pay/page.tsx    토스 결제위젯
  pay/success/page.tsx   토스 승인 (서버에서 금액 대조 후 /v1/payments/confirm)
  pay/fail/page.tsx      실패·취소 처리
  admin/page.tsx         영상별 전환 대시보드 + 영상 등록·조회수 입력 + 쇼츠 링크
  api/track              클라이언트 이벤트 (landing, start, step, share_friend, parent_send, parent_open, pay_view)
  api/reports            입력 검증 → 서버에서 예측 → 저장 (complete 이벤트)
  api/orders             주문 생성, 금액은 서버 고정값 (checkout 이벤트)
lib/
  predict.ts             예측 엔진 (중간부모키 + 성장도표 백분위, 사춘기 가중치)
  growth-chart.ts        성장도표 데이터 ← 출시 전 LMS 원본으로 교체할 파일
  toss.ts                결제 승인
  track.ts               ?v= / utm 첫 유입 기록, 세션 ID
supabase/migrations/     DB 스키마 (이미 naechoejongki 프로젝트에 적용됨)
```

## 구조 한 줄 요약

브라우저 → Next.js(Vercel, 비밀 키 없음) → Supabase Edge Function `nk-api`(비밀 키는 여기만) → DB.
`supabase/functions/nk-api/` 에 예측 코드(`predict.ts`, `growth-chart.ts`, LMS json) 사본이 있다. `lib/` 쪽을 고치면 두 곳 다 맞춰서 함수를 다시 배포한다.

## 배포

1. GitHub `main`에 push하면 Vercel이 자동 배포한다. Vercel 환경변수는 없어도 된다.
2. 결제·본인인증 키는 Supabase 대시보드 → Edge Functions → `nk-api` → **Secrets**에 넣는다 (`.env.example` 맨 위 목록).
3. `/admin` 비밀번호는 DB `app_config.admin_password_sha256`에 저장돼 있다 (sha256("nk-admin:" + 비밀번호)).
4. 쇼츠 고정댓글·설명란에 `https://도메인/?v=s01` 처럼 영상마다 코드만 바꿔 붙인다.

## 유입 추적 규칙

- 영상 코드는 `?v=` → `utm_content` → `utm_campaign` 순으로 잡는다. 첫 유입이 기기에 남아서, 나중에 직접 들어와도 처음 본 영상으로 집계된다.
- 리포트·주문에 그 코드가 같이 저장된다. 부모가 다른 기기에서 결제해도 자녀가 처음 본 영상으로 매출이 잡힌다.
- 집계는 세션(기기) 단위로 중복을 뺀다. 부모 열람·결제 진입은 리포트 단위다.

## 결제 흐름

부모 링크(`/r/{id}?p=1`) → 결제 버튼 → `/api/orders`가 4,900원 주문 생성 → 토스 위젯 → `/pay/success`에서
DB 주문 금액과 쿼리스트링 금액이 같은지 확인 → 토스 승인 API (Idempotency-Key = orderId) → 리포트 `paid = true`.
금액은 `lib/server.ts`의 `PRODUCTS`에서만 바꾼다.

## 법무·운영 장치 (들어가 있음)

- `/terms` 이용약관, `/privacy` 개인정보처리방침, `/refund` 환불정책. 모든 화면 하단에 링크와 사업자 정보.
- 사업자 정보는 `NEXT_PUBLIC_BIZ_*` 환경변수로 채운다. 비어 있으면 '등록 예정'으로 나온다.
- 결제 화면에 디지털 콘텐츠 청약철회 제한 고지 (전자상거래법 제17조 제2항 제5호).
- 만 14세 미만: 포트원 키 3개가 있으면 **보호자 휴대폰 본인인증**(만 19세 이상 확인, 서버에서 포트원 API로 재검증), 없으면 체크박스. 이름·전화번호·CI는 저장하지 않는다.
- 리포트 화면 하단 '이 리포트 삭제하기': 만든 기기에서만 삭제 가능. 결제 기록은 5년 보관.
- Supabase `pg_cron` 작업 `nk_purge_expired`: 매일 04시(KST) 180일 지난 리포트, 400일 지난 이벤트, 180일 지난 인증 기록 삭제.
- Vercel 함수 리전 서울(`vercel.json` → `icn1`).

## 성장도표 원본 넣기

지금은 근사값으로 계산한다 (`lib/growth-chart.ts`의 `CHART_SOURCE`가 '근사값'). 공식 표로 바꾸려면:

1. 질병관리청 국민건강영양조사 사이트 → 성장도표(knhanes.kdca.go.kr/knhanes/grtcht/main.do)에서 2017 소아청소년 성장도표 자료를 받는다.
2. **연령별 신장** LMS 표를 엑셀에서 열어 `성별, 개월, L, M, S` 열만 남기고 CSV(UTF-8)로 저장한다.
3. `npm run import:chart -- ./신장LMS.csv` → `lib/growth-chart-lms.json` 생성 → 커밋·푸시하면 자동으로 공식 표를 쓴다.

## 라이브 결제 전 남은 일

- 사업자등록·통신판매업 신고 후 `NEXT_PUBLIC_BIZ_*` 채우기
- 토스 라이브 키 심사 (약관·환불정책·사업자 정보는 준비됨)
- 포트원 본인인증 채널 계약 후 키 3개 넣기
- 약관·방침 문구 변호사 1회 검토
- 문구 점검: "키 크는 / 성장판 자극 / ○cm 보장 / 저신장 진단 / 성장호르몬 대체 / 치료" 금지. 지금 코드엔 없다.

## 의도적으로 뺀 것 (기획서 MVP 범위)

월 구독, 습관 트래커, 월별 재예측, 커뮤니티, 앱 출시, 공유 카드 이미지 자동 생성.
