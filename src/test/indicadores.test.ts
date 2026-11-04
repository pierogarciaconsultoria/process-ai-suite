import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import { iniciarRoteiro } from "../../supabase/functions/_shared/roteiro-engine";
import {
  acaoParaResultadoFora,
  formatarMeta,
  formatarValor,
  indicadoresAindaNaoEnviados,
  indicadoresDoProcesso,
  lerMeta,
  lerNumero,
  rotuloPeriodo,
  situacao,
  ultimaMedicao,
  ultimosPeriodos,
  type Indicador,
  type Medicao,
} from "@/lib/indicadores";

function indicador(extra: Partial<Indicador>): Indicador {
  return { id: "i1", company_id: "empresa-1", processo_id: "proc-1", chave_origem: null, nome: "Entregas no prazo", objetivo: "", formula: "", unidade: "%",
    sentido: "maior", meta: 95, meta_texto: "", periodicidade: "Mensal", responsavel: "Coordenadora", ativo: true, created_by: null, updated_by: null,
    created_at: "", updated_at: "", ...extra };
}

function medicao(extra: Partial<Medicao>): Medicao {
  return { id: "m1", company_id: "empresa-1", indicador_id: "i1", periodo: "2026-10-01", valor: 90, comentario: "", created_by: null, updated_by: null,
    created_at: "", updated_at: "", ...extra };
}

