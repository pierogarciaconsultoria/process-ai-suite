import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  instrucoesDoModelo,
  MAX_REFERENCIA,
  modeloSemInstrucoes,
  REGRAS_QUE_PREVALECEM,
} from "../../supabase/functions/_shared/instrucoes-documento";

const documentEdge = readFileSync(resolve(process.cwd(), "supabase/functions/ai-generate-document/index.ts"), "utf8");

const modelo = {
  id: "t1",
  name: "IT-XXX - Instrução de Trabalho",
  documentType: "Instrução de Trabalho",
  referenceContent: "Exemplo de IT aprovada: 1. Objetivo ...",
  promptConfig: {
    systemPrompt: "Escreva como o GPT de procedimentos da consultoria.",
    generationInstructions: "Use verbos no infinitivo em cada passo.",
    tone: "Técnico",
    detailLevel: "Detalhado",
    targetAudience: "Operadores do almoxarifado",
  },
};

describe("Instruções do modelo de documento", () => {
  it("leva prompt, instruções, estilo e referência para o prompt de sistema, com as regras fixas por último", () => {
    const instrucoes = instrucoesDoModelo(modelo, modelo.promptConfig);
    expect(instrucoes).toContain('## INSTRUÇÕES DO MODELO "IT-XXX - Instrução de Trabalho"');
    expect(instrucoes).toContain("Escreva como o GPT de procedimentos da consultoria.\n\nUse verbos no infinitivo em cada passo.");
    expect(instrucoes).toContain("Tom: Técnico. Nível de detalhamento: Detalhado. Público-alvo: Operadores do almoxarifado.");
    expect(instrucoes).toContain("## MATERIAL DE REFERÊNCIA DO MODELO\nExemplo de IT aprovada");
    expect(instrucoes.endsWith(REGRAS_QUE_PREVALECEM)).toBe(true);
  });

  it("usa o promptConfig do template quando o pedido não traz generationConfig", () => {
    expect(instrucoesDoModelo(modelo, null)).toContain("Use verbos no infinitivo");
  });

  it("não acrescenta nada para os documentos do resultado guiado, que não têm modelo configurado", () => {
    expect(instrucoesDoModelo({ id: "raci", name: "Matriz RACI", documentType: "raci" }, { documentType: "raci" })).toBe("");
    expect(instrucoesDoModelo(null, null)).toBe("");
  });

  it("limita o material de referência", () => {
    const longo = instrucoesDoModelo({ ...modelo, referenceContent: "x".repeat(MAX_REFERENCIA + 5_000) }, null);
    expect(longo).toContain("x".repeat(MAX_REFERENCIA));
    expect(longo).not.toContain("x".repeat(MAX_REFERENCIA + 1));
  });

  it("tira as instruções dos dados do pedido para não enviá-las duas vezes", () => {
    expect(modeloSemInstrucoes(modelo)).toEqual({ id: "t1", name: "IT-XXX - Instrução de Trabalho", documentType: "Instrução de Trabalho" });
  });

  it("a edge function põe as instruções do modelo antes das regras fixas e do formato JSON", () => {
    expect(documentEdge).toContain("instrucoesDoModelo(template, generationConfig)");
    expect(documentEdge).toContain("promptDoTipo.replace(SYSTEM_PROMPT_ATUAL, `${instrucoes}\\n\\n${SYSTEM_PROMPT_ATUAL}`)");
    expect(documentEdge).toContain("template: modeloSemInstrucoes(template)");
  });
});
