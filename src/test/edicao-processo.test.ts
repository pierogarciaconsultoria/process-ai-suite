import { describe, expect, it } from "vitest";
import { atualizacaoDaSecao, camposDaSecao, lerEstadoDoProcesso, rascunhoDaSecao } from "@/lib/edicao-processo";
import { montarRelatorio } from "@/lib/relatorio-processo";
import type { Tables } from "@/integrations/supabase/types";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import { aplicarRespostasExtraidas, iniciarRoteiro } from "../../supabase/functions/_shared/roteiro-engine";

function linha(extra: Record<string, unknown> = {}) {
  return {
    id: "proc-1", company_id: "empresa-1", status: "Implementado", nome: "Compras", data_mapeamento: "2026-10-26", analista: "",
    classificacao: "Apoio", area: "Suprimentos", responsavel: "Gerente", entrevistados: "Ana", objetivo: "Comprar no prazo",
    cliente_processo: "", areas_envolvidas: "", gatilho: "Requisição", entradas: [{ fornecedor: "Solicitante", entrada: "Requisição" }],
    etapas: [{ ordem: 1, atividade: "Cotar", responsavel: "Comprador", ferramentaDocumento: "ERP" }], decisoes: "", saidas: [], recursos: "",
    problemas: {}, problemas_texto: "", riscos_texto: "", riscos: [], indicadores: [], oportunidades_melhoria: "", plano_acao: [],
    bpmn_as_is: "", bpmn_to_be: "", diagnostico: null, entrevista_roteiro: null, interview_messages: [{ role: "user", content: "oi" }],
    mapa_revisao: "Rev.02", mapa_aprovado_em: null, implementado_em: null, created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T10:00:00Z",
    ...extra,
  } as unknown as Tables<"processos">;
}

function comEntrevista() {
  const estado = aplicarRespostasExtraidas(ROTEIRO_PADRAO, iniciarRoteiro(ROTEIRO_PADRAO), [
    { perguntaId: "e3.decisoes", texto: "Aprovar acima de R$ 5 mil" },
    { perguntaId: "e1.frequencia", texto: "Diária, 30 pedidos" },
    { perguntaId: "e2.gatilho", texto: "Requisição aprovada" },
  ], "entrevista");
  estado.etapaAtual = 7;
  estado.etapasConfirmadas = [1, 2, 3, 4, 5, 6];
  estado.analises.plano_melhoria = {
    resumoToBe: "Compras com cotação no ERP",
    melhorias: [{ titulo: "Cotação no ERP", problema: "", solucao: "", beneficio: "", prioridade: "Alta" }],
    planoAcao: [{ oque: "Configurar cotação no ERP", porque: "Reduzir prazo", quem: "[a definir]", quando: "[a definir]", onde: "", como: "", custo: "" }],
  };
  return linha({ entrevista_roteiro: estado });
}

