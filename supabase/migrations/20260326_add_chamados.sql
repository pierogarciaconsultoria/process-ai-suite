create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  titulo text not null,
  descricao text not null,
  anexo_url text,
  status text not null default 'aberto' check (status in ('aberto','em_andamento','resolvido','fechado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chamados_empresa_created on public.chamados (empresa_id, created_at desc);

alter table public.chamados enable row level security;

create policy if not exists chamados_select_by_company
  on public.chamados
  for select
  using (
    empresa_id in (select empresa_id from public.membros where user_id = auth.uid())
  );

create policy if not exists chamados_insert_by_member
  on public.chamados
  for insert
  with check (
    empresa_id in (select empresa_id from public.membros where user_id = auth.uid())
  );

create policy if not exists chamados_update_by_company
  on public.chamados
  for update
  using (
    empresa_id in (select empresa_id from public.membros where user_id = auth.uid())
  )
  with check (
    empresa_id in (select empresa_id from public.membros where user_id = auth.uid())
  );

create table if not exists public.chamado_mensagens (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conteudo text not null,
  anexo_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_chamado_mensagens_chamado_created on public.chamado_mensagens (chamado_id, created_at asc);
create index if not exists idx_chamado_mensagens_empresa_created on public.chamado_mensagens (empresa_id, created_at desc);

alter table public.chamado_mensagens enable row level security;

create policy if not exists chamado_mensagens_select_by_company
  on public.chamado_mensagens
  for select
  using (
    empresa_id in (select empresa_id from public.membros where user_id = auth.uid())
  );

create policy if not exists chamado_mensagens_insert_by_member
  on public.chamado_mensagens
  for insert
  with check (
    empresa_id in (select empresa_id from public.membros where user_id = auth.uid())
  );

-- Storage bucket for attachments
insert into storage.buckets (id, name, public)
values ('chamados', 'chamados', false)
on conflict (id) do nothing;

-- Allow members of the company to read/write files under folder <empresa_id>/...
create policy if not exists "chamados objects read by company members"
  on storage.objects for select
  using (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select empresa_id::text from public.membros where user_id = auth.uid())
  );

create policy if not exists "chamados objects insert by company members"
  on storage.objects for insert
  with check (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select empresa_id::text from public.membros where user_id = auth.uid())
  );

create policy if not exists "chamados objects update by company members"
  on storage.objects for update
  using (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select empresa_id::text from public.membros where user_id = auth.uid())
  )
  with check (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select empresa_id::text from public.membros where user_id = auth.uid())
  );

