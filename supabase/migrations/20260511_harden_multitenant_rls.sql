create or replace function public.user_empresa_ids()
returns setof uuid
language sql
stable
as $$
  select e.id
  from public.empresas e
  where e.owner_id = auth.uid()
  union
  select m.empresa_id
  from public.membros m
  where m.user_id = auth.uid()
$$;

create or replace function public.user_can_manage_company(_empresa_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.empresas e
    where e.id = _empresa_id
      and e.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.membros m
    where m.empresa_id = _empresa_id
      and m.user_id = auth.uid()
      and m.perfil in ('admin', 'gestor')
  )
$$;

create or replace function public.user_can_manage_documentation(_empresa_id uuid)
returns boolean
language sql
stable
as $$
  select public.user_can_manage_company(_empresa_id)
$$;

drop policy if exists membros_select_self on public.membros;
drop policy if exists membros_select_by_company on public.membros;
drop policy if exists membros_insert_by_owner on public.membros;

create policy membros_select_self
  on public.membros
  for select
  using (user_id = auth.uid());

create policy membros_select_by_company
  on public.membros
  for select
  using (
    exists (
      select 1
      from public.empresas e
      where e.id = empresa_id
        and e.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.membros m
      where m.empresa_id = empresa_id
        and m.user_id = auth.uid()
    )
  );

create policy membros_insert_by_company_manager_or_pending_invite
  on public.membros
  for insert
  with check (
    exists (
      select 1
      from public.empresas e
      where e.id = empresa_id
        and e.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.membros m
      where m.empresa_id = empresa_id
        and m.user_id = auth.uid()
        and m.perfil in ('admin', 'gestor')
    )
    or (
      user_id = auth.uid()
      and exists (
        select 1
        from public.convites c
        where c.empresa_id = empresa_id
          and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          and c.status = 'pending'
          and c.perfil = perfil
      )
    )
  );

create policy membros_update_by_company_manager
  on public.membros
  for update
  using (public.user_can_manage_company(empresa_id))
  with check (public.user_can_manage_company(empresa_id));

create policy membros_delete_by_company_manager
  on public.membros
  for delete
  using (public.user_can_manage_company(empresa_id));

drop policy if exists convites_select_by_membership on public.convites;
drop policy if exists convites_insert_by_admin_or_owner on public.convites;

create policy convites_select_by_company
  on public.convites
  for select
  using (empresa_id in (select public.user_empresa_ids()));

create policy convites_insert_by_company_manager
  on public.convites
  for insert
  with check (public.user_can_manage_company(empresa_id));

create policy convites_update_by_company_manager
  on public.convites
  for update
  using (public.user_can_manage_company(empresa_id))
  with check (public.user_can_manage_company(empresa_id));

create policy convites_delete_by_company_manager
  on public.convites
  for delete
  using (public.user_can_manage_company(empresa_id));

drop policy if exists chamados_select_by_company on public.chamados;
drop policy if exists chamados_insert_by_member on public.chamados;
drop policy if exists chamados_update_by_company on public.chamados;

create policy chamados_select_by_company
  on public.chamados
  for select
  using (empresa_id in (select public.user_empresa_ids()));

create policy chamados_insert_by_company
  on public.chamados
  for insert
  with check (
    empresa_id in (select public.user_empresa_ids())
    and user_id = auth.uid()
  );

create policy chamados_update_by_company
  on public.chamados
  for update
  using (empresa_id in (select public.user_empresa_ids()))
  with check (empresa_id in (select public.user_empresa_ids()));

create policy chamados_delete_by_company
  on public.chamados
  for delete
  using (empresa_id in (select public.user_empresa_ids()));

drop policy if exists chamado_mensagens_select_by_company on public.chamado_mensagens;
drop policy if exists chamado_mensagens_insert_by_member on public.chamado_mensagens;

create policy chamado_mensagens_select_by_company
  on public.chamado_mensagens
  for select
  using (empresa_id in (select public.user_empresa_ids()));

create policy chamado_mensagens_insert_by_company
  on public.chamado_mensagens
  for insert
  with check (
    empresa_id in (select public.user_empresa_ids())
    and user_id = auth.uid()
  );

create policy chamado_mensagens_update_by_company
  on public.chamado_mensagens
  for update
  using (empresa_id in (select public.user_empresa_ids()))
  with check (empresa_id in (select public.user_empresa_ids()));

create policy chamado_mensagens_delete_by_company
  on public.chamado_mensagens
  for delete
  using (empresa_id in (select public.user_empresa_ids()));

drop policy if exists interview_sessions_select_by_user_or_membership on public.interview_sessions;
drop policy if exists interview_sessions_insert_by_user on public.interview_sessions;
drop policy if exists interview_sessions_update_by_user on public.interview_sessions;
drop policy if exists interview_sessions_delete_by_user on public.interview_sessions;

create policy interview_sessions_select_by_scope
  on public.interview_sessions
  for select
  using (
    user_id = auth.uid()
    or (
      empresa_id is not null
      and empresa_id in (select public.user_empresa_ids())
    )
  );

create policy interview_sessions_insert_by_scope
  on public.interview_sessions
  for insert
  with check (
    user_id = auth.uid()
    and (
      empresa_id is null
      or empresa_id in (select public.user_empresa_ids())
    )
  );

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

create policy interview_sessions_delete_by_scope
  on public.interview_sessions
  for delete
  using (
    user_id = auth.uid()
    or (
      empresa_id is not null
      and public.user_can_manage_company(empresa_id)
    )
  );

create policy generated_documents_delete_policy
  on public.generated_documents
  for delete
  using (
    company_id in (select public.user_empresa_ids())
    and public.user_can_manage_documentation(company_id)
  );

drop policy if exists "chamados objects read by company members" on storage.objects;
drop policy if exists "chamados objects insert by company members" on storage.objects;
drop policy if exists "chamados objects update by company members" on storage.objects;

create policy "chamados objects read by company members"
  on storage.objects
  for select
  using (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select company_id::text from public.user_empresa_ids() as company_ids(company_id))
  );

create policy "chamados objects insert by company members"
  on storage.objects
  for insert
  with check (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select company_id::text from public.user_empresa_ids() as company_ids(company_id))
  );

create policy "chamados objects update by company members"
  on storage.objects
  for update
  using (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select company_id::text from public.user_empresa_ids() as company_ids(company_id))
  )
  with check (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select company_id::text from public.user_empresa_ids() as company_ids(company_id))
  );

create policy "chamados objects delete by company members"
  on storage.objects
  for delete
  using (
    bucket_id = 'chamados'
    and split_part(name, '/', 1) in (select company_id::text from public.user_empresa_ids() as company_ids(company_id))
  );
