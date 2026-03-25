create extension if not exists "pgcrypto";

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text,
  tamanho text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists empresas_owner_nome_unique on public.empresas (owner_id, nome);

alter table public.empresas enable row level security;

create policy if not exists empresas_select_by_membership
  on public.empresas
  for select
  using (
    id in (
      select empresa_id from public.membros where user_id = auth.uid()
    )
    or owner_id = auth.uid()
  );

create policy if not exists empresas_insert_by_owner
  on public.empresas
  for insert
  with check (owner_id = auth.uid());

create policy if not exists empresas_update_by_owner
  on public.empresas
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy if not exists empresas_delete_by_owner
  on public.empresas
  for delete
  using (owner_id = auth.uid());

create table if not exists public.membros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  perfil text not null check (perfil in ('admin','gestor','analista')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, empresa_id)
);

alter table public.membros enable row level security;

create policy if not exists membros_select_self
  on public.membros
  for select
  using (user_id = auth.uid());

create policy if not exists membros_insert_by_owner
  on public.membros
  for insert
  with check (
    user_id = auth.uid()
    or invited_by = auth.uid()
  );

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  email text not null,
  perfil text not null check (perfil in ('admin','gestor','analista')),
  status text not null check (status in ('pending','accepted','revoked')),
  token text,
  created_at timestamptz not null default now()
);

alter table public.convites enable row level security;

create policy if not exists convites_select_by_membership
  on public.convites
  for select
  using (
    empresa_id in (
      select empresa_id from public.membros where user_id = auth.uid()
    )
  );
