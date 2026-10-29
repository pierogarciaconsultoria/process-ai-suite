"""Simula as migrations em ordem e imprime o estado final esperado do schema public."""
import glob, json, os, re, sys
from pathlib import Path

pasta = sys.argv[1]
tabelas, colunas, funcoes, policies, triggers, indices, extensoes = {}, set(), {}, {}, set(), set(), set()

def limpa(sql):
    sql = re.sub(r"--[^\n]*", "", sql)
    return sql

def nome(n):
    return n.replace('"', "").split(".")[-1].lower()

for arq in sorted(glob.glob(os.path.join(pasta, "*.sql"))):
    sql = limpa(Path(arq).read_text())
    # separa corpos $$ ... $$ para não confundir com comandos
    partes = re.split(r"(\$\$.*?\$\$)", sql, flags=re.S)
    texto = "".join(p if not p.startswith("$$") else "$$" for p in partes)
    for cmd in texto.split(";"):
        c = " ".join(cmd.split()).lower()
        if not c:
            continue
        m = re.match(r"create extension (?:if not exists )?\"?([a-z_]+)", c)
        if m: extensoes.add(m.group(1)); continue
        m = re.match(r"create table (?:if not exists )?([a-z_.\"]+) \((.*)\)", c)
        if m:
            t = nome(m.group(1)); tabelas[t] = os.path.basename(arq)
            corpo = m.group(2); nivel = 0; atual = ""; itens = []; aspas = False
            for ch in corpo:
                if ch == "'": aspas = not aspas
                if not aspas and ch == "(": nivel += 1
                if not aspas and ch == ")": nivel -= 1
                if ch == "," and nivel == 0 and not aspas: itens.append(atual); atual = ""
                else: atual += ch
            itens.append(atual)
            for it in itens:
                it = it.strip()
                if not it or re.match(r"(constraint|primary key|unique|foreign key|check|exclude)\b", it): continue
                colunas.add((t, nome(it.split()[0])))
            continue
        m = re.match(r"drop table (?:if exists )?([a-z_.\"]+)", c)
        if m: t = nome(m.group(1)); tabelas.pop(t, None); colunas = {x for x in colunas if x[0] != t}; continue
        m = re.match(r"alter table (?:if exists )?(?:only )?([a-z_.\"]+) (.*)", c)
        if m:
            t = nome(m.group(1))
            for acao in re.split(r",\s*(?=add |drop |alter |rename )", m.group(2)):
                a = re.match(r"add column (?:if not exists )?\"?([a-z_]+)", acao)
                if a: colunas.add((t, a.group(1)))
                d = re.match(r"drop column (?:if exists )?\"?([a-z_]+)", acao)
                if d: colunas.discard((t, d.group(1)))
                r = re.match(r"rename column \"?([a-z_]+)\"? to \"?([a-z_]+)", acao)
                if r: colunas.discard((t, r.group(1))); colunas.add((t, r.group(2)))
            continue
        m = re.match(r"create (?:or replace )?function ([a-z_.\"]+)\s*\(", c)
        if m:
            f = nome(m.group(1)); funcoes[f] = ("security definer" in c)
            continue
        m = re.match(r"drop function (?:if exists )?([a-z_.\"]+)", c)
        if m: funcoes.pop(nome(m.group(1)), None); continue
        m = re.match(r"create policy (\"[^\"]+\"|[a-z_0-9]+) on ([a-z_.\"]+)", c)
        if m: policies[(nome(m.group(2)), m.group(1).replace('"', ""))] = os.path.basename(arq); continue
        m = re.match(r"drop policy (?:if exists )?(\"[^\"]+\"|[a-z_0-9]+) on ([a-z_.\"]+)", c)
        if m: policies.pop((nome(m.group(2)), m.group(1).replace('"', "")), None); continue
        m = re.match(r"create trigger ([a-z_]+) .* on ([a-z_.\"]+)", c)
        if m: triggers.add((nome(m.group(2)), m.group(1))); continue
        m = re.match(r"drop trigger (?:if exists )?([a-z_]+) on ([a-z_.\"]+)", c)
        if m: triggers.discard((nome(m.group(2)), m.group(1))); continue
        m = re.match(r"create (?:unique )?index (?:concurrently )?(?:if not exists )?([a-z_]+) on ([a-z_.\"]+)", c)
        if m: indices.add((nome(m.group(2)), m.group(1))); continue
        m = re.match(r"drop index (?:if exists )?([a-z_.\"]+)", c)
        if m: n = nome(m.group(1)); indices = {x for x in indices if x[1] != n}; continue

print(json.dumps({
    "extensoes": sorted(extensoes), "tabelas": sorted(tabelas), "colunas": sorted(colunas),
    "funcoes": dict(sorted(funcoes.items())), "policies": sorted(policies), "triggers": sorted(triggers), "indices": sorted(indices),
}, ensure_ascii=False))
