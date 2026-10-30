import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { montarRelatorio } from "@/lib/relatorio-processo";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import {
  concluirAcao,
  confirmarEtapa,
  iniciarRoteiro,
  proximoPasso,
  registrarResposta,
  type EstadoRoteiro,
} from "../../supabase/functions/_shared/roteiro-engine";

const roteiro = ROTEIRO_PADRAO;

const diagnostico = {
  resumo: "Processo dependente do gerente.",
  pontosFortes: [],
  achados: [],
  desperdiciosLean: [],
  riscosIso: [],
  maturidade: { nivel: "Inicial", justificativa: "Informal" },
  lacunas: ["Volume mensal", "Meta de prazo"],
};

const plano = {
  resumoToBe: "Aprovação com alçada.",
  melhorias: [{ titulo: "Alçada", problema: "", solucao: "Alçada por valor", beneficio: "", prioridade: "Alta" }],
  planoAcao: [
    { oque: "Publicar política de alçada", porque: "", quem: "Gerente financeiro", quando: "30 dias", onde: "", como: "", custo: "Baixo" },
    { oque: "Treinar compradores", porque: "", quem: "", quando: "", onde: "", como: "", custo: "" },
  ],
};

const respostasFixas: Record<string, string> = {
  "e1.frequencia": "Diário, cerca de 200 pedidos por mês",
  "e1.requisitos": "ISO 9001",
  "e3.decisoes": "Se o valor passa de 10 mil, vai para a diretoria",
};

// Percorre o roteiro até `ateEtapa` (inclusive), deixando a pergunta e1.area como lacuna.
function estadoAte(ateEtapa: number): EstadoRoteiro {
  let estado = iniciarRoteiro(roteiro);
  for (let i = 0; i < 300 && estado.etapaAtual <= ateEtapa; i++) {
    const passo = proximoPasso(roteiro, estado);
    if (passo.tipo === "pergunta") {
      const lacuna = passo.pergunta.id === "e1.area";
      estado = registrarResposta(roteiro, estado, {
        perguntaId: passo.pergunta.id,
        texto: lacuna ? "" : respostasFixas[passo.pergunta.id] ?? "ok",
        suficiente: !lacuna,
        valor: passo.pergunta.tipo === "sim_nao" ? "sim" : undefined,
        encerraRepeticao: true,
      });
      if (lacuna) estado = registrarResposta(roteiro, estado, { perguntaId: passo.pergunta.id, texto: "", suficiente: false });
    } else if (passo.tipo === "acao_ia") {
      estado = concluirAcao(roteiro, estado, passo.acao, passo.acao === "diagnostico_as_is" ? diagnostico : plano);
    } else if (passo.tipo === "confirmar_etapa") {
      estado = confirmarEtapa(roteiro, estado);
    } else {
      break;
    }
  }
  return estado;
}

function linha(extra: Partial<Tables<"processos">> = {}): Tables<"processos"> {
  return {
    id: "proc-1", company_id: "empresa-1", status: "Em revisão", nome: "Compras", data_mapeamento: "2026-10-26",
    analista: "", classificacao: "Apoio", area: "Suprimentos", responsavel: "Gerente de compras", entrevistados: "Ana",
    objetivo: "Comprar no prazo", cliente_processo: "Produção", areas_envolvidas: "", gatilho: "Requisição de compra",
    entradas: [
      { fornecedor: "Produção", entrada: "Requisição" },
      { fornecedor: "produção", entrada: "Especificação" },
      { fornecedor: "", entrada: "" },
    ],
    etapas: Array.from({ length: 9 }, (_, i) => ({ ordem: i + 1, atividade: `Atividade ${i + 1}`, responsavel: "Comprador", ferramentaDocumento: i === 0 ? "ERP" : "" })),
    decisoes: "Aprovação acima de 10 mil", saidas: [{ saida: "Pedido de compra", cliente: "Fornecedor" }], recursos: "ERP, e-mail",
    problemas: {}, problemas_texto: "Retrabalho em cotações", riscos_texto: "", riscos: [], indicadores: [], oportunidades_melhoria: "",
    plano_acao: [], bpmn_as_is: "", bpmn_to_be: "", diagnostico: null, entrevista_roteiro: null, interview_messages: [],
    interview_session_id: null, criticidade: "Baixa", mapa_revisao: "Rev.00", mapa_aprovado_em: null, published_at: null,
    obsolete_at: null, created_by: null, updated_by: null, created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T10:00:00Z",
    ...extra,
  } as Tables<"processos">;
}

