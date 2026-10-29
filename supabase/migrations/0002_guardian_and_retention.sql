-- 결제 기록은 리포트를 지워도 남긴다 (전자상거래법상 대금결제 기록 5년)
alter table public.orders alter column report_id drop not null;
alter table public.orders drop constraint orders_report_id_fkey;
alter table public.orders add constraint orders_report_id_fkey
  foreign key (report_id) references public.reports(id) on delete set null;

-- 보호자 본인인증 결과 (이름·전화번호·CI는 저장하지 않는다)
create table public.guardian_verifications (
  id            text primary key,          -- 포트원 identityVerificationId
  session_id    text not null,
  adult         boolean not null,
  verified_at   timestamptz not null default now(),
  used_report_id uuid references public.reports(id) on delete set null
);
alter table public.guardian_verifications enable row level security;
revoke all on public.guardian_verifications from anon, authenticated;

alter table public.reports add column guardian_verification_id text references public.guardian_verifications(id) on delete set null;

-- 보관기간 지난 데이터 자동 삭제 (매일 새벽 4시 KST = 19:00 UTC)
create extension if not exists pg_cron;
select cron.schedule('nk_purge_expired', '0 19 * * *', $$
  delete from public.reports where expires_at < now();
  delete from public.events where created_at < now() - interval '400 days';
  delete from public.guardian_verifications where verified_at < now() - interval '180 days';
$$);
