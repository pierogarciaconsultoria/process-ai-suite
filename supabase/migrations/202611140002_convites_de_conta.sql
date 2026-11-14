-- Contas, etapa 2: convites de conta, cadastro fechado na prática e gestão de membros.
-- - convites_conta: o administrador da conta (ou a plataforma) gera um link para um e-mail, com o
--   papel (admin ou consultor). Quem recebe entra com aquele e-mail e aceita (aceitar_convite_conta).
-- - Criar empresa exige pertencer a uma conta ativa, dentro do limite de empresas do plano.
--   Login sem convite não cria nada.
-- - A conta nunca fica sem administrador.
-- - Na empresa, dar ou tirar o perfil "Consultor" (admin) é só para quem já gerencia como
--   Consultor: dono, Consultor da empresa, administrador da conta ou plataforma (não o Gestor).
-- Pode rodar mais de uma vez.
begin;

-- ─── Convites de conta ──────────────────────────────────────────────────────

create table if not exists public.convites_conta (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  papel text not null default 'consultor' check (papel in ('admin', 'consultor')),
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'revogado')),
  expira_em timestamptz not null default now() + interval '14 days',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  aceito_por uuid references auth.users(id) on delete set null,
  aceito_em timestamptz
);
create index if not exists convites_conta_conta_idx on public.convites_conta (conta_id);

alter table public.convites_conta enable row level security;

drop policy if exists convites_conta_select on public.convites_conta;
create policy convites_conta_select on public.convites_conta for select to authenticated
  using (public.is_super_admin() or public.user_eh_admin_da_conta(conta_id));

drop policy if exists convites_conta_insert on public.convites_conta;
create policy convites_conta_insert on public.convites_conta for insert to authenticated
  with check ((public.is_super_admin() or public.user_eh_admin_da_conta(conta_id)) and status = 'pendente');

-- Revogar (status) é a única mudança pela tela; aceitar é pela função.
drop policy if exists convites_conta_update on public.convites_conta;
create policy convites_conta_update on public.convites_conta for update to authenticated
  using (public.is_super_admin() or public.user_eh_admin_da_conta(conta_id))
  with check (public.is_super_admin() or public.user_eh_admin_da_conta(conta_id));

grant select, insert, update on public.convites_conta to authenticated;

-- E-mail sempre em minúsculas.
create or replace function public.convites_conta_normaliza()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;
drop trigger if exists convites_conta_normaliza on public.convites_conta;
create trigger convites_conta_normaliza before insert or update of email on public.convites_conta
  for each row execute function public.convites_conta_normaliza();

