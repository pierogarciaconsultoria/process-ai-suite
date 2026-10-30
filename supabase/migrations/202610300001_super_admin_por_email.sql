-- Em produção, is_super_admin() foi recriada fora do repositório procurando uma linha em membros com
-- perfil 'super_admin', que o sistema nunca grava. Resultado: o super admin abria Roteiro IA e Skin
-- (a tela confere o e-mail) mas o banco recusava salvar. Volta a definição da migration 202608110001,
-- a mesma regra de src/lib/permissions.ts. O create or replace também tira o security definer
-- da versão de produção: a função só lê o token de quem chama. Pode rodar mais de uma vez.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'contato@pierogarcia.com.br'
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;
