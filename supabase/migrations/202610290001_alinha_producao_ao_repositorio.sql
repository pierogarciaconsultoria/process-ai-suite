-- Alinha o banco de produção (Lovable Cloud) às migrations do repositório, conforme o diagnóstico de 29/10/2026.
-- Pode rodar mais de uma vez.
begin;

-- 1. ai_configurations: as regras criadas fora do repositório deixavam qualquer gestor da empresa alterar
-- as configurações do Peter e não deixavam o dono (sem linha em membros) lê-las. Volta a regra da
-- migration 202608110001: leitura pela empresa, alteração só pelo super admin.
drop policy if exists ai_config_select on public.ai_configurations;
drop policy if exists ai_config_insert on public.ai_configurations;
drop policy if exists ai_config_update on public.ai_configurations;
drop policy if exists ai_config_delete on public.ai_configurations;

drop policy if exists ai_configurations_select_by_company on public.ai_configurations;
create policy ai_configurations_select_by_company
  on public.ai_configurations
  for select
  using (company_id in (select public.user_empresa_ids()));

drop policy if exists ai_configurations_insert_by_super_admin on public.ai_configurations;
create policy ai_configurations_insert_by_super_admin
  on public.ai_configurations
  for insert
  to authenticated
  with check (
    public.is_super_admin()
    and company_id in (select public.user_empresa_ids())
    and updated_by = auth.uid()
  );

drop policy if exists ai_configurations_update_by_super_admin on public.ai_configurations;
create policy ai_configurations_update_by_super_admin
  on public.ai_configurations
  for update
  to authenticated
  using (
    public.is_super_admin()
    and company_id in (select public.user_empresa_ids())
  )
  with check (
    public.is_super_admin()
    and company_id in (select public.user_empresa_ids())
    and updated_by = auth.uid()
  );

drop policy if exists ai_configurations_delete_by_super_admin on public.ai_configurations;
create policy ai_configurations_delete_by_super_admin
  on public.ai_configurations
  for delete
  to authenticated
  using (
    public.is_super_admin()
    and company_id in (select public.user_empresa_ids())
  );

-- 2. interview_sessions: as regras antigas somavam acesso às *_by_scope (por exemplo, criar sessão
-- para empresa da qual o usuário não participa). Ficam só as *_by_scope, com a de atualização que faltava.
drop policy if exists interview_sessions_select on public.interview_sessions;
drop policy if exists interview_sessions_insert on public.interview_sessions;
drop policy if exists interview_sessions_update on public.interview_sessions;
drop policy if exists interview_sessions_delete on public.interview_sessions;

drop policy if exists interview_sessions_update_by_scope on public.interview_sessions;
create policy interview_sessions_update_by_scope
  on public.interview_sessions
  for update
  using (
    user_id = auth.uid()
    or (
      empresa_id is not null
      and public.user_can_manage_company(empresa_id)
    )
  )
  with check (
    user_id = auth.uid()
    or (
      empresa_id is not null
      and public.user_can_manage_company(empresa_id)
    )
  );

-- 3. membros: membros_insert citava o perfil "gerente", que não existe, e já é coberta por
-- membros_insert_by_company_manager_or_pending_invite.
drop policy if exists membros_insert on public.membros;

-- 4. processos: produção só deixa gestores excluírem processos, mais restrito que a
-- processos_delete_policy do repositório (qualquer membro). Fica a regra de produção.
drop policy if exists processos_delete_policy on public.processos;
drop policy if exists processos_delete on public.processos;
create policy processos_delete
  on public.processos
  for delete
  using (public.user_can_manage_company(company_id));

-- 5. Anexos dos chamados de suporte: o bucket e duas regras não existiam, então os anexos falhavam.
insert into storage.buckets (id, name, public)
values ('chamados', 'chamados', false)
on conflict (id) do nothing;

drop policy if exists "chamados objects read by company members" on storage.objects;
create policy "chamados objects read by company members"
  on storage.objects
  for select
  using (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select company_id::text from public.user_empresa_ids() as company_ids(company_id))
  );

drop policy if exists "chamados objects insert by company members" on storage.objects;
create policy "chamados objects insert by company members"
  on storage.objects
  for insert
  with check (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select company_id::text from public.user_empresa_ids() as company_ids(company_id))
  );

-- 6. Funções criadas fora do repositório e sem uso no código. get_user_empresa_ids(_user_id) é
-- security definer e revela as empresas de qualquer usuário. Tira a permissão de execução da API,
-- só quando nenhuma regra de acesso depende da função.
do $$
declare
  _funcao regprocedure;
begin
  for _funcao in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_user_empresa_ids', 'is_super_admin_or_manage', 'perfil_convite_permitido')
      and not exists (
        select 1 from pg_depend d
        where d.refobjid = p.oid and d.classid = 'pg_policy'::regclass
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', _funcao);
  end loop;
end
$$;

commit;

-- 7. Índices (fora da transação: se algum falhar, as correções acima continuam valendo).
create unique index if not exists convites_token_unique
  on public.convites (token)
  where token is not null;

create index if not exists convites_empresa_status_idx
  on public.convites (empresa_id, status);

create index if not exists convites_expires_at_idx
  on public.convites (expires_at);

create index if not exists idx_generated_documents_process_id
  on public.generated_documents (process_id);

notify pgrst, 'reload schema';
