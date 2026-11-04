import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  linha: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  outros: [] as Record<string, unknown>[],
  acoes: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[][],
}));

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
vi.mock("@/components/relatorio/MapaBpmnImagem", () => ({ MapaBpmnImagem: () => <div>mapa</div> }));
vi.mock("@/integrations/supabase/client", () => {
  const filtroSelect = {
    eq: () => filtroSelect,
    maybeSingle: async () => ({ data: mocks.linha, error: null }),
    order: async () => ({ data: mocks.outros, error: null }),
  };
  const filtroAcoes = { eq: () => filtroAcoes, order: async () => ({ data: mocks.acoes, error: null }) };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      from: (tabela: string) => ({
        select: () => (tabela === "acoes" ? filtroAcoes : filtroSelect),
        insert: (linhas: Record<string, unknown>[]) => {
          mocks.inserts.push(linhas);
          return {
            select: async () => ({
              data: linhas.map((linha, indice) => ({ ...linha, id: `acao-${indice}`, status: "A fazer", created_at: "2026-11-04T00:00:00Z" })),
              error: null,
            }),
          };
        },
        update: (payload: Record<string, unknown>) => {
          mocks.updates.push(payload);
          const filtro = {
            eq: () => filtro,
            select: () => ({ single: async () => ({ data: { ...mocks.linha, ...payload }, error: null }) }),
          };
          return filtro;
        },
      }),
    },
  };
});

import { Toaster } from "@/components/ui/toaster";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import { iniciarRoteiro } from "../../supabase/functions/_shared/roteiro-engine";
import ProcessoDetalhe from "@/pages/ProcessoDetalhe";

function linha(status: string) {
  return {
    id: "proc-1", company_id: "empresa-1", status, nome: "Compras", data_mapeamento: "2026-10-26", analista: "", classificacao: "Apoio",
    area: "Suprimentos", responsavel: "Gerente", entrevistados: "Ana", objetivo: "Comprar no prazo", cliente_processo: "", areas_envolvidas: "",
    gatilho: "", entradas: [], etapas: [], decisoes: "", saidas: [], recursos: "", problemas: {}, problemas_texto: "", riscos_texto: "",
    riscos: [], indicadores: [], oportunidades_melhoria: "", plano_acao: [], bpmn_as_is: "", bpmn_to_be: "", diagnostico: null,
    entrevista_roteiro: null, interview_messages: [], mapa_revisao: "Rev.00", mapa_aprovado_em: null, implementado_em: null,
    created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T10:00:00Z",
  };
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={["/processos/proc-1"]}>
      <Routes>
        <Route path="/processos/:id" element={<ProcessoDetalhe />} />
      </Routes>
      <Toaster />
    </MemoryRouter>,
  );
}

describe("Tela do processo — ciclo de vida", () => {
  beforeEach(() => {
    mocks.updates.length = 0;
    mocks.outros = [];
    mocks.acoes = [];
    mocks.inserts.length = 0;
  });

  it("envia o 5W2H ao Plano de Ação e passa a mostrar a execução no relatório", async () => {
    const estado = iniciarRoteiro(ROTEIRO_PADRAO);
    estado.analises.plano_melhoria = {
      resumoToBe: "Compras com cotação no ERP",
      melhorias: [{ titulo: "Cotação no ERP", problema: "", solucao: "", beneficio: "", prioridade: "Alta" }],
      planoAcao: [
        { oque: "Configurar cotação no ERP", porque: "", quem: "[a definir]", quando: "[a definir]", onde: "", como: "", custo: "" },
        { oque: "Treinar compradores", porque: "", quem: "Coordenadora", quando: "12/2026", onde: "", como: "", custo: "" },
      ],
    };
    mocks.linha = { ...linha("Melhorias aprovadas"), entrevista_roteiro: estado };
    renderizar();

    expect(await screen.findByText(/2 ações do plano ainda não estão no Plano de Ação/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Plano de melhoria" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar ao Plano de Ação" }));

    await waitFor(() => expect(mocks.inserts).toHaveLength(1));
    expect(mocks.inserts[0].map((acao) => acao.oque)).toEqual(["Configurar cotação no ERP", "Treinar compradores"]);
    expect(mocks.inserts[0][1]).toMatchObject({ origem: "plano_processo", processo_id: "proc-1", prazo: "2026-12-31", created_by: "user-1" });
    expect(await screen.findByText("Execução do plano de ação")).toBeInTheDocument();
    expect(screen.getByText("31/12/2026")).toBeInTheDocument();
    // O plano agora é acompanhado no Plano de Ação, não editado no relatório.
    expect(screen.queryByRole("button", { name: "Editar Plano de melhoria" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir Plano de Ação" })).toBeInTheDocument();
  });

  it("edita uma seção no painel lateral e o relatório mostra a correção", async () => {
    mocks.linha = linha("Implementado");
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Editar SIPOC" }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText("Editar: SIPOC")).toBeInTheDocument();

    fireEvent.change(within(painel).getByLabelText("Início (o que dispara o processo)"), { target: { value: "Requisição aprovada" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Incluir saída" }));
    fireEvent.change(within(painel).getByLabelText("Saída 1"), { target: { value: "Pedido de compra" } });
    fireEvent.change(within(painel).getByLabelText("Cliente 1"), { target: { value: "Fornecedor" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0]).toEqual({
      updated_by: "user-1",
      gatilho: "Requisição aprovada",
      entradas: [],
      saidas: [{ saida: "Pedido de compra", cliente: "Fornecedor" }],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Pedido de compra")).toBeInTheDocument();
    // No SIPOC (início) e na identificação (gatilho).
    expect(screen.getAllByText("Requisição aprovada").length).toBeGreaterThan(0);
  });

  it("não deixa renomear para o nome de outro processo da empresa", async () => {
    mocks.linha = linha("Implementado");
    mocks.outros = [{ id: "proc-2", nome: "COMPRAS INDIRETAS", status: "Em entrevista", created_at: "2026-10-20T10:00:00Z" }];
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Editar dados do processo" }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome do processo"), { target: { value: "Compras indiretas" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/Já existe um processo chamado "COMPRAS INDIRETAS"/)).toBeInTheDocument();
    expect(mocks.updates).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("marca o processo como implementado após confirmação, com a documentação já liberada", async () => {
    mocks.linha = linha("Melhorias aprovadas");
    renderizar();

    const criarProcedimento = await screen.findByRole("button", { name: /Criar procedimento/ });
    expect(criarProcedimento).toBeEnabled();
    const ciclo = screen.getByRole("list", { name: "Etapas do ciclo do processo" });
    expect(within(ciclo).getByText("Melhorias aprovadas").closest("li")).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "Marcar como implementado" }));
    expect(await screen.findByText(/Confirma que as melhorias do plano foram implantadas\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0]).toMatchObject({ status: "Implementado", updated_by: "user-1" });
    expect(mocks.updates[0].implementado_em).toEqual(expect.any(String));
    await waitFor(() => expect(screen.getByRole("button", { name: /Criar procedimento/ })).toBeEnabled());
    expect(within(ciclo).getByText("Implementado").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("mostra o status antigo convertido e não oferece transição antes do plano aprovado", async () => {
    mocks.linha = linha("Em revisão");
    renderizar();
    const ciclo = await screen.findByRole("list", { name: "Etapas do ciclo do processo" });
    expect(within(ciclo).getByText("Diagnosticado").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: "Marcar como implementado" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criar procedimento/ })).toBeEnabled();
  });
});
