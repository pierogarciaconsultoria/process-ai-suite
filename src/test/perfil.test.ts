import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DESCRICAO_PERFIL, ehConsultor, rotuloDoPerfil } from "@/lib/perfil";

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

  it("só o Consultor (dono, admin em alguma empresa ou super admin) vê a carteira", () => {
    const nada = { superAdmin: false, donoDeAlguma: false, consultorEmAlguma: false };
    expect(ehConsultor(nada)).toBe(false);
    expect(ehConsultor({ ...nada, donoDeAlguma: true })).toBe(true);
    expect(ehConsultor({ ...nada, consultorEmAlguma: true })).toBe(true);
    expect(ehConsultor({ ...nada, superAdmin: true })).toBe(true);
  });

  it("Minhas empresas fica em Configurações, protegida, e saiu do menu principal", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const menu = readFileSync(resolve(process.cwd(), "src/components/AppSidebar.tsx"), "utf8");
    expect(app).toContain('path="/configuracoes/minhas-empresas" element={<ConsultorRoute><MinhasEmpresas /></ConsultorRoute>}');
    expect(app).toContain('path="/minhas-empresas" element={<Navigate to="/configuracoes/minhas-empresas" replace />}');
    expect(menu).not.toContain('url: "/minhas-empresas"');
  });
});
