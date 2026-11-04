-- Perfis com papel claro (ISO 9001, 5.3: responsabilidades e autoridades definidas).
-- Os valores gravados continuam os mesmos; a tela mostra:
--   admin    → Consultor (e o dono da empresa)
--   gestor   → Gestor do cliente
--   analista → Equipe
-- Consultor e Gestor fazem tudo na empresa. A Equipe participa e atualiza (entrevistas,
-- resultados de indicadores, ações), mas não exclui nada, não muda a definição dos
-- indicadores e não aprova documentos (aprovação já exige user_can_manage_documentation).
-- Pode rodar mais de uma vez.
begin;

-- Mesma regra da migration 202608100001: dono da empresa ou membro admin/gestor.
create or replace function public.user_can_manage_company(_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.empresas e
    where e.id = _empresa_id and e.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.membros m
    where m.empresa_id = _empresa_id and m.user_id = auth.uid() and m.perfil in ('admin', 'gestor')
  )
$$;

revoke all on function public.user_can_manage_company(uuid) from public;
grant execute on function public.user_can_manage_company(uuid) to authenticated;

-- Excluir: só Consultor e Gestor. Remove as regras de exclusão existentes (inclusive as criadas
-- fora do repositório), porque uma regra permissiva a mais anularia a restrição. Regras "ALL"
-- não são removidas (tirariam também a leitura): a migration avisa para revisá-las.
do $$
declare
  _tabela text;
  _regra record;
begin
  foreach _tabela in array array['processos', 'acoes', 'indicadores', 'indicador_medicoes'] loop
    if to_regclass('public.' || _tabela) is null then
      continue;
    end if;
    for _regra in select policyname from pg_policies where schemaname = 'public' and tablename = _tabela and cmd = 'DELETE' loop
      execute format('drop policy %I on public.%I', _regra.policyname, _tabela);
    end loop;
    for _regra in select policyname from pg_policies where schemaname = 'public' and tablename = _tabela and cmd = 'ALL' and permissive = 'PERMISSIVE' loop
      raise warning 'Regra % em % vale para tudo (inclusive excluir) e mantém a exclusão aberta: revise.', _regra.policyname, _tabela;
    end loop;
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.user_can_manage_company(company_id))',
      _tabela || '_delete_por_gestao', _tabela
    );
  end loop;
end
$$;

-- Definição dos indicadores (nome, fórmula, meta): só Consultor e Gestor. A Equipe pode criar
-- indicadores vindos do mapeamento (chave_origem preenchida), como ao aprovar o plano numa
-- entrevista que ela conduziu. Lançar resultados (indicador_medicoes) continua aberto a todos.
do $$
declare
  _regra record;
begin
  if to_regclass('public.indicadores') is null then
    return;
  end if;
  for _regra in select policyname from pg_policies where schemaname = 'public' and tablename = 'indicadores' and cmd in ('INSERT', 'UPDATE') loop
    execute format('drop policy %I on public.indicadores', _regra.policyname);
  end loop;

  create policy indicadores_insert_por_gestao
    on public.indicadores for insert to authenticated
    with check (
      company_id in (select public.user_empresa_ids())
      and (public.user_can_manage_company(company_id) or chave_origem like 'processo:%')
      and created_by = auth.uid()
      and (processo_id is null or exists (select 1 from public.processos p where p.id = processo_id and p.company_id = indicadores.company_id))
    );

  create policy indicadores_update_por_gestao
    on public.indicadores for update to authenticated
    using (public.user_can_manage_company(company_id))
    with check (
      public.user_can_manage_company(company_id)
      and updated_by = auth.uid()
      and (processo_id is null or exists (select 1 from public.processos p where p.id = processo_id and p.company_id = indicadores.company_id))
    );
end
$$;

commit;

notify pgrst, 'reload schema';
