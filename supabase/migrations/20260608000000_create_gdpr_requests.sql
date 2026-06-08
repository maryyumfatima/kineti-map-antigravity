-- Migration: Create gdpr_requests table
-- Run with: supabase db push or supabase migration up

create table if not exists public.gdpr_requests (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text not null,
  request_type text not null check (request_type in ('access', 'delete', 'correct', 'export')),
  details     text,
  status      text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'rejected')),
  created_at  timestamptz not null default now()
);

-- Enable RLS
alter table public.gdpr_requests enable row level security;

-- Allow anyone (including anonymous visitors) to INSERT a request
create policy "Anyone can submit a GDPR request"
  on public.gdpr_requests
  for insert
  to anon, authenticated
  with check (true);

-- Only authenticated staff can read/update requests (handled via dashboard, not this page)
create policy "Authenticated users can read GDPR requests"
  on public.gdpr_requests
  for select
  to authenticated
  using (true);

create policy "Authenticated users can update GDPR requests"
  on public.gdpr_requests
  for update
  to authenticated
  using (true)
  with check (true);
