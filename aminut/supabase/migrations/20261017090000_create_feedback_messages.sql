create table public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('bug', 'privacy', 'other')),
  message text not null,
  contact_email text
);

comment on table public.feedback_messages is 'Contact-form submissions (bug reports, privacy requests, other) from the public site.';

alter table public.feedback_messages enable row level security;

-- Write-only for anon: the form needs to insert, but nothing on the client ever needs
-- to read these back, so there's no select policy at all (unlike reports, which are
-- meant to be publicly readable by id, these are private correspondence).
create policy "anon can submit feedback"
  on public.feedback_messages for insert
  to anon
  with check (true);
