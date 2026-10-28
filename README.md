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

## 배포 (Vercel, 약 10분)

1. 이 폴더를 GitHub 저장소로 올린다.
2. Vercel → New Project → 저장소 선택. 프레임워크는 Next.js로 자동 인식된다.
3. Environment Variables에 `.env.example` 항목을 채운다.
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase 대시보드 → naechoejongki → Project Settings → API Keys → `service_role`
   - `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`: 토스페이먼츠 개발자센터 → API 키 → **결제위젯 연동 키** (`test_gck_…`, `test_gsk_…`)
   - `ADMIN_KEY`: 16자 이상 아무 문자열
   - `NEXT_PUBLIC_SITE_URL`: 첫 배포 후 나온 도메인을 넣고 한 번 더 배포
4. 배포 후 `/admin` 에서 ADMIN_KEY로 로그인 → 영상 코드(s01, s02…) 등록.
5. 쇼츠 고정댓글·설명란에 `https://도메인/?v=s01` 처럼 영상마다 코드만 바꿔 붙인다.
6. 하루 한 번 각 영상 조회수를 `/admin`에 입력하면 `1만 뷰당 결제`가 계산된다.

로컬 실행: `cp .env.example .env.local` 후 값 채우고 `npm install && npm run dev`.
예측 엔진만 확인: `npm run test:predict`.

## 유입 추적 규칙

- 영상 코드는 `?v=` → `utm_content` → `utm_campaign` 순으로 잡는다. 첫 유입이 기기에 남아서, 나중에 직접 들어와도 처음 본 영상으로 집계된다.
- 리포트·주문에 그 코드가 같이 저장된다. 부모가 다른 기기에서 결제해도 자녀가 처음 본 영상으로 매출이 잡힌다.
- 집계는 세션(기기) 단위로 중복을 뺀다. 부모 열람·결제 진입은 리포트 단위다.

## 결제 흐름

부모 링크(`/r/{id}?p=1`) → 결제 버튼 → `/api/orders`가 4,900원 주문 생성 → 토스 위젯 → `/pay/success`에서
DB 주문 금액과 쿼리스트링 금액이 같은지 확인 → 토스 승인 API (Idempotency-Key = orderId) → 리포트 `paid = true`.
금액은 `lib/server.ts`의 `PRODUCTS`에서만 바꾼다.

## 실결제(라이브) 전환 전에 할 일

- **토스 라이브 키 심사**: 사업자등록, 사이트 하단 사업자 정보(상호·대표자·사업자번호·통신판매업 신고번호·연락처), 이용약관, 개인정보처리방침, **환불 정책** 페이지가 있어야 통과한다. 지금은 없다.
- **14세 미만 보호자 동의**: 지금은 체크박스다. 개인정보보호법 제22조의2 기준을 맞추려면 보호자 휴대폰 본인인증(포트원 등)으로 바꿔야 한다.
- **성장도표 데이터**: `lib/growth-chart.ts`는 근사값이다. 질병관리청 2017 성장도표 LMS 원본(월령별)으로 교체한다.
- **개인정보처리방침**: 생년월·키·몸무게·부모 키를 180일 보관한다고 명시한다 (`reports.expires_at`). 만료 데이터 삭제 작업(Supabase cron)도 붙인다.
- 문구 점검: "키 크는 / 성장판 자극 / ○cm 보장 / 저신장 진단 / 성장호르몬 대체 / 치료" 금지. 지금 코드엔 없다.

## 의도적으로 뺀 것 (기획서 MVP 범위)

월 구독, 습관 트래커, 월별 재예측, 커뮤니티, 앱 출시, 공유 카드 이미지 자동 생성.
