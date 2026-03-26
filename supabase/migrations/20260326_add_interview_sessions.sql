create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('auto','manual')),
  messages jsonb not null,
  form_snapshot jsonb not null default '{}'::jsonb,
  progress int not null default 0,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.interview_sessions enable row level security;

create policy if not exists interview_sessions_select_by_user_or_membership
  on public.interview_sessions
  for select
  using (
    user_id = auth.uid()
    or empresa_id in (select empresa_id from public.membros where user_id = auth.uid())
  );

create policy if not exists interview_sessions_insert_by_user
  on public.interview_sessions
  for insert
  with check (user_id = auth.uid());

create policy if not exists interview_sessions_update_by_user
  on public.interview_sessions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists interview_sessions_delete_by_user
  on public.interview_sessions
  for delete
  using (user_id = auth.uid());
