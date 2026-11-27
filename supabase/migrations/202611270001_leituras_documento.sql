-- Leitura confirmada dos procedimentos distribuídos. Cada pessoa que recebe o documento ganha um
-- link próprio (token) que abre o documento sem login e registra "Li e entendi" com data e hora.
-- Uma linha por pessoa e revisão: uma nova revisão pede nova leitura.
-- Ver: membros da empresa. Distribuir (criar, apagar): Consultor e Gestor. Abrir e confirmar pelo
-- link: qualquer pessoa com o token, pelas funções documento_para_leitura e confirmar_leitura.
-- Depende de user_empresa_ids(), user_can_manage_company(), generated_documents e pessoas.
-- Pode rodar mais de uma vez.
begin;

create table if not exists public.leituras_documento (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  document_id uuid not null references public.generated_documents(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  revisao text not null,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  enviado_em timestamptz not null default now(),
  confirmado_em timestamptz
);
create unique index if not exists leituras_documento_unica on public.leituras_documento (document_id, pessoa_id, revisao);
create index if not exists leituras_documento_company_idx on public.leituras_documento (company_id);

alter table public.leituras_documento enable row level security;

drop policy if exists leituras_documento_select on public.leituras_documento;
create policy leituras_documento_select on public.leituras_documento for select to authenticated
  using (company_id in (select public.user_empresa_ids()));

drop policy if exists leituras_documento_insert on public.leituras_documento;
create policy leituras_documento_insert on public.leituras_documento for insert to authenticated
  with check (public.user_can_manage_company(company_id));

drop policy if exists leituras_documento_delete on public.leituras_documento;
create policy leituras_documento_delete on public.leituras_documento for delete to authenticated
  using (public.user_can_manage_company(company_id));

grant select, insert, delete on public.leituras_documento to authenticated;

-- Abre o documento pelo link, sem login. Só devolve o que a página de leitura mostra.
create or replace function public.documento_para_leitura(_token text)
returns table (
  pessoa_nome text,
  titulo text,
  codigo text,
  revisao text,
  conteudo text,
  elaborado_por text,
  aprovado_por text,
  aprovado_em timestamptz,
  confirmado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.nome, d.title, d.code, d.revision, d.content_markdown, d.document_owner, d.approver_name, d.approved_at, l.confirmado_em
  from public.leituras_documento l
  join public.pessoas p on p.id = l.pessoa_id
  join public.generated_documents d on d.id = l.document_id
  where l.token = _token
$$;
revoke all on function public.documento_para_leitura(text) from public;
grant execute on function public.documento_para_leitura(text) to anon, authenticated;

-- Registra "Li e entendi". Confirmar de novo mantém a primeira data.
create or replace function public.confirmar_leitura(_token text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  _quando timestamptz;
begin
  update public.leituras_documento
     set confirmado_em = coalesce(confirmado_em, now())
   where token = _token
  returning confirmado_em into _quando;
  if _quando is null then
    raise exception 'Link de leitura não encontrado.' using errcode = 'P0002';
  end if;
  return _quando;
end;
$$;
revoke all on function public.confirmar_leitura(text) from public;
grant execute on function public.confirmar_leitura(text) to anon, authenticated;

commit;