describe("Indicadores", () => {
  it("lê números no formato brasileiro", () => {
    expect(lerNumero("92,5")).toBe(92.5);
    expect(lerNumero("1.234,5")).toBe(1234.5);
    expect(lerNumero("10.000")).toBe(10000);
    expect(lerNumero("2.5")).toBe(2.5);
    expect(lerNumero("abc")).toBeNull();
    expect(lerNumero("")).toBeNull();
  });

  it("entende a meta escrita no mapeamento", () => {
    expect(lerMeta("≥ 95%")).toEqual({ meta: 95, sentido: "maior", unidade: "%" });
    expect(lerMeta("Até 2 dias")).toEqual({ meta: 2, sentido: "menor", unidade: "dias" });
    expect(lerMeta("menos de 3 reclamações por mês")).toEqual({ meta: 3, sentido: "menor", unidade: "" });
    expect(lerMeta("R$ 10.000 por mês")).toEqual({ meta: 10000, sentido: "maior", unidade: "R$" });
    expect(lerMeta("reduzir pela metade")).toEqual({ meta: null, sentido: "menor", unidade: "" });
  });

  it("transforma os indicadores do mapeamento em indicadores acompanhados, sem repetir", () => {
    const processo = {
      id: "proc-1", company_id: "empresa-1", nome: "Compras",
      indicadores: [
        { nome: "Entregas no prazo", objetivo: "Cumprir prazos", formulaCalculo: "no prazo ÷ total × 100", meta: "≥ 95%", periodicidade: "Mensal", responsavel: "Coordenadora" },
        { nome: "Tempo de cotação", objetivo: "", formulaCalculo: "", meta: "reduzir pela metade", periodicidade: "trimestral", responsavel: "" },
        { nome: "entregas  no prazo", objetivo: "", formulaCalculo: "", meta: "", periodicidade: "", responsavel: "" },
        { nome: "", objetivo: "", formulaCalculo: "", meta: "", periodicidade: "", responsavel: "" },
      ],
    } as unknown as Tables<"processos">;
    const novos = indicadoresDoProcesso(processo, "user-1");
    expect(novos).toHaveLength(2);
    expect(novos[0]).toMatchObject({
      processo_id: "proc-1", chave_origem: "processo:proc-1:entregasnoprazo", nome: "Entregas no prazo", formula: "no prazo ÷ total × 100",
      meta: 95, sentido: "maior", unidade: "%", meta_texto: "", periodicidade: "Mensal", responsavel: "Coordenadora", created_by: "user-1",
    });
    expect(novos[1]).toMatchObject({ meta: null, meta_texto: "reduzir pela metade", sentido: "menor", periodicidade: "Trimestral" });
    expect(indicadoresAindaNaoEnviados(processo, [indicador({ chave_origem: "processo:proc-1:entregasnoprazo" })], "user-1").map((item) => item.nome))
      .toEqual(["Tempo de cotação"]);
  });

  it("junta os indicadores citados na entrevista com os sugeridos pelo Peter no plano", () => {
    const estado = iniciarRoteiro(ROTEIRO_PADRAO);
    estado.analises.plano_melhoria = {
      resumoToBe: "Compras com cotação no ERP",
      melhorias: [],
      planoAcao: [],
      indicadores: [
        { nome: "Entregas no prazo", formula: "repetido", sentido: "maior", meta: "[a definir]", periodicidade: "Mensal", responsavel: "[a definir]", motivo: "" },
        { nome: "Tempo de cotação", formula: "dias entre requisição e cotação", sentido: "menor", meta: "≤ 2 dias", periodicidade: "Mensal", responsavel: "Comprador", motivo: "Cotação lenta" },
        { nome: "Retrabalho em pedidos", formula: "pedidos corrigidos ÷ pedidos", sentido: "menor", meta: "[a definir]", periodicidade: "Trimestral", responsavel: "[a definir]", motivo: "Erros de cadastro" },
      ],
    };
    const processo = {
      id: "proc-1", company_id: "empresa-1", entrevista_roteiro: estado,
      indicadores: [{ nome: "Entregas no prazo", objetivo: "", formulaCalculo: "no prazo ÷ total", meta: "≥ 95%", periodicidade: "Mensal", responsavel: "Ana" }],
    } as unknown as Tables<"processos">;
    const novos = indicadoresDoProcesso(processo, "user-1");
    expect(novos.map((item) => item.nome)).toEqual(["Entregas no prazo", "Tempo de cotação", "Retrabalho em pedidos"]);
    expect(novos[0]).toMatchObject({ formula: "no prazo ÷ total", meta: 95 });
    expect(novos[1]).toMatchObject({ sentido: "menor", meta: 2, unidade: "dias", responsavel: "Comprador", objetivo: "Cotação lenta" });
    expect(novos[2]).toMatchObject({ sentido: "menor", meta: null, meta_texto: "[a definir]", periodicidade: "Trimestral" });
  });

  it("compara o resultado com a meta no sentido certo", () => {
    expect(situacao(indicador({}), 96)).toBe("dentro");
    expect(situacao(indicador({}), 95)).toBe("dentro");
    expect(situacao(indicador({}), 90)).toBe("fora");
    expect(situacao(indicador({ sentido: "menor", meta: 2 }), 3)).toBe("fora");
    expect(situacao(indicador({ sentido: "menor", meta: 2 }), 1.5)).toBe("dentro");
    expect(situacao(indicador({ meta: null }), 90)).toBe("sem_meta");
    expect(situacao(indicador({}), undefined)).toBe("sem_resultado");
    expect(formatarMeta(indicador({}))).toBe("≥ 95%");
    expect(formatarMeta(indicador({ sentido: "menor", meta: 2, unidade: "dias" }))).toBe("≤ 2 dias");
    expect(formatarMeta(indicador({ meta: null, meta_texto: "reduzir pela metade" }))).toBe("reduzir pela metade");
    expect(formatarValor(1234.5, "R$")).toBe("R$ 1.234,5");
  });

  it("monta os últimos meses e acha o resultado mais recente", () => {
    expect(ultimosPeriodos(3, new Date(2026, 0, 15))).toEqual(["2025-11-01", "2025-12-01", "2026-01-01"]);
    expect(rotuloPeriodo("2026-11-01")).toBe("nov/26");
    const lista = [medicao({ id: "a", periodo: "2026-09-01" }), medicao({ id: "b", periodo: "2026-10-01" }), medicao({ id: "c", indicador_id: "outro", periodo: "2026-12-01" })];
    expect(ultimaMedicao(lista, "i1")?.id).toBe("b");
  });

  it("resultado fora da meta vira ação com origem no indicador", () => {
    expect(acaoParaResultadoFora(indicador({}), medicao({}), "user-1")).toMatchObject({
      company_id: "empresa-1", processo_id: "proc-1", origem: "indicador", chave_origem: "indicador:i1:2026-10-01",
      oque: 'Tratar o resultado fora da meta de "Entregas no prazo" (out/26)', porque: "Resultado 90%; meta ≥ 95%.", quem: "Coordenadora",
    });
  });
});
