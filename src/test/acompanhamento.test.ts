import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import { iniciarRoteiro } from "../../supabase/functions/_shared/roteiro-engine";

const mocks = vi.hoisted(() => ({
  existentes: { indicadores: [] as Record<string, unknown>[], acoes: [] as Record<string, unknown>[] } as Record<string, Record<string, unknown>[]>,
  inserts: [] as Array<{ tabela: string; linhas: Record<string, unknown>[] }>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => ({
      select: () => ({ match: async () => ({ data: mocks.existentes[tabela], error: null }) }),
      insert: async (linhas: Record<string, unknown>[]) => {
        mocks.inserts.push({ tabela, linhas });
        return { error: null };
      },
    }),
  },
}));

import { criarAcompanhamento } from "@/lib/acompanhamento";

function processoAprovado() {
  const estado = iniciarRoteiro(ROTEIRO_PADRAO);
  estado.analises.plano_melhoria = {
    resumoToBe: "Compras com cotação no ERP",
    melhorias: [{ titulo: "Cotação no ERP", problema: "", solucao: "", beneficio: "", prioridade: "Alta" }],
    planoAcao: [{ oque: "Configurar cotação no ERP", porque: "", quem: "[a definir]", quando: "[a definir]", onde: "", como: "", custo: "" }],
    indicadores: [{ nome: "Tempo de cotação", formula: "", sentido: "menor", meta: "≤ 2 dias", periodicidade: "Mensal", responsavel: "Comprador", motivo: "" }],
  };
  return { id: "proc-1", company_id: "empresa-1", entrevista_roteiro: estado, indicadores: [] } as unknown as Tables<"processos">;
}

describe("Acompanhamento do plano aprovado", () => {
  beforeEach(() => {
    mocks.inserts.length = 0;
    mocks.existentes.indicadores = [];
    mocks.existentes.acoes = [];
  });

  it("cria os indicadores sugeridos e as ações do 5W2H", async () => {
    await expect(criarAcompanhamento(processoAprovado(), "user-1")).resolves.toEqual({ indicadores: 1, acoes: 1 });
    expect(mocks.inserts.map((insert) => insert.tabela)).toEqual(["indicadores", "acoes"]);
    expect(mocks.inserts[0].linhas[0]).toMatchObject({ nome: "Tempo de cotação", sentido: "menor", meta: 2, processo_id: "proc-1" });
    expect(mocks.inserts[1].linhas[0]).toMatchObject({ oque: "Configurar cotação no ERP", origem: "plano_processo" });
  });

  it("não repete o que já está nos módulos", async () => {
    mocks.existentes.indicadores = [{ chave_origem: "processo:proc-1:tempodecotacao" }];
    mocks.existentes.acoes = [{ origem: "plano_processo", chave_origem: "plano:configurarcotacaonoerp" }];
    await expect(criarAcompanhamento(processoAprovado(), "user-1")).resolves.toEqual({ indicadores: 0, acoes: 0 });
    expect(mocks.inserts).toHaveLength(0);
  });
});
