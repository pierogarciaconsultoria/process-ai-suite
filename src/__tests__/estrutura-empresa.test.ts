import { describe, expect, it } from "vitest";
import { nomesNovos } from "@/lib/estrutura-empresa";

describe("nomesNovos", () => {
  it("ignora vazios, repetidos e os que já existem, sem diferenciar maiúsculas", () => {
    expect(nomesNovos(["COMPRADOR", " Comprador ", "", null, "Analista  de faturamento", "Gerente"], ["gerente"])).toEqual([
      "COMPRADOR",
      "Analista de faturamento",
    ]);
  });
});
