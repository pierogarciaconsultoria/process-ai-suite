-- Logo de cada empresa, usado no cabeçalho dos procedimentos (PR/IT) exportados em PDF.
-- Um arquivo por empresa em logos/<empresa_id>/logo. O bucket é público para leitura (a imagem
-- entra no documento impresso); enviar, trocar e remover é só para Consultor e Gestor da própria
-- empresa (user_can_manage_company) ou o super admin. Pode rodar mais de uma vez.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "logos leitura" on storage.objects;
create policy "logos leitura"
  on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists "logos envio pela gestao" on storage.objects;
create policy "logos envio pela gestao"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (
      public.is_super_admin()
      or split_part(name, '/', 1) in (select e.id::text from public.empresas e where public.user_can_manage_company(e.id))
    )
  );

drop policy if exists "logos troca pela gestao" on storage.objects;
create policy "logos troca pela gestao"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.is_super_admin()
      or split_part(name, '/', 1) in (select e.id::text from public.empresas e where public.user_can_manage_company(e.id))
    )
  )
  with check (
    bucket_id = 'logos'
    and (
      public.is_super_admin()
      or split_part(name, '/', 1) in (select e.id::text from public.empresas e where public.user_can_manage_company(e.id))
    )
  );

drop policy if exists "logos remocao pela gestao" on storage.objects;
create policy "logos remocao pela gestao"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.is_super_admin()
      or split_part(name, '/', 1) in (select e.id::text from public.empresas e where public.user_can_manage_company(e.id))
    )
  );

commit;
