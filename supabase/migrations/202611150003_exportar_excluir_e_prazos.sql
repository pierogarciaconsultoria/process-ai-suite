-- Auditoria 2026-11-15, achado A-05: exportação, exclusão de empresa e prazos de guarda.
-- Prazos decididos com o usuário em 2026-11-15 (e descritos na Política de privacidade):
--   - texto de anexos do chat do Peter: 90 dias (o nome do arquivo fica);
--   - conversas com o Peter: 12 meses sem mensagem nova;
--   - empresas de conta cancelada: 30 dias depois do cancelamento (dá tempo de exportar).
-- O que entra:
--   - exportar_dados_empresa(id): JSON com tudo da empresa (Consultor ou Gestor);
--   - excluir_empresa(id, nome): dono, administrador da conta ou plataforma, digitando o nome;
--   - registros_exclusao: o que foi excluído, quando, por quem e por quê (só a plataforma lê);
--   - contas.encerrada_em: marcada ao cancelar a conta, limpa ao reativar;
--   - aplicar_prazos_de_guarda(): aplica os três prazos (plataforma ou rotina diária, pg_cron);
--   - chaves estrangeiras para empresas sem "on delete cascade" passam a ter (interview_sessions).
-- Arquivos do Storage (logos e anexos de chamados) não são apagados pelo SQL: o Supabase só
-- permite apagar pela API do Storage. Ficam órfãos e sem acesso (as regras dependem da empresa).
-- Pode rodar mais de uma vez.
begin;

-- ─── Excluir empresa leva junto tudo o que é dela ───────────────────────────

do $$
declare
  _fk record;
  _def text;
begin
  for _fk in
    select con.conname, con.conrelid::regclass as tabela, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.contype = 'f'
      and con.confrelid = 'public.empresas'::regclass
      and con.confdeltype in ('a', 'r')
  loop
    _def := regexp_replace(_fk.def, '\s+ON DELETE (NO ACTION|RESTRICT)', '', 'i');
    execute format('alter table %s drop constraint %I, add constraint %I %s on delete cascade', _fk.tabela, _fk.conname, _fk.conname, _def);
    raise notice 'Exclusão em cascata ligada: %.%', _fk.tabela, _fk.conname;
  end loop;
end;
$$;

-- ─── Registro de exclusões ──────────────────────────────────────────────────

create table if not exists public.registros_exclusao (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('empresa')),
  alvo_id uuid not null,
  alvo_nome text,
  conta_id uuid,
  motivo text not null check (motivo in ('pedido', 'prazo_de_guarda')),
  excluido_por uuid,
  excluido_em timestamptz not null default now()
);

alter table public.registros_exclusao enable row level security;

drop policy if exists registros_exclusao_select on public.registros_exclusao;
create policy registros_exclusao_select on public.registros_exclusao for select to authenticated
  using (public.is_super_admin());

revoke all on public.registros_exclusao from anon, authenticated;
grant select on public.registros_exclusao to authenticated;

-- ─── Exportar os dados de uma empresa ───────────────────────────────────────

-- Todas as tabelas com company_id ou empresa_id (lidas do catálogo, para valer também para
-- tabelas futuras). Ficam de fora: conversas do Peter (são de cada usuário) e controle de uso de IA.
-- Tokens de convite nunca saem.
create or replace function public.exportar_dados_empresa(_empresa_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _t record;
  _linhas jsonb;
  _dados jsonb := '{}'::jsonb;
  _empresa jsonb;
begin
  if auth.uid() is null or not (public.is_super_admin() or public.user_can_manage_company(_empresa_id)) then
    raise exception 'Só o Consultor ou o Gestor da empresa exporta os dados.' using errcode = '42501';
  end if;
  select to_jsonb(e) into _empresa from public.empresas e where e.id = _empresa_id;
  if _empresa is null then
    raise exception 'Empresa não encontrada.' using errcode = 'P0002';
  end if;

  for _t in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.column_name in ('company_id', 'empresa_id')
      and c.table_name not in ('empresas', 'peter_conversas', 'peter_mensagens', 'ai_usage_limits', 'registros_exclusao')
    order by c.table_name
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) - ''token''), ''[]''::jsonb) from public.%I x where x.%I = $1',
      _t.table_name, _t.column_name
    ) into _linhas using _empresa_id;
    _dados := _dados || jsonb_build_object(_t.table_name, _linhas);
  end loop;

  return jsonb_build_object(
    'formato', 'peter-exportacao-v1',
    'gerado_em', now(),
    'empresa', _empresa,
    'pessoas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'email', u.email,
        'nome', coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nome'), ''), nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')),
        'perfil', m.perfil
      ) order by u.email), '[]'::jsonb)
      from public.membros m
      join auth.users u on u.id = m.user_id
      where m.empresa_id = _empresa_id
    ),
    'tabelas', _dados
  );
end;
$$;
revoke all on function public.exportar_dados_empresa(uuid) from public, anon;
grant execute on function public.exportar_dados_empresa(uuid) to authenticated;

-- ─── Excluir uma empresa a pedido ───────────────────────────────────────────

