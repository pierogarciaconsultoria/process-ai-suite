-- Documentos do tipo "Procedimento" passam a ser numerados PR-001, PR-002...; os demais
-- continuam IT-001, IT-002... A numeração é separada por prefixo, dentro de cada empresa.
-- Revisões mantêm o código do documento original, porque o código já chega preenchido.
-- Pode rodar mais de uma vez.
create or replace function public.assign_generated_document_code()
returns trigger
language plpgsql
as $$
declare
  prefixo text := case when new.document_type = 'Procedimento' then 'PR' else 'IT' end;
  next_number integer;
begin
  if new.code is not null and btrim(new.code) <> '' then
    return new;
  end if;

  select coalesce(max((regexp_match(code, '^' || prefixo || '-(\d+)$'))[1]::integer), 0) + 1
    into next_number
  from public.generated_documents
  where company_id = new.company_id
    and code ~ ('^' || prefixo || '-(\d+)$');

  new.code := prefixo || '-' || lpad(next_number::text, 3, '0');
  return new;
end;
$$;

notify pgrst, 'reload schema';