describe("Relatório do processo", () => {
  it("monta o relatório completo de uma entrevista concluída", () => {
    const estado = estadoAte(6);
    expect(proximoPasso(roteiro, estado).tipo).toBe("concluido");
    const relatorio = montarRelatorio(linha({ entrevista_roteiro: estado as never }));

    expect(relatorio.entrevista).toEqual({ concluida: true, etapa: "Entrevista concluída" });
    expect(relatorio.ficha).toContainEqual({ rotulo: "Frequência", valor: "Diário, cerca de 200 pedidos por mês" });
    expect(relatorio.ficha).toContainEqual({ rotulo: "Requisitos normativos", valor: "ISO 9001" });
    expect(relatorio.sipoc.inicio).toBe("Requisição de compra");
    expect(relatorio.sipoc.entradas).toEqual([
      { fornecedor: "Produção", entrada: "Requisição" },
      { fornecedor: "produção", entrada: "Especificação" },
    ]);
    expect(relatorio.sipoc.processo).toHaveLength(7);
    expect(relatorio.sipoc.atividadesRestantes).toBe(2);
    expect(relatorio.sipoc.saidas).toEqual([{ saida: "Pedido de compra", cliente: "Fornecedor" }]);
    expect(relatorio.atividades[0]).toEqual({ ordem: 1, atividade: "Atividade 1", responsavel: "Comprador", ferramenta: "ERP" });
    expect(relatorio.fluxo).toContainEqual({ rotulo: "Decisões", valor: "Se o valor passa de 10 mil, vai para a diretoria" });
    // Volume e erros agora chegam por outras perguntas e só aparecem quando registrados.
    expect(relatorio.medicao.map((item) => item.rotulo)).not.toContain("Volume");
    expect(relatorio.diagnostico?.maturidade.nivel).toBe("Inicial");
    expect(relatorio.plano?.melhorias).toHaveLength(1);
    expect(relatorio.proximosPassos).toEqual([
      "Publicar política de alçada — Gerente financeiro, 30 dias",
      "Treinar compradores",
    ]);
    expect(relatorio.lacunas).toEqual(["Área", "Volume mensal", "Meta de prazo"]);
  });

  it("indica relatório parcial e o próximo passo quando a entrevista está em andamento", () => {
    const relatorio = montarRelatorio(linha({ entrevista_roteiro: estadoAte(2) as never }));
    expect(relatorio.entrevista).toEqual({ concluida: false, etapa: "Etapa 3 de 6 — Passo a passo" });
    expect(relatorio.diagnostico).toBeNull();
    expect(relatorio.proximosPassos).toEqual([
      "Concluir a entrevista (Etapa 3 de 6 — Passo a passo) para gerar o diagnóstico e o plano de melhoria.",
    ]);
  });

  it("usa os campos do formulário em processos sem entrevista guiada", () => {
    const relatorio = montarRelatorio(linha());
    expect(relatorio.entrevista).toBeNull();
    expect(relatorio.ficha).toContainEqual({ rotulo: "Classificação", valor: "Apoio" });
    expect(relatorio.ficha).toContainEqual({ rotulo: "Gatilho", valor: "Requisição de compra" });
    expect(relatorio.fluxo).toEqual([{ rotulo: "Decisões", valor: "Aprovação acima de 10 mil" }]);
    expect(relatorio.medicao).toEqual([{ rotulo: "Erros e retrabalho", valor: "Retrabalho em cotações" }]);
    expect(relatorio.proximosPassos).toEqual([]);
    expect(relatorio.lacunas).toEqual([]);
  });
});
