-- Estrutura da empresa: setores, cargos e pessoas. Os documentos passam a apontar para cargos e
-- setores; as pessoas ocupam um cargo e podem ou não ter login (user_id). Leitores de procedimentos,
-- em geral, não têm login.
-- Ler: qualquer membro da empresa. Cadastrar, editar e excluir: Consultor e Gestor
-- (user_can_manage_company). Depende de user_empresa_ids() e user_can_manage_company(). Pode rodar
-- mais de uma vez.
begin;

create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null check (btrim(nome) <> '' and char_length(nome) <= 120),
  created_at timestamptz not null default now()
);
create unique index if not exists setores_nome_unico on public.setores (company_id, lower(btrim(nome)));

create table if not exists public.cargos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  setor_id uuid references public.setores(id) on delete set null,
  nome text not null check (btrim(nome) <> '' and char_length(nome) <= 120),
  created_at timestamptz not null default now()
);
create unique index if not exists cargos_nome_unico on public.cargos (company_id, lower(btrim(nome)));

create table if not exists public.pessoas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  cargo_id uuid references public.cargos(id) on delete set null,
  nome text not null check (btrim(nome) <> '' and char_length(nome) <= 160),
  email text check (email is null or char_length(email) <= 254),
  user_id uuid references auth.users(id) on delete set null,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists pessoas_company_idx on public.pessoas (company_id);

do $$
declare
  tabela text;
begin
  foreach tabela in array array['setores', 'cargos', 'pessoas'] loop
    execute format('alter table public.%I enable row level security', tabela);

    execute format('drop policy if exists %I on public.%I', tabela || '_select', tabela);
    execute format('create policy %I on public.%I for select to authenticated using (company_id in (select public.user_empresa_ids()))', tabela || '_select', tabela);

    execute format('drop policy if exists %I on public.%I', tabela || '_insert', tabela);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.user_can_manage_company(company_id))', tabela || '_insert', tabela);

    execute format('drop policy if exists %I on public.%I', tabela || '_update', tabela);
    execute format('create policy %I on public.%I for update to authenticated using (public.user_can_manage_company(company_id)) with check (public.user_can_manage_company(company_id))', tabela || '_update', tabela);

    execute format('drop policy if exists %I on public.%I', tabela || '_delete', tabela);
    execute format('create policy %I on public.%I for delete to authenticated using (public.user_can_manage_company(company_id))', tabela || '_delete', tabela);

    execute format('grant select, insert, update, delete on public.%I to authenticated', tabela);
  end loop;
end $$;

commit;
