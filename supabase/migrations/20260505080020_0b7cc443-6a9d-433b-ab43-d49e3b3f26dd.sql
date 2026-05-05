create table public.narrative_signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id text not null,
  run_started_at timestamptz not null,
  ticker text not null,
  name text not null,
  layer text,
  source_table text not null check (source_table in ('WATCHLIST','REJECTED')),
  signal_class text not null check (signal_class in ('GOVT_DESIGNATION','HYPERSCALER_QUAL','ETF_INCLUSION','GICS','SELLSIDE','NEWS_CATALYST')),
  strength text not null check (strength in ('HIGH','MEDIUM','LOW')),
  matched_keywords text,
  headline text,
  url text,
  snippet text,
  published_date date,
  review_status text default 'NEW' check (review_status in ('NEW','REVIEWED','DEPLOYED','DISMISSED','STALE')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by text
);

create index idx_narsig_ticker_class_recent on public.narrative_signals (ticker, signal_class, created_at desc);
create index idx_narsig_run_id on public.narrative_signals (run_id);
create index idx_narsig_review_status on public.narrative_signals (review_status) where review_status = 'NEW';
create index idx_narsig_strength_recent on public.narrative_signals (strength, created_at desc);

alter table public.narrative_signals enable row level security;

create policy "service role full access" on public.narrative_signals for all using (auth.role() = 'service_role');
create policy "Authenticated users can read narrative_signals" on public.narrative_signals for select to authenticated using (true);
create policy "Anon can read narrative_signals" on public.narrative_signals for select to anon using (true);