-- O que a página do convite mostra antes do login (o token é o segredo).
create or replace function public.convite_conta_info(_token text)
returns table (conta_nome text, conta_tipo text, papel text, email text, status text, expirado boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.nome, c.tipo, cv.papel, cv.email, cv.status, cv.expira_em < now()
  from public.convites_conta cv
  join public.contas c on c.id = cv.conta_id
  where cv.token = _token
$$;
revoke all on function public.convite_conta_info(text) from public;
grant execute on function public.convite_conta_info(text) to anon, authenticated;

-- Aceitar: o convite precisa estar pendente, no prazo e ser do e-mail de quem está logado.
create or replace function public.aceitar_convite_conta(_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _convite public.convites_conta%rowtype;
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Entre com o e-mail convidado para aceitar o convite.' using errcode = '42501';
  end if;
  select * into _convite from public.convites_conta where token = _token for update;
  if not found then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;
  if _convite.status <> 'pendente' then
    raise exception 'Este convite já foi %.', case _convite.status when 'aceito' then 'usado' else 'cancelado' end using errcode = '22023';
  end if;
  if _convite.expira_em < now() then
    raise exception 'Este convite expirou. Peça um novo ao administrador da conta.' using errcode = '22023';
  end if;
  if _convite.email <> _email then
    raise exception 'Este convite é para %. Entre com esse e-mail para aceitar.', _convite.email using errcode = '42501';
  end if;

  insert into public.conta_membros (conta_id, user_id, papel)
  values (_convite.conta_id, auth.uid(), _convite.papel)
  on conflict (conta_id, user_id) do update
    set papel = case when public.conta_membros.papel = 'admin' then 'admin' else excluded.papel end;

  update public.convites_conta
     set status = 'aceito', aceito_por = auth.uid(), aceito_em = now()
   where id = _convite.id;

  return _convite.conta_id;
end;
$$;
revoke all on function public.aceitar_convite_conta(text) from public, anon;
grant execute on function public.aceitar_convite_conta(text) to authenticated;

-- ─── Membros da conta (com e-mail) e contas do usuário ──────────────────────

create or replace function public.membros_da_conta(_conta_id uuid)
returns table (id uuid, user_id uuid, email text, nome text, papel text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select cm.id, cm.user_id, u.email::text, nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), cm.papel, cm.created_at
  from public.conta_membros cm
  join auth.users u on u.id = cm.user_id
  where cm.conta_id = _conta_id
    and (public.is_super_admin() or public.user_eh_admin_da_conta(_conta_id))
  order by cm.papel, u.email
$$;
revoke all on function public.membros_da_conta(uuid) from public, anon;
grant execute on function public.membros_da_conta(uuid) to authenticated;

create or replace function public.minhas_contas()
returns table (id uuid, nome text, tipo text, plano text, situacao text, papel text, limite_empresas integer, empresas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, c.tipo, c.plano, c.situacao, cm.papel, c.limite_empresas,
    (select count(*) from public.empresas e where e.conta_id = c.id)
  from public.conta_membros cm
  join public.contas c on c.id = cm.conta_id
  where cm.user_id = auth.uid()
  order by (cm.papel = 'admin') desc, c.nome
$$;
revoke all on function public.minhas_contas() from public, anon;
grant execute on function public.minhas_contas() to authenticated;

-- A conta nunca fica sem administrador.
create or replace function public.conta_membros_mantem_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.papel = 'admin' and (tg_op = 'DELETE' or new.papel <> 'admin') then
    if not exists (
      select 1 from public.conta_membros cm
      where cm.conta_id = old.conta_id and cm.papel = 'admin' and cm.id <> old.id
    ) and exists (select 1 from public.contas c where c.id = old.conta_id) then
      raise exception 'A conta precisa de ao menos um administrador.' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists conta_membros_mantem_admin on public.conta_membros;
create trigger conta_membros_mantem_admin before update or delete on public.conta_membros
  for each row execute function public.conta_membros_mantem_admin();

-- ─── Criar empresa: só dentro de uma conta ativa e no limite do plano ───────

create or replace function public.empresas_define_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _conta public.contas%rowtype;
  _total bigint;
begin
  if new.conta_id is null then
    -- A conta de quem cria (administrador primeiro; senão, a conta em que é consultor).
    select cm.conta_id into new.conta_id
    from public.conta_membros cm
    where cm.user_id = coalesce(auth.uid(), new.owner_id)
    order by (cm.papel = 'admin') desc, cm.created_at
    limit 1;
  end if;

  -- Migrations e manutenção (sem usuário logado) e a plataforma não passam pelas regras do plano.
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if new.conta_id is null then
    raise exception 'Para cadastrar empresas, você precisa fazer parte de uma conta do Peter. Peça um convite ao administrador da sua consultoria ou empresa.' using errcode = '42501';
  end if;

  select * into _conta from public.contas where id = new.conta_id;
  if _conta.situacao <> 'ativa' then
    raise exception 'A conta % está %. Fale com o suporte do Peter.', _conta.nome, _conta.situacao using errcode = '42501';
  end if;
  if not exists (select 1 from public.conta_membros cm where cm.conta_id = new.conta_id and cm.user_id = auth.uid()) then
    raise exception 'Você não faz parte da conta escolhida.' using errcode = '42501';
  end if;
  if _conta.limite_empresas is not null then
    select count(*) into _total from public.empresas where conta_id = new.conta_id;
    if _total >= _conta.limite_empresas then
      raise exception 'A conta % já tem % empresas, o limite do plano. Fale com o suporte para ampliar.', _conta.nome, _total using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- Plano, situação, tipo e limites: só a plataforma pela tela. Sem usuário logado (SQL editor,
-- manutenção) a mudança é permitida.
create or replace function public.contas_protege_plano()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null and not public.is_super_admin() and (
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

-- ─── Membros da empresa: perfil "Consultor" (admin) ─────────────────────────

-- Gerencia como Consultor: dono, Consultor da empresa, administrador da conta ou plataforma.
create or replace function public.user_gerencia_como_consultor(_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
  or exists (select 1 from public.empresas e where e.id = _empresa_id and e.owner_id = auth.uid())
  or exists (select 1 from public.membros m where m.empresa_id = _empresa_id and m.user_id = auth.uid() and m.perfil = 'admin')
  or exists (select 1 from public.empresas e where e.id = _empresa_id and e.conta_id in (select public.user_contas_admin()))
$$;
revoke all on function public.user_gerencia_como_consultor(uuid) from public, anon;
grant execute on function public.user_gerencia_como_consultor(uuid) to authenticated;

create or replace function public.membros_protege_consultor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _empresa uuid := coalesce(new.empresa_id, old.empresa_id);
begin
  -- Sem usuário (manutenção) ou empresa já excluída (remoção em cascata): nada a proteger.
  if auth.uid() is null or not exists (select 1 from public.empresas e where e.id = _empresa) then
    return coalesce(new, old);
  end if;
  if (
    (tg_op = 'UPDATE' and (old.perfil = 'admin' or new.perfil = 'admin') and old.perfil is distinct from new.perfil)
    or (tg_op = 'DELETE' and old.perfil = 'admin')
  ) and not public.user_gerencia_como_consultor(_empresa) then
    raise exception 'Só o Consultor (ou o administrador da conta) dá, tira ou remove o perfil Consultor.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists membros_protege_consultor on public.membros;
create trigger membros_protege_consultor before update or delete on public.membros
  for each row execute function public.membros_protege_consultor();

commit;

notify pgrst, 'reload schema';
