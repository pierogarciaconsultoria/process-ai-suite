-- Auditoria 2026-11-15, achado A-02: convite por e-mail não dá o perfil "Consultor" (admin).
-- A função org-invite grava o convite com a chave de serviço e aceitava perfil admin vindo de
-- qualquer Gestor; no aceite, a pessoa entrava como Consultor sem passar pela trava
-- membros_protege_consultor (que só cobre UPDATE e DELETE de membros).
-- Até a função checar quem convida (exige deploy), o banco recusa convite com perfil admin.
-- Para dar o perfil Consultor: convidar como Gestor ou Analista e trocar o perfil em Usuários
-- (troca protegida: só dono, Consultor, administrador da conta ou plataforma).
-- Pode rodar mais de uma vez.
begin;

create or replace function public.convites_sem_perfil_consultor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.perfil = 'admin' then
    raise exception 'Convite por e-mail não dá o perfil Consultor. Convide como Gestor ou Analista e troque o perfil em Usuários.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Convites pendentes que dariam Consultor passam a dar Gestor (quem convidou promove depois, se puder).
update public.convites set perfil = 'gestor' where perfil = 'admin' and status = 'pending';

drop trigger if exists convites_sem_perfil_consultor on public.convites;
create trigger convites_sem_perfil_consultor before insert or update of perfil on public.convites
  for each row execute function public.convites_sem_perfil_consultor();

commit;
