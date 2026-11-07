-- Padrão de procedimento do Peter: estrutura do PR (PA), estrutura da IT e manual de escrita.
-- company_id nulo = padrão da plataforma (vale para todas as empresas); com company_id = padrão
-- próprio daquela empresa, que prevalece sobre o da plataforma. O conteúdo fica no banco, e não
-- no código, porque o repositório é público e o manual é material da consultoria.
-- Leitura: quem participa da empresa (e todos, para o padrão da plataforma). Escrita: super admin.
-- Pode rodar mais de uma vez.
begin;

create table if not exists public.padroes_documento (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('estrutura_pr', 'estrutura_it', 'manual_escrita')),
  conteudo text not null default '' check (char_length(conteudo) <= 60000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);

-- Um registro por tipo na plataforma e um por tipo em cada empresa.
create unique index if not exists padroes_documento_plataforma_unico
  on public.padroes_documento (tipo) where company_id is null;
create unique index if not exists padroes_documento_empresa_unico
  on public.padroes_documento (company_id, tipo) where company_id is not null;

alter table public.padroes_documento enable row level security;

create or replace function public.padroes_documento_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists padroes_documento_touch on public.padroes_documento;
create trigger padroes_documento_touch
before insert or update on public.padroes_documento
for each row execute function public.padroes_documento_touch();

drop policy if exists padroes_documento_select on public.padroes_documento;
create policy padroes_documento_select
  on public.padroes_documento for select to authenticated
  using (company_id is null or company_id in (select public.user_empresa_ids()) or public.is_super_admin());

drop policy if exists padroes_documento_insert on public.padroes_documento;
create policy padroes_documento_insert
  on public.padroes_documento for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists padroes_documento_update on public.padroes_documento;
create policy padroes_documento_update
  on public.padroes_documento for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists padroes_documento_delete on public.padroes_documento;
create policy padroes_documento_delete
  on public.padroes_documento for delete to authenticated
  using (public.is_super_admin());

grant select, insert, update, delete on public.padroes_documento to authenticated;

commit;

notify pgrst, 'reload schema';