describe("Edição do processo por seção", () => {
  it("grava só o que mudou, sem tocar em status, revisão ou conversa", () => {
    const row = linha();
    const rascunho = rascunhoDaSecao(row, "dados");
    expect(rascunho.textos).toMatchObject({ nome: "Compras", dono: "Gerente", data: "2026-10-26" });
    const atualizacao = atualizacaoDaSecao(row, "dados", { ...rascunho, textos: { ...rascunho.textos, dono: "Coordenadora de compras" } }, "user-1");
    expect(atualizacao).toEqual({ updated_by: "user-1", responsavel: "Coordenadora de compras" });
  });

  it("sem entrevista, mostra só os campos que têm onde gravar", () => {
    const chaves = camposDaSecao("atividades", lerEstadoDoProcesso(linha())).map((campo) => campo.chave);
    expect(chaves).toEqual(["decisoes"]);
    expect(camposDaSecao("atividades", lerEstadoDoProcesso(comEntrevista())).length).toBeGreaterThan(1);
  });

  it("com entrevista, atualiza a coluna e a resposta, e o relatório mostra a correção", () => {
    const row = comEntrevista();
    const rascunho = rascunhoDaSecao(row, "atividades");
    expect(rascunho.textos.decisoes).toBe("Aprovar acima de R$ 5 mil");
    const atualizacao = atualizacaoDaSecao(row, "atividades", { ...rascunho, textos: { ...rascunho.textos, decisoes: "Aprovar acima de R$ 10 mil" } }, "user-1");
    expect(atualizacao.decisoes).toBe("Aprovar acima de R$ 10 mil");
    const relatorio = montarRelatorio({ ...row, ...atualizacao } as Tables<"processos">);
    expect(relatorio.fluxo).toContainEqual({ rotulo: "Decisões", valor: "Aprovar acima de R$ 10 mil" });
  });

  it("apagar uma resposta vira informação pendente, sem reabrir a entrevista", () => {
    const row = comEntrevista();
    const rascunho = rascunhoDaSecao(row, "identificacao");
    const atualizacao = atualizacaoDaSecao(row, "identificacao", { ...rascunho, textos: { ...rascunho.textos, frequencia: "" } }, "user-1");
    const estado = lerEstadoDoProcesso({ ...row, ...atualizacao } as Tables<"processos">);
    expect(estado?.respostas["e1.frequencia"]).toMatchObject({ status: "lacuna", textos: [] });
    expect(montarRelatorio({ ...row, ...atualizacao } as Tables<"processos">).lacunas).toContain("Frequência");
  });

  it("o início do SIPOC é o gatilho, e as listas descartam linhas vazias", () => {
    const row = comEntrevista();
    const rascunho = rascunhoDaSecao(row, "sipoc");
    expect(rascunho.textos.gatilho).toBe("Requisição aprovada");
    const atualizacao = atualizacaoDaSecao(row, "sipoc", {
      ...rascunho,
      textos: { gatilho: "Requisição no ERP" },
      saidas: [{ saida: "Pedido de compra", cliente: "Fornecedor" }, { saida: "", cliente: "" }],
    }, "user-1");
    expect(atualizacao.gatilho).toBe("Requisição no ERP");
    expect(atualizacao.saidas).toEqual([{ saida: "Pedido de compra", cliente: "Fornecedor" }]);
    expect(montarRelatorio({ ...row, ...atualizacao } as Tables<"processos">).sipoc.inicio).toBe("Requisição no ERP");
  });

  it("completa o 5W2H no lugar de [a definir]", () => {
    const row = comEntrevista();
    const rascunho = rascunhoDaSecao(row, "plano");
    const planoAcao = [{ ...rascunho.planoAcao[0], quem: "Coordenadora de compras", quando: "Dezembro/2026" }];
    const atualizacao = atualizacaoDaSecao(row, "plano", { ...rascunho, planoAcao }, "user-1");
    const relatorio = montarRelatorio({ ...row, ...atualizacao } as Tables<"processos">);
    expect(relatorio.plano?.planoAcao[0]).toMatchObject({ quem: "Coordenadora de compras", quando: "Dezembro/2026" });
    expect(relatorio.plano?.resumoToBe).toBe("Compras com cotação no ERP");
  });

  it("reordena as atividades e renumera", () => {
    const row = linha({ etapas: [
      { ordem: 1, atividade: "Cotar", responsavel: "Comprador", ferramentaDocumento: "" },
      { ordem: 2, atividade: "Requisitar", responsavel: "Solicitante", ferramentaDocumento: "" },
    ] });
    const rascunho = rascunhoDaSecao(row, "atividades");
    const atualizacao = atualizacaoDaSecao(row, "atividades", { ...rascunho, etapas: [rascunho.etapas[1], rascunho.etapas[0]] }, "user-1");
    expect(atualizacao.etapas).toEqual([
      { ordem: 1, atividade: "Requisitar", responsavel: "Solicitante", ferramentaDocumento: "" },
      { ordem: 2, atividade: "Cotar", responsavel: "Comprador", ferramentaDocumento: "" },
    ]);
  });
});
