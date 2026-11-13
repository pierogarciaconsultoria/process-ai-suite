-- O bucket "logos" é público: o endereço público da imagem funciona sem regra de leitura. A regra
-- "logos leitura" (202611130001) deixava qualquer um LISTAR os arquivos (aviso do Supabase "public
-- bucket allows listing"). A leitura pela API fica só para quem participa da empresa (ou o super
-- admin), o que a troca do logo (upsert) também precisa. Pode rodar mais de uma vez.
begin;

drop policy if exists "logos leitura" on storage.objects;
drop policy if exists "logos leitura pelos membros" on storage.objects;
create policy "logos leitura pelos membros"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.is_super_admin()
      or split_part(name, '/', 1) in (select company_id::text from public.user_empresa_ids() as ids(company_id))
    )
  );

commit;
