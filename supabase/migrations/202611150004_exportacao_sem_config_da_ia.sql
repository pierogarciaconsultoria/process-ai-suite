-- Exportação sem a configuração da IA (revisão do arquivo exportado em 2026-11-15).
-- O arquivo da empresa não leva mais:
--   - ai_configurations e document_template_prompts: identidade, validação, roteiro e instruções
--     do Peter (metodologia da consultoria);
--   - ai_prompt_used (em generated_documents e onde mais existir): a instrução dada à IA.
-- Continua de fora: conversas do Peter, controle de uso de IA, registros de exclusão e tokens.
-- Pode rodar mais de uma vez.
begin;

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
      and c.table_name not in ('empresas', 'peter_conversas', 'peter_mensagens', 'ai_usage_limits', 'registros_exclusao', 'ai_configurations', 'document_template_prompts')
    order by c.table_name
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) - ''token'' - ''ai_prompt_used''), ''[]''::jsonb) from public.%I x where x.%I = $1',
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

commit;

notify pgrst, 'reload schema';
