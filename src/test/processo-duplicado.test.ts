import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chaveDoNome, mensagemDoErroDoProcesso, violouNomeUnico } from "@/lib/processo-duplicado";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202611030001_processo_nome_unico.sql"), "utf8");

describe("Nome do processo sem repetição", () => {
  it("ignora maiúsculas, acentos, hífens e espaços, como public.chave_nome_processo", () => {
    // Resultados conferidos na função SQL da migration.
    expect(chaveDoNome("COOPERA - PÓS VENDAS - AS IS")).toBe("cooperaposvendasasis");
    expect(chaveDoNome("coopera   pos-vendas AS IS")).toBe("cooperaposvendasasis");
    expect(chaveDoNome("Pós-vendas")).toBe("posvendas");
    expect(chaveDoNome("  Ação   Ñandú ÇÃO ")).toBe("acaonanducao");
    expect(chaveDoNome("Compras (MRO) 2026")).toBe("comprasmro2026");
    expect(chaveDoNome("COOPERA - PÓS VENDAS - TO BE")).not.toBe(chaveDoNome("COOPERA - PÓS VENDAS - AS IS"));
    expect(chaveDoNome("")).toBe("");
    expect(chaveDoNome(null)).toBe("");
  });

  it("usa a mesma tabela de acentos que a migration", () => {
    expect(migration).toContain("'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ'");
    expect(migration).toContain("'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'");
    expect(migration).toContain("where public.chave_nome_processo(nome) <> '' and status <> 'Obsoleto'");
  });

  it("traduz a recusa do banco para uma mensagem clara", () => {
    const erro = { code: "23505", message: 'duplicate key value violates unique constraint "processos_nome_unico"' };
    expect(violouNomeUnico(erro)).toBe(true);
    expect(violouNomeUnico({ code: "23505", message: "outra constraint" })).toBe(false);
    expect(mensagemDoErroDoProcesso(erro, "padrão")).toMatch(/Já existe um processo com esse nome/);
    expect(mensagemDoErroDoProcesso({ message: "sem conexão" }, "padrão")).toBe("sem conexão");
    expect(mensagemDoErroDoProcesso(undefined, "padrão")).toBe("padrão");
  });
});
