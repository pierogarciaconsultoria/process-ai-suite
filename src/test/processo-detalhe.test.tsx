import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  linha: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
vi.mock("@/components/relatorio/MapaBpmnImagem", () => ({ MapaBpmnImagem: () => <div>mapa</div> }));
vi.mock("@/integrations/supabase/client", () => {
  const filtroSelect = { eq: () => filtroSelect, maybeSingle: async () => ({ data: mocks.linha, error: null }) };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      from: () => ({
        select: () => filtroSelect,
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
    </MemoryRouter>,
  );
}

describe("Tela do processo — ciclo de vida", () => {
  beforeEach(() => {
    mocks.updates.length = 0;
  });

  it("marca o processo como implementado após confirmação e libera a documentação", async () => {
    mocks.linha = linha("Melhorias aprovadas");
    renderizar();

    const criarProcedimento = await screen.findByRole("button", { name: /Criar procedimento/ });
    expect(criarProcedimento).toBeDisabled();
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
    expect(screen.getByRole("button", { name: /Criar procedimento/ })).toBeDisabled();
  });
});
