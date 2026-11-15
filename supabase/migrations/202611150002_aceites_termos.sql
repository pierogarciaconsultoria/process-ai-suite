-- Auditoria 2026-11-15, achados A-04 e A-11: aceite da Política de privacidade e dos Termos de uso.
-- Cada usuário registra o aceite da versão vigente (src/data/documentos-legais.ts). Sem aceite da
-- versão atual, o app pede o aceite antes de liberar as telas. O registro não é editado nem apagado
-- pela tela (é a prova do aceite); some só se o usuário for excluído.
-- Pode rodar mais de uma vez.
begin;

create table if not exists public.aceites_termos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  versao text not null check (length(btrim(versao)) between 1 and 40),
  aceito_em timestamptz not null default now(),
  unique (user_id, versao)
);

alter table public.aceites_termos enable row level security;

drop policy if exists aceites_termos_select on public.aceites_termos;
create policy aceites_termos_select on public.aceites_termos for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists aceites_termos_insert on public.aceites_termos;
create policy aceites_termos_insert on public.aceites_termos for insert to authenticated
  with check (user_id = auth.uid());

-- A tela só informa a versão; usuário e data vêm do banco.
revoke all on public.aceites_termos from anon, authenticated;
grant select on public.aceites_termos to authenticated;
grant insert (versao) on public.aceites_termos to authenticated;

commit;

notify pgrst, 'reload schema';
