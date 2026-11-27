import { describe, expect, it } from "vitest";
import { nomesNovos, pessoasDaDistribuicao } from "@/lib/estrutura-empresa";

describe("nomesNovos", () => {
  it("ignora vazios, repetidos e os que já existem, sem diferenciar maiúsculas", () => {
    expect(nomesNovos(["COMPRADOR", " Comprador ", "", null, "Analista  de faturamento", "Gerente"], ["gerente"])).toEqual([
      "COMPRADOR",
      "Analista de faturamento",
    ]);
  });
});

describe("pessoasDaDistribuicao", () => {
  const cargos = [
    { id: "comprador", setor_id: "compras" },
    { id: "gerente", setor_id: "compras" },
    { id: "faturista", setor_id: "financeiro" },
  ];
  const pessoas = [
    { id: "ana", cargo_id: "comprador", ativa: true },
    { id: "bia", cargo_id: "gerente", ativa: true },
    { id: "caio", cargo_id: "faturista", ativa: true },
    { id: "davi", cargo_id: "faturista", ativa: false },
    { id: "eva", cargo_id: null, ativa: true },
  ];

  it("junta as pessoas dos setores e dos cargos escolhidos, só as ativas", () => {
    expect(pessoasDaDistribuicao(pessoas, cargos, ["compras"], ["faturista"]).map((p) => p.id)).toEqual(["ana", "bia", "caio"]);
  });

  it("sem escolha não traz ninguém", () => {
    expect(pessoasDaDistribuicao(pessoas, cargos, [], [])).toEqual([]);
  });
});
