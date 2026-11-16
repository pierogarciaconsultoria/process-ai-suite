-- Auditoria 2026-11-15, achado A-02 (parte final): convite com perfil "Consultor" (admin) volta a
-- existir, mas só quando quem convida gerencia a empresa como Consultor.
-- A migration 202611150001 recusava todo convite admin, porque a função org-invite grava com a
-- chave de serviço e o banco não sabia quem convidou. Agora o convite guarda convidado_por:
--   - pela função org-invite (chave de serviço): ela informa o usuário autenticado;
--   - direto pela API, com usuário logado: o banco força convidado_por = auth.uid().
-- Convite admin sem convidado_por, ou de quem não é dono, Consultor, administrador da conta ou
-- plataforma, é recusado. Enquanto a org-invite antiga estiver no ar (não informa convidado_por),
-- o comportamento é o de antes: convite como Consultor recusado.
-- Rodar ANTES de implantar a org-invite nova. Pode rodar mais de uma vez.
begin;

alter table public.convites add column if not exists convidado_por uuid references auth.users(id) on delete set null;

-- Mesma regra de user_gerencia_como_consultor, para um usuário informado (uso interno do gatilho).
create or replace function public.usuario_gerencia_como_consultor(_user_id uuid, _empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null and (
    exists (select 1 from public.plataforma_admins p where p.user_id = _user_id)
    or exists (select 1 from auth.users u where u.id = _user_id and lower(u.email) = 'contato@pierogarcia.com.br')
    or exists (select 1 from public.empresas e where e.id = _empresa_id and e.owner_id = _user_id)
    or exists (select 1 from public.membros m where m.empresa_id = _empresa_id and m.user_id = _user_id and m.perfil = 'admin')
    or exists (
      select 1 from public.empresas e
      join public.conta_membros cm on cm.conta_id = e.conta_id
      where e.id = _empresa_id and cm.user_id = _user_id and cm.papel = 'admin'
    )
  )
$$;
revoke all on function public.usuario_gerencia_como_consultor(uuid, uuid) from public, anon, authenticated;

create or replace function public.convites_sem_perfil_consultor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Com usuário logado, quem convida é sempre ele (não dá para informar outra pessoa).
  if auth.uid() is not null then
    new.convidado_por := auth.uid();
  end if;
  if new.perfil = 'admin' and not public.usuario_gerencia_como_consultor(new.convidado_por, new.empresa_id) then
    raise exception 'Só o Consultor ou o administrador da conta convida com o perfil Consultor. Convide como Gestor ou Analista e troque o perfil em Usuários.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists convites_sem_perfil_consultor on public.convites;
create trigger convites_sem_perfil_consultor before insert or update of perfil, convidado_por on public.convites
  for each row execute function public.convites_sem_perfil_consultor();

commit;

notify pgrst, 'reload schema';
