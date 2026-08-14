create or replace function public.is_super_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'contato@pierogarcia.com.br'
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

drop policy if exists ai_configurations_insert_by_company on public.ai_configurations;
drop policy if exists ai_configurations_update_by_company on public.ai_configurations;
drop policy if exists ai_configurations_delete_by_company on public.ai_configurations;
drop policy if exists "Empresas podem editar suas configs" on public.ai_configurations;
drop policy if exists "Somente super admin edita configs de IA" on public.ai_configurations;
drop policy if exists "Somente super admin atualiza configs de IA" on public.ai_configurations;

create policy ai_configurations_insert_by_super_admin
  on public.ai_configurations
  for insert
  to authenticated
  with check (
    public.is_super_admin()
    and company_id in (select public.user_empresa_ids())
    and updated_by = auth.uid()
  );

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

create policy ai_configurations_delete_by_super_admin
  on public.ai_configurations
  for delete
  to authenticated
  using (
    public.is_super_admin()
    and company_id in (select public.user_empresa_ids())
  );
