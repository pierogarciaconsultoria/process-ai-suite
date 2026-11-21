import { describe, expect, it } from "vitest";
import { blocoDeNormas } from "../../supabase/functions/_shared/normas-empresa";

describe("bloco de normas no prompt", () => {
  it("fica vazio sem normas válidas", () => {
    expect(blocoDeNormas([])).toBe("");
    expect(blocoDeNormas([{ nome: " ", requisitos: "x" }])).toBe("");
  });

  it("inclui cada norma com o nome e manda citar o item", () => {
    const bloco = blocoDeNormas([
      { nome: "ISO 9001:2015", requisitos: "8.5.1 Critérios de aceitação" },
      { nome: "Contrato Cliente X", requisitos: "Entrega em 48h" },
    ]);
    expect(bloco).toContain("### ISO 9001:2015\n8.5.1 Critérios de aceitação");
    expect(bloco).toContain("### Contrato Cliente X");
    expect(bloco).toContain("Não invente itens");
    expect(bloco).not.toContain("cortado");
  });

  it("corta pelo limite e avisa o modelo", () => {
    const bloco = blocoDeNormas([
      { nome: "A", requisitos: "a".repeat(80) },
      { nome: "B", requisitos: "b".repeat(80) },
    ], 100);
    expect(bloco).toContain("a".repeat(80));
    expect(bloco).toContain("b".repeat(20));
    expect(bloco).not.toContain("b".repeat(21));
    expect(bloco).toContain("foi cortado");
  });

  it("norma longa: escolhe os itens ligados ao processo e pula a capa", () => {
    const capa = "Prefácio publicado pelo secretariado central em Genebra. ".repeat(40);
    const norma = [
      capa,
      "8.4.1 Generalidades A organização deve avaliar e reavaliar fornecedores externos de compras.",
      "7.1.5 Recursos de monitoramento e medição calibrados e rastreáveis.",
      "8.5.1 Controle de produção com critérios de aceitação documentados.",
    ].join(" ");
    const bloco = blocoDeNormas([{ nome: "ISO 9001", requisitos: norma }], 300, "Processo de compras: avaliar fornecedores antes do pedido");
    expect(bloco).toContain("8.4.1 Generalidades");
    expect(bloco).not.toContain("Prefácio");
    expect(bloco).not.toContain("7.1.5");
    expect(bloco).toContain("trechos mais ligados");
  });

  it("norma longa sem contexto útil: corta no limite como antes", () => {
    const bloco = blocoDeNormas([{ nome: "A", requisitos: "a".repeat(200) }], 100, "");
    expect(bloco).toContain("foi cortado");
  });
});
