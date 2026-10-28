-- 내최종키 초기 스키마
-- 모든 읽기/쓰기는 Next.js 서버(service role)에서만 한다. anon/authenticated에는 아무 권한도 주지 않는다.

create extension if not exists pgcrypto;

-- 쇼츠 영상 목록 (조회수는 관리자 화면에서 수동 입력)
create table public.videos (
  code        text primary key,               -- 링크의 ?v= 값 (예: s01)
  title       text not null default '',
  url         text not null default '',
  platform    text not null default 'youtube', -- youtube | instagram | tiktok | etc
  views       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 퍼널 이벤트
create table public.events (
  id          bigint generated always as identity primary key,
  session_id  text not null,
  src         text not null default 'direct',
  name        text not null check (name in (
                'landing','start','step','complete','share_friend',
                'parent_send','parent_open','pay_view','checkout','paid','pay_fail')),
  report_id   uuid,
  props       jsonb not null default '{}'::jsonb,
  utm         jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index events_src_name_idx on public.events (src, name);
create index events_created_idx on public.events (created_at desc);

-- 예측 리포트 (이름·연락처는 받지 않는다)
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  session_id    text not null,
  src           text not null default 'direct',
  sex           text not null check (sex in ('m','f')),
  birth_ym      text not null,                -- 'YYYY-MM'
  under14_consent boolean not null default false,
  inputs        jsonb not null,               -- 키·몸무게·부모키·작년키·사춘기·습관
  result        jsonb not null,               -- 서버 계산 결과 전체
  paid          boolean not null default false,
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '180 days')
);
create index reports_src_idx on public.reports (src);

-- 주문 (토스페이먼츠)
create table public.orders (
  order_id      text primary key,             -- 6~64자, 영문/숫자/-/_
  report_id     uuid not null references public.reports(id) on delete cascade,
  src           text not null default 'direct',
  product       text not null default 'report_single',
  amount        integer not null check (amount > 0),
  status        text not null default 'ready' check (status in ('ready','paid','failed','canceled')),
  payment_key   text unique,
  method        text,
  approved_at   timestamptz,
  fail_code     text,
  raw           jsonb,
  created_at    timestamptz not null default now()
);
create index orders_report_idx on public.orders (report_id);

alter table public.videos  enable row level security;
alter table public.events  enable row level security;
alter table public.reports enable row level security;
alter table public.orders  enable row level security;
-- 정책을 만들지 않으므로 anon/authenticated는 전부 거부된다.
revoke all on public.videos, public.events, public.reports, public.orders from anon, authenticated;

-- 영상별 퍼널 (세션 단위 중복 제거)
create view public.funnel_by_src with (security_invoker = true) as
with s as (
  select src,
    count(distinct session_id) filter (where name = 'landing')      as landing,
    count(distinct session_id) filter (where name = 'start')        as started,
    count(distinct session_id) filter (where name = 'complete')     as completed,
    count(distinct session_id) filter (where name = 'share_friend') as shared,
    count(distinct session_id) filter (where name = 'parent_send')  as parent_sent,
    count(distinct report_id)  filter (where name = 'parent_open')  as parent_opened,
    count(distinct report_id)  filter (where name = 'checkout')     as checkout
  from public.events group by src
), p as (
  select src, count(*) as paid, coalesce(sum(amount),0) as revenue
  from public.orders where status = 'paid' group by src
)
select coalesce(s.src, p.src) as src,
  v.title, coalesce(v.views,0) as views,
  coalesce(s.landing,0) as landing, coalesce(s.started,0) as started,
  coalesce(s.completed,0) as completed, coalesce(s.shared,0) as shared,
  coalesce(s.parent_sent,0) as parent_sent, coalesce(s.parent_opened,0) as parent_opened,
  coalesce(s.checkout,0) as checkout, coalesce(p.paid,0) as paid, coalesce(p.revenue,0) as revenue
from s full outer join p on p.src = s.src
left join public.videos v on v.code = coalesce(s.src, p.src);

revoke all on public.funnel_by_src from anon, authenticated;
