-- Ao gravar pergunta e resposta de uma vez, a pergunta chegava sem "extras" e o banco recebia
-- null (o valor padrão não vale em inserção de várias linhas). Mensagem sem extras passa a valer {}.
-- Pode rodar mais de uma vez.
create or replace function public.peter_mensagem_extras_padrao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.extras := coalesce(new.extras, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists peter_mensagens_extras_padrao on public.peter_mensagens;
create trigger peter_mensagens_extras_padrao
before insert or update on public.peter_mensagens
for each row execute function public.peter_mensagem_extras_padrao();
