-- Contas: quem assina o Peter. Uma conta é uma consultoria (atende várias empresas) ou uma empresa
-- que assina direto. Plataforma → Conta → Empresa.
-- - contas: nome, tipo, plano, situação e limites.
-- - conta_membros: administradores (veem e gerenciam todas as empresas da conta) e consultores
--   (veem só as empresas em que são membros, como hoje).
-- - plataforma_admins: administradores da plataforma (no lugar do e-mail fixo; o e-mail continua
--   valendo para ninguém ficar sem acesso).
-- - empresas.conta_id: a conta que atende a empresa. O dado é da empresa: a conta pode mudar.
-- As empresas atuais entram na conta do dono de cada uma. Pode rodar mais de uma vez.
begin;

-- ─── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  tipo text not null default 'consultoria' check (tipo in ('consultoria', 'empresa')),
  plano text not null default 'teste',
  situacao text not null default 'ativa' check (situacao in ('ativa', 'suspensa', 'cancelada')),
  limite_empresas integer check (limite_empresas is null or limite_empresas >= 0),
  limite_usuarios integer check (limite_usuarios is null or limite_usuarios >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conta_membros (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'consultor' check (papel in ('admin', 'consultor')),
  created_at timestamptz not null default now(),
  unique (conta_id, user_id)
);
create index if not exists conta_membros_user_idx on public.conta_membros (user_id);

create table if not exists public.plataforma_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.empresas add column if not exists conta_id uuid references public.contas(id) on delete set null;
create index if not exists empresas_conta_idx on public.empresas (conta_id);

alter table public.contas enable row level security;
alter table public.conta_membros enable row level security;
alter table public.plataforma_admins enable row level security;

-- ─── Funções de acesso ──────────────────────────────────────────────────────

-- Administrador da plataforma: tabela plataforma_admins ou o e-mail original.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'contato@pierogarcia.com.br'
    or exists (select 1 from public.plataforma_admins p where p.user_id = auth.uid())
$$;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- Contas em que o usuário é administrador.
create or replace function public.user_contas_admin()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.conta_id from public.conta_membros cm where cm.user_id = auth.uid() and cm.papel = 'admin'
$$;
revoke all on function public.user_contas_admin() from public, anon;
grant execute on function public.user_contas_admin() to authenticated;

create or replace function public.user_eh_admin_da_conta(_conta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.conta_membros cm where cm.conta_id = _conta_id and cm.user_id = auth.uid() and cm.papel = 'admin')
$$;
revoke all on function public.user_eh_admin_da_conta(uuid) from public, anon;
grant execute on function public.user_eh_admin_da_conta(uuid) to authenticated;

-- Empresas visíveis: dono, membro ou administrador da conta que atende a empresa.
create or replace function public.user_empresa_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id from public.empresas e where e.owner_id = auth.uid()
  union
  select m.empresa_id from public.membros m where m.user_id = auth.uid()
  union
  select e.id from public.empresas e where e.conta_id in (select public.user_contas_admin())
$$;
revoke all on function public.user_empresa_ids() from public;
grant execute on function public.user_empresa_ids() to authenticated;

-- Gerenciar a empresa: dono, Consultor ou Gestor da empresa, ou administrador da conta.
create or replace function public.user_can_manage_company(_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.empresas e where e.id = _empresa_id and e.owner_id = auth.uid())
  or exists (
    select 1 from public.membros m
    where m.empresa_id = _empresa_id and m.user_id = auth.uid() and m.perfil in ('admin', 'gestor')
  )
  or exists (
    select 1 from public.empresas e
    where e.id = _empresa_id and e.conta_id in (select public.user_contas_admin())
  )
$$;
revoke all on function public.user_can_manage_company(uuid) from public;
grant execute on function public.user_can_manage_company(uuid) to authenticated;

-- ─── Regras de acesso ───────────────────────────────────────────────────────

-- Conta: veem os membros dela, quem participa de uma empresa atendida por ela e a plataforma.
drop policy if exists contas_select on public.contas;
create policy contas_select on public.contas for select to authenticated
  using (
    public.is_super_admin()
    or id in (select cm.conta_id from public.conta_membros cm where cm.user_id = auth.uid())
    or id in (select e.conta_id from public.empresas e where e.id in (select public.user_empresa_ids()))
  );

drop policy if exists contas_insert on public.contas;
create policy contas_insert on public.contas for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists contas_update on public.contas;
create policy contas_update on public.contas for update to authenticated
  using (public.is_super_admin() or public.user_eh_admin_da_conta(id))
  with check (public.is_super_admin() or public.user_eh_admin_da_conta(id));

drop policy if exists contas_delete on public.contas;
create policy contas_delete on public.contas for delete to authenticated
  using (public.is_super_admin());

-- Plano, situação e limites só a plataforma muda (o administrador da conta muda o nome).
create or replace function public.contas_protege_plano()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if not public.is_super_admin() and (
    new.plano is distinct from old.plano
    or new.situacao is distinct from old.situacao
    or new.limite_empresas is distinct from old.limite_empresas
    or new.limite_usuarios is distinct from old.limite_usuarios
    or new.tipo is distinct from old.tipo
  ) then
    raise exception 'Só a plataforma altera plano, situação, tipo e limites da conta.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists contas_protege_plano on public.contas;
create trigger contas_protege_plano before update on public.contas
  for each row execute function public.contas_protege_plano();

drop policy if exists conta_membros_select on public.conta_membros;
create policy conta_membros_select on public.conta_membros for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or public.user_eh_admin_da_conta(conta_id)
  );

