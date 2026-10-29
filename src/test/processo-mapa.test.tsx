import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  linha: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// O canvas falso mostra o XML recebido e simula uma edição no diagrama.
vi.mock("@/components/BPMNCanvas", () => ({
  default: ({ xml, mode, onChange, formData }: { xml?: string; mode: string; onChange?: (xml: string) => void; formData?: unknown }) => (
    <div>
      <p>{`canvas ${mode}: ${xml || "vazio"}`}</p>
      {formData ? <p>gerar com IA</p> : null}
      <button onClick={() => onChange?.(`<editado ${mode}/>`)}>editar {mode}</button>
    </div>
  ),
}));
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

import ProcessoMapa from "@/pages/ProcessoMapa";

function renderizar() {
  return render(
    <MemoryRouter initialEntries={["/processos/proc-1/mapa"]}>
      <Routes>
        <Route path="/processos/:id/mapa" element={<ProcessoMapa />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Editor do mapa do processo", () => {
  beforeEach(() => {
    mocks.updates.length = 0;
    mocks.linha = {
      id: "proc-1", company_id: "empresa-1", nome: "COOPERA - PÓS VENDAS", status: "Diagnosticado",
      bpmn_as_is: "<as-is/>", bpmn_to_be: "", etapas: [], entradas: [], saidas: [], indicadores: [], plano_acao: [], riscos: [], problemas: {},
    };
  });

  it("salva só o mapa editado e mantém o rascunho ao trocar de aba", async () => {
    renderizar();
    expect(await screen.findByText("canvas as-is: <as-is/>")).toBeInTheDocument();
    expect(screen.queryByText("gerar com IA")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar mapa/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "editar as-is" }));
    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "TO BE (otimizado)" }));
    expect(await screen.findByText("canvas to-be: vazio")).toBeInTheDocument();
    expect(screen.getByText("gerar com IA")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "AS IS (atual)" }));
    expect(await screen.findByText("canvas as-is: <editado as-is/>")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Salvar mapa/ }));
    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0]).toEqual({ bpmn_as_is: "<editado as-is/>", updated_by: "user-1" });
    await waitFor(() => expect(screen.queryByText("Alterações não salvas")).not.toBeInTheDocument());
  });
});
