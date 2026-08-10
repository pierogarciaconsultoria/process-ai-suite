create or replace function public.user_empresa_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
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
security definer
set search_path = public
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
security definer
set search_path = public
as $$
  select public.user_can_manage_company(_empresa_id)
$$;

revoke all on function public.user_empresa_ids() from public;
revoke all on function public.user_can_manage_company(uuid) from public;
revoke all on function public.user_can_manage_documentation(uuid) from public;
grant execute on function public.user_empresa_ids() to authenticated;
grant execute on function public.user_can_manage_company(uuid) to authenticated;
grant execute on function public.user_can_manage_documentation(uuid) to authenticated;

drop policy if exists empresas_select_by_membership on public.empresas;
create policy empresas_select_by_membership
  on public.empresas
  for select
  using (id in (select public.user_empresa_ids()));

drop policy if exists membros_select_self on public.membros;
drop policy if exists membros_select_by_company on public.membros;

create policy membros_select_by_company
  on public.membros
  for select
  using (empresa_id in (select public.user_empresa_ids()));
