-- Replaces the broad "anon can select any row" policy with a narrow SECURITY DEFINER
-- function that only ever returns a single report by its exact id. Previously, a leaked
-- anon key alone (without needing to know any specific report id) could dump the entire
-- table via a plain `select *` — reports can contain user-submitted claim text naming
-- real people, so that's a meaningfully worse exposure than "guess the UUID."
drop policy if exists "anon can read reports by id" on public.reports;

create or replace function public.get_report_by_id(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select report from public.reports where id = p_id;
$$;

revoke all on function public.get_report_by_id(uuid) from public;
grant execute on function public.get_report_by_id(uuid) to anon;
