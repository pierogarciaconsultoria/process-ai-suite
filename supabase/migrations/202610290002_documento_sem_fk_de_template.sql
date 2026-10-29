-- Os templates de documento ficam no navegador (src/data/documentation-config.ts, localStorage)
-- e não são gravados em document_templates. Com a chave estrangeira de template_id, todo
-- procedimento salvo era recusado (23503, HTTP 409). template_id continua registrando qual
-- template gerou o documento, e generation_metadata guarda o nome dele.
-- Pode rodar mais de uma vez.
do $$
declare
  _restricao name;
begin
  for _restricao in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.generated_documents'::regclass
      and c.contype = 'f'
      and a.attname = 'template_id'
  loop
    execute format('alter table public.generated_documents drop constraint %I', _restricao);
  end loop;
end
$$;

notify pgrst, 'reload schema';
