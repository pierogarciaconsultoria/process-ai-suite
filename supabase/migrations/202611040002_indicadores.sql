-- Indicadores: o que é medido em cada processo e os resultados de cada período (ISO 9001, 9.1).
-- Nascem dos indicadores definidos no mapeamento do processo ou são criados à mão.
-- Pode rodar mais de uma vez.
begin;

create table if not exists public.indicadores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  processo_id uuid references public.processos(id) on delete set null,
  -- Identifica o indicador do mapeamento de origem para não importá-lo duas vezes.
  chave_origem text,
  nome text not null check (btrim(nome) <> ''),
  objetivo text not null default '',
  formula text not null default '',
  unidade text not null default '',
  -- 'maior': quanto maior, melhor (ex.: entregas no prazo); 'menor': quanto menor, melhor (ex.: reclamações).
  sentido text not null default 'maior' check (sentido in ('maior', 'menor')),
  meta numeric,
  -- Meta como foi escrita no mapeamento, quando não deu para ler um número ("reduzir pela metade").
  meta_texto text not null default '',
  periodicidade text not null default 'Mensal'
    check (periodicidade in ('Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual')),
  responsavel text not null default '',
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists indicadores_origem_unica
  on public.indicadores (company_id, chave_origem)
  where chave_origem is not null;
create index if not exists indicadores_company_idx on public.indicadores (company_id);
create index if not exists indicadores_processo_idx on public.indicadores (processo_id);

-- Um resultado por indicador e período; o período é o primeiro dia do mês medido.
create table if not exists public.indicador_medicoes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.empresas(id) on delete cascade,
  indicador_id uuid not null references public.indicadores(id) on delete cascade,
  periodo date not null check (extract(day from periodo) = 1),
  valor numeric not null,
  comentario text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (indicador_id, periodo)
);

create index if not exists indicador_medicoes_company_idx on public.indicador_medicoes (company_id, periodo);

create or replace function public.indicadores_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists indicadores_atualizado_em on public.indicadores;
create trigger indicadores_atualizado_em before update on public.indicadores
for each row execute function public.indicadores_atualizado_em();

drop trigger if exists indicador_medicoes_atualizado_em on public.indicador_medicoes;
create trigger indicador_medicoes_atualizado_em before update on public.indicador_medicoes
for each row execute function public.indicadores_atualizado_em();

alter table public.indicadores enable row level security;
alter table public.indicador_medicoes enable row level security;

drop policy if exists indicadores_select_by_company on public.indicadores;
create policy indicadores_select_by_company
  on public.indicadores for select to authenticated
  using (company_id in (select public.user_empresa_ids()));

-- O processo vinculado precisa ser da mesma empresa.
drop policy if exists indicadores_insert_by_company on public.indicadores;
create policy indicadores_insert_by_company
  on public.indicadores for insert to authenticated
  with check (
    company_id in (select public.user_empresa_ids())
    and created_by = auth.uid()
    and (processo_id is null or exists (select 1 from public.processos p where p.id = processo_id and p.company_id = indicadores.company_id))
  );

drop policy if exists indicadores_update_by_company on public.indicadores;
create policy indicadores_update_by_company
  on public.indicadores for update to authenticated
  using (company_id in (select public.user_empresa_ids()))
  with check (
    company_id in (select public.user_empresa_ids())
    and updated_by = auth.uid()
    and (processo_id is null or exists (select 1 from public.processos p where p.id = processo_id and p.company_id = indicadores.company_id))
  );

drop policy if exists indicadores_delete_by_company on public.indicadores;
create policy indicadores_delete_by_company
  on public.indicadores for delete to authenticated
  using (company_id in (select public.user_empresa_ids()));

-- A medição precisa ser de um indicador da mesma empresa.
drop policy if exists indicador_medicoes_select_by_company on public.indicador_medicoes;
create policy indicador_medicoes_select_by_company
  on public.indicador_medicoes for select to authenticated
  using (company_id in (select public.user_empresa_ids()));

drop policy if exists indicador_medicoes_insert_by_company on public.indicador_medicoes;
create policy indicador_medicoes_insert_by_company
  on public.indicador_medicoes for insert to authenticated
  with check (
    company_id in (select public.user_empresa_ids())
    and created_by = auth.uid()
    and exists (select 1 from public.indicadores i where i.id = indicador_id and i.company_id = indicador_medicoes.company_id)
  );

drop policy if exists indicador_medicoes_update_by_company on public.indicador_medicoes;
create policy indicador_medicoes_update_by_company
  on public.indicador_medicoes for update to authenticated
  using (company_id in (select public.user_empresa_ids()))
  with check (
    company_id in (select public.user_empresa_ids())
    and updated_by = auth.uid()
    and exists (select 1 from public.indicadores i where i.id = indicador_id and i.company_id = indicador_medicoes.company_id)
  );

drop policy if exists indicador_medicoes_delete_by_company on public.indicador_medicoes;
create policy indicador_medicoes_delete_by_company
  on public.indicador_medicoes for delete to authenticated
  using (company_id in (select public.user_empresa_ids()));

grant select, insert, update, delete on public.indicadores, public.indicador_medicoes to authenticated;

commit;

notify pgrst, 'reload schema';
