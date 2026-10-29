import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOCUMENT_TYPES, createStandardSections } from "@/data/documentation-config";

const documentEdge = readFileSync(resolve(process.cwd(), "supabase/functions/ai-generate-document/index.ts"), "utf8");
const bpmnEdge = readFileSync(resolve(process.cwd(), "supabase/functions/ai-generate-bpmn/index.ts"), "utf8");

describe("Peter v5 — documentos canônicos", () => {
  it("preserva os 13 tipos e adiciona as três variantes canônicas", () => {
    expect(DOCUMENT_TYPES).toHaveLength(17);
    expect(DOCUMENT_TYPES.slice(0, 13)).toEqual([
      "Procedimento Operacional Padrão", "Relatório de Análise do Processo", "Análise por Fase",
      "Matriz de Riscos", "Indicadores do Processo", "Plano de Ação", "Checklist Operacional",
      "Manual do Processo", "Instrução de Trabalho", "Roteiro de Treinamento", "Documento de Entrevista",
      "Documento consolidado do processo", "Documento avulso gerado por IA",
    ]);
    expect(DOCUMENT_TYPES.slice(13)).toEqual(["raci", "ficha_processo", "pop_v5", "Procedimento"]);
  });

  it("materializa as seções canônicas sem duplicar o builder", () => {
    expect(createStandardSections("raci")).toHaveLength(3);
    expect(createStandardSections("ficha_processo")).toHaveLength(7);
    const pop = createStandardSections("pop_v5");
    expect(pop).toHaveLength(11);
    expect(pop.map((section) => section.sectionTitle)).toContain("11. Histórico de Revisões");
  });

  it("roteia tipos conhecidos e preserva fallback genérico", () => {
    for (const token of ["IDENTIDADE_PETER_DOC", "PROMPT_RACI", "PROMPT_FICHA", "PROMPT_POP_V5", "PROMPT_DIAGNOSTICO_V5", "PROMPT_5W2H", "SYSTEM_PROMPT_ATUAL"]) {
      expect(documentEdge).toContain(token);
    }
    expect(documentEdge).toContain('raci: PROMPT_RACI');
    expect(documentEdge).toContain('return prompts[tipo] ?');
    expect(documentEdge).toContain(': SYSTEM_PROMPT_ATUAL');
  });

  it("inclui regras RACI, POP, Lean, ISO e 5W2H", () => {
    expect(documentEdge).toContain("EXATAMENTE 1 R e EXATAMENTE 1 A");
    expect(documentEdge).toContain("⚠️ DEFINIR R");
    expect(documentEdge).toContain("⚠️ DEFINIR A");
    for (let section = 1; section <= 11; section += 1) expect(documentEdge).toContain(`${section}.`);
    expect(documentEdge).toContain("Verbo+Objeto");
    for (const waste of ["Superprodução", "Espera", "Transporte", "Retrabalho", "Excesso de processamento", "Inventário", "Movimento", "Defeitos"]) expect(documentEdge).toContain(waste);
    expect(documentEdge).toContain("ISO 9001");
    expect(documentEdge).toContain("Inicial, Estruturado, Padronizado, Monitorado ou Otimizado");
    expect(documentEdge).toContain("O quê | Por quê | Quem | Quando | Onde | Como | Quanto");
  });

  it("valida payload BPMN pelas Etapas 1, 2 e 3", () => {
    expect(bpmnEdge).toContain("function validarDadosParaBPMN");
    expect(bpmnEdge).toContain("Nome do processo não informado (Etapa 1)");
    expect(bpmnEdge).toContain("Gatilho de início não informado (Etapa 2)");
    expect(bpmnEdge).toContain("Saída principal não informada (Etapa 2)");
    expect(bpmnEdge).toContain("Nenhuma atividade mapeada (Etapa 3)");
    expect(bpmnEdge).toContain("atividade(s) sem responsável (Etapa 3)");
    expect(bpmnEdge).toContain("status: 422");
  });

  it("exige modelagem visual e valida a estrutura mínima do XML", () => {
    for (const token of ["Pool principal", "Lane", "bpmn:UserTask", "bpmn:ServiceTask", "bpmn:ParallelGateway", "Verbo de ação", "validarXMLBPMN", "startEvent", "endEvent", "sequenceFlow", "BPMNDiagram", "BPMNShape", "IDs duplicados"]) {
      expect(bpmnEdge).toContain(token);
    }
  });
});
