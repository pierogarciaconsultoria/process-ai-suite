create or replace function public.user_empresa_ids()
returns setof uuid
language sql
stable
as $$
  select e.id
  from public.empresas e
  where e.owner_id = auth.uid()
  union
  select m.empresa_id
  from public.membros m
  where m.user_id = auth.uid()
$$;

create table if not exists public.ai_configurations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  config_type text not null,
  content text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (company_id, config_type)
);

alter table public.ai_configurations enable row level security;

create or replace function public.set_ai_configurations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_configurations_set_updated_at on public.ai_configurations;
create trigger ai_configurations_set_updated_at
before update on public.ai_configurations
for each row
execute function public.set_ai_configurations_updated_at();

create policy if not exists ai_configurations_select_by_company
  on public.ai_configurations
  for select
  using (company_id in (select public.user_empresa_ids()));

create policy if not exists ai_configurations_insert_by_company
  on public.ai_configurations
  for insert
  with check (
    company_id in (select public.user_empresa_ids())
    and updated_by = auth.uid()
  );

create policy if not exists ai_configurations_update_by_company
  on public.ai_configurations
  for update
  using (company_id in (select public.user_empresa_ids()))
  with check (
    company_id in (select public.user_empresa_ids())
    and updated_by = auth.uid()
  );

create policy if not exists ai_configurations_delete_by_company
  on public.ai_configurations
  for delete
  using (company_id in (select public.user_empresa_ids()));
