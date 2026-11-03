-- Um processo por nome em cada empresa. A comparação ignora maiúsculas, acentos, hífens e espaços
-- ("Pós vendas" = "POS-VENDAS"), com a mesma regra de chaveDoNome em src/lib/processo-duplicado.ts.
-- Ficam de fora os processos Obsoletos e as entrevistas que ainda não têm nome.
-- Se já houver nomes repetidos, a migration para e lista quais são: exclua (botão Excluir em Processos),
-- renomeie ou marque como Obsoleto e rode de novo. Pode rodar mais de uma vez.
begin;

create or replace function public.chave_nome_processo(_nome text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
    lower(translate(coalesce(_nome, ''),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
      'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]', '', 'g')
$$;

do $$
declare
  _repetidos text;
begin
  select string_agg(format('"%s" (%s, %s processos)', exemplo, empresa, quantidade), '; ')
    into _repetidos
  from (
    select min(p.nome) as exemplo, coalesce(min(e.nome), p.company_id::text) as empresa, count(*) as quantidade
    from public.processos p
    left join public.empresas e on e.id = p.company_id
    where public.chave_nome_processo(p.nome) <> '' and p.status <> 'Obsoleto'
    group by p.company_id, public.chave_nome_processo(p.nome)
    having count(*) > 1
  ) grupos;

  if _repetidos is not null then
    raise exception 'Há processos com o mesmo nome na mesma empresa: %. Exclua, renomeie ou marque como Obsoleto os repetidos e rode de novo.', _repetidos;
  end if;
end
$$;

create unique index if not exists processos_nome_unico
  on public.processos (company_id, public.chave_nome_processo(nome))
  where public.chave_nome_processo(nome) <> '' and status <> 'Obsoleto';

commit;
