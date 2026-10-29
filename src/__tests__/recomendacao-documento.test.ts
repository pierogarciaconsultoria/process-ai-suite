import { beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultDocumentationState,
  createStandardSections,
  loadDocumentationState,
  recomendarTipoDocumento,
  storageKeyForDocumentation,
} from "@/data/documentation-config";

describe("Recomendação PR ou IT", () => {
  it("recomenda Procedimento quando as atividades passam por vários cargos", () => {
    const recomendacao = recomendarTipoDocumento([
      { atividade: "Emitir o pedido de venda", responsavel: "Vendedor corporativo" },
      { atividade: "Consultar pedido liberado", responsavel: "Analista de faturamento" },
      { atividade: "Analisar a prioridade", responsavel: "ANALISTA DE FATURAMENTO" },
      { atividade: "Separar o material", responsavel: "Auxiliar de almoxarifado" },
    ]);
    expect(recomendacao.documentType).toBe("Procedimento");
    expect(recomendacao.motivo).toContain("3 cargos ou áreas (Vendedor corporativo, Analista de faturamento, Auxiliar de almoxarifado)");
  });

  it("recomenda Instrução de Trabalho quando um só cargo executa tudo", () => {
    const recomendacao = recomendarTipoDocumento([
      { atividade: "Separar o material", responsavel: "Auxiliar de almoxarifado" },
      { atividade: "Dar check no item", responsavel: "auxiliar de almoxarifado" },
      { atividade: "", responsavel: "Outro cargo" },
    ]);
    expect(recomendacao).toMatchObject({ documentType: "Instrução de Trabalho" });
    expect(recomendacao.motivo).toContain("um só cargo (Auxiliar de almoxarifado)");
  });

  it("recomenda Procedimento quando não há responsáveis definidos", () => {
    expect(recomendarTipoDocumento([{ atividade: "Separar", responsavel: "" }]).documentType).toBe("Procedimento");
  });

  it("resume a lista de cargos quando são muitos", () => {
    const etapas = ["A", "B", "C", "D", "E", "F"].map((cargo) => ({ atividade: "Fazer", responsavel: cargo }));
    expect(recomendarTipoDocumento(etapas).motivo).toContain("6 cargos ou áreas (A, B, C, D e mais 2)");
  });
});

describe("Modelo PR - Procedimento", () => {
  beforeEach(() => localStorage.clear());

  it("vem nos modelos padrão com as seções de um procedimento", () => {
    const modelo = createDefaultDocumentationState("empresa-1", "user-1").templates.find((template) => template.documentType === "Procedimento");
    expect(modelo?.name).toBe("PR-XXX - Procedimento");
    expect(createStandardSections("Procedimento").map((section) => section.sectionTitle)).toContain("Pontos de decisão e fluxos alternativos");
  });

  it("é acrescentado às configurações salvas antes dele, sem mexer nos modelos existentes", () => {
    const antigo = createDefaultDocumentationState("empresa-1", "user-1");
    antigo.templates = antigo.templates.filter((template) => template.documentType !== "Procedimento");
    antigo.templates[0].promptConfig.systemPrompt = "Instruções do GPT";
    localStorage.setItem(storageKeyForDocumentation("empresa-1"), JSON.stringify(antigo));

    const carregado = loadDocumentationState("empresa-1", "user-1");
    expect(carregado.templates).toHaveLength(antigo.templates.length + 1);
    expect(carregado.templates[0].promptConfig.systemPrompt).toBe("Instruções do GPT");
    expect(carregado.templates.at(-1)?.documentType).toBe("Procedimento");
  });
});
