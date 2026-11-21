-- Normas e requisitos que a empresa segue (ISO, contratos de cliente, legislação), usados pelo Peter
-- na entrevista, no diagnóstico, no plano de melhoria e nos documentos. Guarda só o texto: quando vem
-- de PDF, o texto é extraído no navegador e o arquivo não é armazenado.
-- Ler: qualquer membro da empresa. Cadastrar, editar e excluir: Consultor e Gestor
-- (user_can_manage_company). Depende de user_empresa_ids() e user_can_manage_company(). Pode rodar
-- mais de uma vez.
begin;

create table if not exists public.normas_empresa (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null check (btrim(nome) <> '' and char_length(nome) <= 200),
  requisitos text not null check (btrim(requisitos) <> '' and char_length(requisitos) <= 100000),
  origem text not null default 'texto' check (origem in ('texto', 'pdf')),
  arquivo_nome text,
  ativa boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists normas_empresa_company_idx on public.normas_empresa (company_id);

create or replace function public.normas_empresa_atualizada_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists normas_empresa_atualizada_em on public.normas_empresa;
create trigger normas_empresa_atualizada_em before update on public.normas_empresa
for each row execute function public.normas_empresa_atualizada_em();

alter table public.normas_empresa enable row level security;

drop policy if exists normas_empresa_select on public.normas_empresa;
create policy normas_empresa_select
  on public.normas_empresa for select to authenticated
  using (company_id in (select public.user_empresa_ids()));

drop policy if exists normas_empresa_insert on public.normas_empresa;
create policy normas_empresa_insert
  on public.normas_empresa for insert to authenticated
  with check (public.user_can_manage_company(company_id));

drop policy if exists normas_empresa_update on public.normas_empresa;
create policy normas_empresa_update
  on public.normas_empresa for update to authenticated
  using (public.user_can_manage_company(company_id))
  with check (public.user_can_manage_company(company_id));

drop policy if exists normas_empresa_delete on public.normas_empresa;
create policy normas_empresa_delete
  on public.normas_empresa for delete to authenticated
  using (public.user_can_manage_company(company_id));

grant select, insert, update, delete on public.normas_empresa to authenticated;

commit;
