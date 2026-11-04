-- Plano de Ação: as ações 5W2H acompanhadas até a conclusão (ISO 9001, 6.1, 6.2 e 10).
-- Nascem do plano de melhoria do processo (origem 'plano_processo') ou são criadas à mão;
-- riscos, não conformidades, auditorias e análise crítica usarão as demais origens.
-- Pode rodar mais de uma vez.
begin;

create table if not exists public.acoes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  processo_id uuid references public.processos(id) on delete set null,
  origem text not null default 'manual'
    check (origem in ('manual', 'plano_processo', 'risco', 'indicador', 'nao_conformidade', 'auditoria', 'analise_critica')),
  -- Identifica a ação de origem (ex.: a linha do 5W2H) para não importá-la duas vezes.
  chave_origem text,
  oque text not null check (btrim(oque) <> ''),
  porque text not null default '',
  onde text not null default '',
  como text not null default '',
  quem text not null default '',
  prazo date,
  -- Prazo como foi escrito no plano, quando não é uma data ("[a definir]", "1º trimestre").
  quando_texto text not null default '',
  custo text not null default '',
  status text not null default 'A fazer'
    check (status in ('A fazer', 'Em andamento', 'Concluída', 'Cancelada')),
  concluida_em timestamptz,
  -- Resultado obtido e verificação de eficácia (ISO 9001, 10.2.1 d).
  resultado text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists acoes_origem_unica
  on public.acoes (company_id, origem, chave_origem)
  where chave_origem is not null;
create index if not exists acoes_company_status_idx on public.acoes (company_id, status);
create index if not exists acoes_processo_idx on public.acoes (processo_id);

create or replace function public.acoes_antes_de_gravar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'Concluída' and (tg_op = 'INSERT' or old.status is distinct from 'Concluída') then
    new.concluida_em := coalesce(new.concluida_em, now());
  elsif new.status <> 'Concluída' then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists acoes_antes_de_gravar on public.acoes;
create trigger acoes_antes_de_gravar
before insert or update on public.acoes
for each row execute function public.acoes_antes_de_gravar();

alter table public.acoes enable row level security;

drop policy if exists acoes_select_by_company on public.acoes;
create policy acoes_select_by_company
  on public.acoes for select to authenticated
  using (company_id in (select public.user_empresa_ids()));

-- O processo vinculado precisa ser da mesma empresa.
drop policy if exists acoes_insert_by_company on public.acoes;
create policy acoes_insert_by_company
  on public.acoes for insert to authenticated
  with check (
    company_id in (select public.user_empresa_ids())
    and created_by = auth.uid()
    and (processo_id is null or exists (select 1 from public.processos p where p.id = processo_id and p.company_id = acoes.company_id))
  );

drop policy if exists acoes_update_by_company on public.acoes;
create policy acoes_update_by_company
  on public.acoes for update to authenticated
  using (company_id in (select public.user_empresa_ids()))
  with check (
    company_id in (select public.user_empresa_ids())
    and updated_by = auth.uid()
    and (processo_id is null or exists (select 1 from public.processos p where p.id = processo_id and p.company_id = acoes.company_id))
  );

drop policy if exists acoes_delete_by_company on public.acoes;
create policy acoes_delete_by_company
  on public.acoes for delete to authenticated
  using (company_id in (select public.user_empresa_ids()));

grant select, insert, update, delete on public.acoes to authenticated;

commit;

notify pgrst, 'reload schema';
