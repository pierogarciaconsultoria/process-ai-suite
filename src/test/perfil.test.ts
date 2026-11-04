import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DESCRICAO_PERFIL, rotuloDoPerfil } from "@/lib/perfil";

describe("Perfis", () => {
  it("mostra Consultor, Gestor e Equipe no lugar dos valores gravados", () => {
    expect(rotuloDoPerfil("owner")).toBe("Consultor");
    expect(rotuloDoPerfil("admin")).toBe("Consultor");
    expect(rotuloDoPerfil("gestor")).toBe("Gestor");
    expect(rotuloDoPerfil("analista")).toBe("Equipe");
    expect(DESCRICAO_PERFIL.analista).toContain("Não excluem nem aprovam");
  });

  it("a migration restringe excluir e mudar indicadores, sem tirar a leitura", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202611050001_perfis_equipe.sql"), "utf8");
    expect(migration).toContain("array['processos', 'acoes', 'indicadores', 'indicador_medicoes']");
    expect(migration).toContain("cmd = 'DELETE'");
    expect(migration).not.toContain("cmd in ('DELETE', 'ALL')");
    expect(migration).toContain("or chave_origem like 'processo:%'");
  });
});
