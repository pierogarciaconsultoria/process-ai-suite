"""Gera uma consulta só de leitura que lista as diferenças entre o banco e as migrations.

Uso: python3 scripts/schema/esperado.py supabase/migrations > /tmp/esperado.json
     python3 scripts/schema/gerar_sql.py /tmp/esperado.json > /tmp/diagnostico.sql
Cole o resultado no SQL editor do Lovable; nenhuma linha devolvida, além de "policy em membros", significa banco igual ao repositório."""
import json, sys
from pathlib import Path
e = json.loads(Path(sys.argv[1]).read_text())
q = lambda s: "'" + s.replace("'", "''") + "'"
pares = lambda itens: ",\n    ".join(f"({q(a)}, {q(b)})" for a, b in itens)
tabelas = ", ".join(q(t) for t in e["tabelas"])
funcoes = ",\n    ".join(f"({q(f)}, {'true' if d else 'false'})" for f, d in e["funcoes"].items())
print(rf"""-- Diagnóstico do schema (somente leitura): lista só o que difere das migrations do repositório.
with
esperadas_policies(esquema, tabela, nome) as (values
    {",\n    ".join(f"({q('storage' if t == 'objects' else 'public')}, {q(t)}, {q(n)})" for t, n in e["policies"])}
),
esperadas_funcoes(nome, security_definer) as (values
    {funcoes}
),
esperados_triggers(tabela, nome) as (values
    {pares(e["triggers"])}
),
esperados_indices(tabela, nome) as (values
    {pares(e["indices"])}
),
tabelas(nome) as (select unnest(array[{tabelas}]))
select tipo, objeto, situacao, detalhe from (
  select 1 ordem, 'policy' tipo, ep.tabela || '.' || ep.nome objeto, 'falta' situacao, '' detalhe
  from esperadas_policies ep
  where not exists (select 1 from pg_policies p where p.schemaname = ep.esquema and p.tablename = ep.tabela and p.policyname = ep.nome)
  union all
  select 2, 'policy', p.tablename || '.' || p.policyname, 'fora das migrations',
         p.cmd || ' | using: ' || coalesce(left(regexp_replace(p.qual, '\s+', ' ', 'g'), 250), '-') || ' | check: ' || coalesce(left(regexp_replace(p.with_check, '\s+', ' ', 'g'), 250), '-')
  from pg_policies p
  where p.schemaname = 'public'
    and not exists (select 1 from esperadas_policies ep where ep.esquema = 'public' and ep.tabela = p.tablename and ep.nome = p.policyname)
  union all
  select 3, 'policy em membros', p.policyname, 'definição atual', p.cmd || ' | using: ' || coalesce(left(regexp_replace(p.qual, '\s+', ' ', 'g'), 250), '-')
  from pg_policies p where p.schemaname = 'public' and p.tablename = 'membros'
  union all
  select 4, 'função', ef.nome,
         case when pr.oid is null then 'falta' else 'security definer deveria ser ' || ef.security_definer end, ''
  from esperadas_funcoes ef
  left join (select p.oid, p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') pr
    on pr.proname = ef.nome
  where pr.oid is null or pr.prosecdef <> ef.security_definer
  union all
  select 5, 'função', p.proname, 'fora das migrations',
         case when p.prosecdef then 'security definer' else 'security invoker' end || ' | ' ||
         left(regexp_replace(substring(pg_get_functiondef(p.oid) from '\$[a-z_]*\$(.*)\$[a-z_]*\$'), '\s+', ' ', 'g'), 250)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from esperadas_funcoes ef where ef.nome = p.proname)
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  union all
  select 6, 'trigger', et.tabela || '.' || et.nome, 'falta', ''
  from esperados_triggers et
  where not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relname = et.tabela and t.tgname = et.nome)
  union all
  select 7, 'índice', ei.tabela || '.' || ei.nome, 'falta', ''
  from esperados_indices ei
  where not exists (select 1 from pg_indexes i where i.schemaname = 'public' and i.indexname = ei.nome)
  union all
  select 8, 'tabela', t.nome,
         case when c.oid is null then 'falta'
              when not c.relrowsecurity then 'RLS desligado'
              else 'sem permissão para authenticated' end, ''
  from tabelas t
  left join pg_class c on c.relname = t.nome and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  where c.oid is null or not c.relrowsecurity or not has_table_privilege('authenticated', c.oid, 'select')
  union all
  select 9, 'extensão', x.nome, 'falta', ''
  from (values {", ".join(f"({q(x)})" for x in e["extensoes"])}) x(nome)
  where not exists (select 1 from pg_extension where extname = x.nome)
  union all
  select 10, 'bucket', 'chamados', 'falta', ''
  where not exists (select 1 from storage.buckets where id = 'chamados')
) diferencas
order by ordem, objeto;""")
