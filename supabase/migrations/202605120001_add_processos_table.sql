create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  data_mapeamento date not null default current_date,
  analista text not null default '',
  nome text not null default '',
  classificacao text not null default 'Negócio',
  area text not null default '',
  responsavel text not null default '',
  entrevistados text not null default '',
  objetivo text not null default '',
  cliente_processo text not null default '',
  areas_envolvidas text not null default '',
  gatilho text not null default '',
  entradas jsonb not null default '[]'::jsonb,
  etapas jsonb not null default '[]'::jsonb,
  decisoes text not null default '',
  saidas jsonb not null default '[]'::jsonb,
  recursos text not null default '',
  problemas jsonb not null default '{"retrabalho": false, "atrasos": false, "erros": false, "dependencia": false, "faltaPadrao": false}'::jsonb,
  problemas_texto text not null default '',
  riscos_texto text not null default '',
  riscos jsonb not null default '[]'::jsonb,
  indicadores jsonb not null default '[]'::jsonb,
  oportunidades_melhoria text not null default '',
  plano_acao jsonb not null default '[]'::jsonb,
  bpmn_as_is text not null default '',
  bpmn_to_be text not null default '',
  diagnostico jsonb,
  interview_messages jsonb not null default '[]'::jsonb,
  interview_session_id text,
  status text not null default 'Rascunho',
  criticidade text not null default 'Baixa',
  mapa_revisao text not null default 'Rev.00',
  mapa_aprovado_em timestamptz,
  published_at timestamptz,
  obsolete_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_processos_company_id on public.processos(company_id);
create index if not exists idx_processos_status on public.processos(status);
create index if not exists idx_processos_nome on public.processos(nome);

alter table public.processos enable row level security;

create or replace function public.set_processos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists processos_set_updated_at on public.processos;
create trigger processos_set_updated_at
before update on public.processos
for each row
execute function public.set_processos_updated_at();

drop policy if exists processos_select_policy on public.processos;
drop policy if exists processos_insert_policy on public.processos;
drop policy if exists processos_update_policy on public.processos;
drop policy if exists processos_delete_policy on public.processos;

create policy processos_select_policy
  on public.processos
  for select
  using (company_id in (select public.user_empresa_ids()));

create policy processos_insert_policy
  on public.processos
  for insert
  with check (
    company_id in (select public.user_empresa_ids())
    and created_by = auth.uid()
  );

create policy processos_update_policy
  on public.processos
  for update
  using (company_id in (select public.user_empresa_ids()))
  with check (
    company_id in (select public.user_empresa_ids())
    and updated_by = auth.uid()
  );

create policy processos_delete_policy
  on public.processos
  for delete
  using (company_id in (select public.user_empresa_ids()));
