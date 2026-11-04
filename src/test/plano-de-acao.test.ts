import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { acoesAindaNaoEnviadas, acoesDoPlano, estaAtrasada, formatarPrazo, interpretarPrazo, resumirAcoes, type Acao } from "@/lib/plano-de-acao";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import { iniciarRoteiro } from "../../supabase/functions/_shared/roteiro-engine";

function processoComPlano(planoAcao: Array<Record<string, string>>) {
  const estado = iniciarRoteiro(ROTEIRO_PADRAO);
  estado.analises.plano_melhoria = {
    resumoToBe: "Compras com cotação no ERP",
    melhorias: [{ titulo: "Cotação no ERP", problema: "", solucao: "", beneficio: "", prioridade: "Alta" }],
    planoAcao: planoAcao.map((acao) => ({ oque: "", porque: "", quem: "", quando: "", onde: "", como: "", custo: "", ...acao })),
  };
  return { id: "proc-1", company_id: "empresa-1", entrevista_roteiro: estado } as unknown as Tables<"processos">;
}

function acao(extra: Partial<Acao>): Acao {
  return { id: "a1", company_id: "empresa-1", processo_id: "proc-1", origem: "manual", chave_origem: null, oque: "Cotar", porque: "", onde: "", como: "", quem: "",
    prazo: null, quando_texto: "", custo: "", status: "A fazer", concluida_em: null, resultado: "", created_by: null, updated_by: null,
    created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", ...extra };
}

describe("Plano de Ação", () => {
  it("entende os prazos escritos no plano e deixa o resto como texto", () => {
    expect(interpretarPrazo("15/12/2026")).toBe("2026-12-15");
    expect(interpretarPrazo("2026-12-15")).toBe("2026-12-15");
    expect(interpretarPrazo("12/2026")).toBe("2026-12-31");
    expect(interpretarPrazo("Fevereiro de 2027")).toBe("2027-02-28");
    expect(interpretarPrazo("março/2027")).toBe("2027-03-31");
    expect(interpretarPrazo("dez 2026")).toBe("2026-12-31");
    expect(interpretarPrazo("[a definir]")).toBeNull();
    expect(interpretarPrazo("1º trimestre")).toBeNull();
    expect(interpretarPrazo("31/02/2026")).toBeNull();
  });

  it("transforma o 5W2H em ações, uma por item, sem repetir", () => {
    const processo = processoComPlano([
      { oque: "Configurar cotação no ERP", quem: "[a definir]", quando: "[a definir]", porque: "Reduzir prazo" },
      { oque: "Treinar compradores", quem: "Coordenadora de compras", quando: "12/2026" },
      { oque: "configurar  cotação no ERP" },
    ]);
    const novas = acoesDoPlano(processo, "user-1");
    expect(novas).toHaveLength(2);
    expect(novas[0]).toMatchObject({
      company_id: "empresa-1", processo_id: "proc-1", origem: "plano_processo", chave_origem: "plano:configurarcotacaonoerp",
      oque: "Configurar cotação no ERP", quem: "[a definir]", prazo: null, quando_texto: "[a definir]", porque: "Reduzir prazo", created_by: "user-1",
    });
    expect(novas[1]).toMatchObject({ prazo: "2026-12-31", quando_texto: "" });
  });

  it("envia só as ações do plano que ainda não estão no Plano de Ação", () => {
    const processo = processoComPlano([{ oque: "Configurar cotação no ERP" }, { oque: "Treinar compradores" }]);
    const existentes = [acao({ origem: "plano_processo", chave_origem: "plano:configurarcotacaonoerp" })];
    expect(acoesAindaNaoEnviadas(processo, existentes, "user-1").map((novo) => novo.oque)).toEqual(["Treinar compradores"]);
  });

  it("marca como atrasada só a ação aberta com prazo vencido", () => {
    expect(estaAtrasada(acao({ prazo: "2026-11-01" }), "2026-11-04")).toBe(true);
    expect(estaAtrasada(acao({ prazo: "2026-11-04" }), "2026-11-04")).toBe(false);
    expect(estaAtrasada(acao({ prazo: "2026-11-01", status: "Concluída" }), "2026-11-04")).toBe(false);
    expect(estaAtrasada(acao({ prazo: null }), "2026-11-04")).toBe(false);
    expect(formatarPrazo(acao({ prazo: "2026-12-31" }))).toBe("31/12/2026");
    expect(formatarPrazo(acao({ quando_texto: "1º trimestre" }))).toBe("1º trimestre");
    expect(formatarPrazo(acao({}))).toBe("[a definir]");
    expect(resumirAcoes([acao({ prazo: "2026-01-01" }), acao({ status: "Em andamento" }), acao({ status: "Concluída" })], "2026-11-04"))
      .toEqual({ aFazer: 1, emAndamento: 1, atrasadas: 1, concluidas: 1 });
  });
});
