import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Peter v5 — diagnóstico", () => {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/ai-diagnose-process/index.ts"), "utf8");

  it("materializa os tipos reais no prompt exclusivo do Peter", () => {
    expect(source).toContain("const peterSystemPrompt");
    for (const field of [
      "problemaIdentificado", "solucaoProposta", "tipoTecnologia", "impactoEsperado",
      "complexidade", "prioridade", "formulaCalculo", "periodicidade", "responsavel",
    ]) expect(source).toContain(field);
    expect(source).toContain("JSON.stringify(toolSchema.function.parameters, null, 2)");
  });
});
