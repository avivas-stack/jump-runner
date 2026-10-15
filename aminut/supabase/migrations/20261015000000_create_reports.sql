create table public.reports (
  id uuid primary key,
  created_at timestamptz not null default now(),
  report jsonb not null
);

comment on table public.reports is 'Persisted "אמינות" fact-check reports, keyed by their own report id, for shareable permalinks.';

alter table public.reports enable row level security;

-- Scoped for the publishable (anon) key, used only server-side by this app's own
-- Route Handlers (never shipped to the browser). Reports are meant to be publicly
-- shareable by id anyway, so a broad select is intentional; insert is allowed since
-- only our backend holds this key, but update/delete are deliberately left undefined
-- (denied by default under RLS) so a leaked key can create/read rows but never
-- tamper with or remove existing ones.
create policy "anon can insert reports"
  on public.reports for insert
  to anon
  with check (true);

create policy "anon can read reports by id"
  on public.reports for select
  to anon
  using (true);