drop policy if exists conta_membros_insert on public.conta_membros;
create policy conta_membros_insert on public.conta_membros for insert to authenticated
  with check (public.is_super_admin() or public.user_eh_admin_da_conta(conta_id));

drop policy if exists conta_membros_update on public.conta_membros;
create policy conta_membros_update on public.conta_membros for update to authenticated
  using (public.is_super_admin() or public.user_eh_admin_da_conta(conta_id))
  with check (public.is_super_admin() or public.user_eh_admin_da_conta(conta_id));

drop policy if exists conta_membros_delete on public.conta_membros;
create policy conta_membros_delete on public.conta_membros for delete to authenticated
  using (public.is_super_admin() or public.user_eh_admin_da_conta(conta_id));

drop policy if exists plataforma_admins_select on public.plataforma_admins;
create policy plataforma_admins_select on public.plataforma_admins for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists plataforma_admins_escrita on public.plataforma_admins;
create policy plataforma_admins_escrita on public.plataforma_admins for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant select, insert, update, delete on public.contas, public.conta_membros, public.plataforma_admins to authenticated;

-- ─── Empresas novas entram na conta de quem cria ────────────────────────────

create or replace function public.empresas_define_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.conta_id is null then
    -- A conta de quem cria (administrador primeiro; senão, a conta em que é consultor).
    select cm.conta_id into new.conta_id
    from public.conta_membros cm
    where cm.user_id = coalesce(auth.uid(), new.owner_id)
    order by (cm.papel = 'admin') desc, cm.created_at
    limit 1;
  end if;
  return new;
end;
$$;
drop trigger if exists empresas_define_conta on public.empresas;
create trigger empresas_define_conta before insert on public.empresas
  for each row execute function public.empresas_define_conta();

-- ─── Lista de empresas do usuário (seletor do menu, Empresas, Usuários) ─────

create or replace function public.empresas_do_usuario()
returns table (
  id uuid,
  nome text,
  segmento text,
  tamanho text,
  area_atuacao text,
  contexto text,
  created_at timestamptz,
  perfil text,
  conta_id uuid,
  conta_nome text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.nome, e.segmento, e.tamanho, e.area_atuacao, e.contexto, e.created_at,
    case
      when e.owner_id = auth.uid() then 'owner'
      when m.perfil is not null then m.perfil
      else 'admin'
    end as perfil,
    e.conta_id,
    c.nome as conta_nome
  from public.empresas e
  left join public.membros m on m.empresa_id = e.id and m.user_id = auth.uid()
  left join public.contas c on c.id = e.conta_id
  where e.id in (select public.user_empresa_ids())
  order by e.nome
$$;
revoke all on function public.empresas_do_usuario() from public, anon;
grant execute on function public.empresas_do_usuario() to authenticated;

-- Contas da plataforma com os números, só para o administrador da plataforma (que não enxerga
-- as empresas das contas pelas regras normais).
create or replace function public.contas_da_plataforma()
returns table (
  id uuid,
  nome text,
  tipo text,
  plano text,
  situacao text,
  limite_empresas integer,
  limite_usuarios integer,
  created_at timestamptz,
  empresas bigint,
  administradores text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.nome, c.tipo, c.plano, c.situacao, c.limite_empresas, c.limite_usuarios, c.created_at,
    (select count(*) from public.empresas e where e.conta_id = c.id),
    (select string_agg(u.email, ', ' order by u.email)
       from public.conta_membros cm join auth.users u on u.id = cm.user_id
      where cm.conta_id = c.id and cm.papel = 'admin')
  from public.contas c
  where public.is_super_admin()
  order by c.nome
$$;
revoke all on function public.contas_da_plataforma() from public, anon;
grant execute on function public.contas_da_plataforma() to authenticated;

-- ─── Dados atuais ───────────────────────────────────────────────────────────

-- Administrador da plataforma pelo e-mail original.
insert into public.plataforma_admins (user_id)
select u.id from auth.users u where lower(u.email) = 'contato@pierogarcia.com.br'
on conflict (user_id) do nothing;

-- Cada dono de empresa sem conta ganha uma conta (consultoria), da qual é administrador.
do $$
declare
  _dono record;
  _conta uuid;
begin
  for _dono in
    select distinct e.owner_id, coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), u.email, 'Conta') as nome
    from public.empresas e
    join auth.users u on u.id = e.owner_id
    where e.conta_id is null
  loop
    select cm.conta_id into _conta
    from public.conta_membros cm
    where cm.user_id = _dono.owner_id and cm.papel = 'admin'
    order by cm.created_at
    limit 1;

    if _conta is null then
      insert into public.contas (nome, tipo, created_by) values (_dono.nome, 'consultoria', _dono.owner_id) returning id into _conta;
      insert into public.conta_membros (conta_id, user_id, papel) values (_conta, _dono.owner_id, 'admin');
    end if;

    update public.empresas set conta_id = _conta where owner_id = _dono.owner_id and conta_id is null;
  end loop;
end
$$;

commit;

notify pgrst, 'reload schema';