-- Quem exclui: dono, administrador da conta da empresa ou plataforma (não o Gestor nem o Consultor
-- convidado, para a exclusão ser sempre de quem responde pela empresa).
create or replace function public.user_pode_excluir_empresa(_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
  or exists (select 1 from public.empresas e where e.id = _empresa_id and e.owner_id = auth.uid())
  or exists (select 1 from public.empresas e where e.id = _empresa_id and e.conta_id in (select public.user_contas_admin()))
$$;
revoke all on function public.user_pode_excluir_empresa(uuid) from public, anon;
grant execute on function public.user_pode_excluir_empresa(uuid) to authenticated;

create or replace function public.excluir_empresa(_empresa_id uuid, _confirmacao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _empresa public.empresas%rowtype;
begin
  if auth.uid() is null or not public.user_pode_excluir_empresa(_empresa_id) then
    raise exception 'Só o dono da empresa, o administrador da conta ou a plataforma exclui a empresa.' using errcode = '42501';
  end if;
  select * into _empresa from public.empresas where id = _empresa_id for update;
  if not found then
    raise exception 'Empresa não encontrada.' using errcode = 'P0002';
  end if;
  if lower(btrim(coalesce(_confirmacao, ''))) <> lower(btrim(_empresa.nome)) then
    raise exception 'Digite o nome da empresa exatamente como aparece para confirmar.' using errcode = '22023';
  end if;

  insert into public.registros_exclusao (tipo, alvo_id, alvo_nome, conta_id, motivo, excluido_por)
  values ('empresa', _empresa.id, _empresa.nome, _empresa.conta_id, 'pedido', auth.uid());
  delete from public.empresas where id = _empresa_id;
end;
$$;
revoke all on function public.excluir_empresa(uuid, text) from public, anon;
grant execute on function public.excluir_empresa(uuid, text) to authenticated;

-- ─── Data de cancelamento da conta ──────────────────────────────────────────

alter table public.contas add column if not exists encerrada_em timestamptz;

create or replace function public.contas_marca_encerramento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.situacao = 'cancelada' and (tg_op = 'INSERT' or old.situacao is distinct from 'cancelada') then
    new.encerrada_em := now();
  elsif new.situacao <> 'cancelada' then
    new.encerrada_em := null;
  end if;
  return new;
end;
$$;
drop trigger if exists contas_marca_encerramento on public.contas;
create trigger contas_marca_encerramento before insert or update of situacao on public.contas
  for each row execute function public.contas_marca_encerramento();

-- Contas já canceladas começam a contar os 30 dias agora.
update public.contas set encerrada_em = now() where situacao = 'cancelada' and encerrada_em is null;

-- ─── Prazos de guarda ───────────────────────────────────────────────────────

create or replace function public.aplicar_prazos_de_guarda()
returns table (item text, quantidade bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  _n bigint;
  _e record;
begin
  -- Rotina agendada (sem usuário) ou a plataforma.
  if auth.uid() is not null and not public.is_super_admin() then
    raise exception 'Só a plataforma aplica os prazos de guarda.' using errcode = '42501';
  end if;

  -- 1. Texto dos anexos do chat com mais de 90 dias (o nome do arquivo fica).
  update public.peter_mensagens m
     set extras = jsonb_set(
       m.extras, '{anexos}',
       (select coalesce(jsonb_agg(a - 'texto'), '[]'::jsonb) from jsonb_array_elements(m.extras -> 'anexos') a)
     )
   where m.created_at < now() - interval '90 days'
     and jsonb_typeof(m.extras -> 'anexos') = 'array'
     and exists (select 1 from jsonb_array_elements(m.extras -> 'anexos') a where a ? 'texto');
  get diagnostics _n = row_count;
  item := 'texto de anexos do chat (90 dias)'; quantidade := _n; return next;

  -- 2. Conversas sem mensagem nova há 12 meses (as mensagens vão junto).
  delete from public.peter_conversas where updated_at < now() - interval '12 months';
  get diagnostics _n = row_count;
  item := 'conversas com o Peter (12 meses)'; quantidade := _n; return next;

  -- 3. Empresas de contas canceladas há mais de 30 dias.
  _n := 0;
  for _e in
    select e.id, e.nome, e.conta_id
    from public.empresas e
    join public.contas c on c.id = e.conta_id
    where c.situacao = 'cancelada' and c.encerrada_em < now() - interval '30 days'
  loop
    insert into public.registros_exclusao (tipo, alvo_id, alvo_nome, conta_id, motivo, excluido_por)
    values ('empresa', _e.id, _e.nome, _e.conta_id, 'prazo_de_guarda', auth.uid());
    delete from public.empresas where id = _e.id;
    _n := _n + 1;
  end loop;
  item := 'empresas de contas canceladas (30 dias)'; quantidade := _n; return next;
end;
$$;
revoke all on function public.aplicar_prazos_de_guarda() from public, anon;
grant execute on function public.aplicar_prazos_de_guarda() to authenticated;

commit;

-- ─── Rotina diária (pg_cron), fora da transação ─────────────────────────────
-- Se o pg_cron não estiver disponível, só avisa: os prazos podem ser aplicados pelo botão em
-- Configurações → Contas. Para conferir: select jobname, schedule from cron.job;
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('peter-prazos-de-guarda', '17 6 * * *', 'select * from public.aplicar_prazos_de_guarda()');
  raise notice 'Rotina diária agendada (06:17 UTC).';
exception when others then
  raise notice 'pg_cron indisponível (%): aplique os prazos pelo botão em Configurações → Contas.', sqlerrm;
end;
$$;

notify pgrst, 'reload schema';
