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
});
