import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queryResult: Promise.resolve({ data: null, error: null as unknown }),
}));

vi.mock("@/hooks/useAiConfig", () => ({
  useAiConfig: () => ({ companyId: "company-a", content: "", isLoading: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/BPMNCanvas", () => ({ default: () => <div>BPMN</div> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => state.queryResult,
      };
      return builder;
    },
    auth: { getUser: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

import ProcessoFormulario from "@/pages/ProcessoFormulario";

function renderForm() {
  return render(
    <MemoryRouter initialEntries={["/processos/process-a/editar"]}>
      <Routes>
        <Route path="/processos/:id/editar" element={<ProcessoFormulario />} />
        <Route path="/processos" element={<div>Lista de processos</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const authorizedProcess = {
  id: "process-a",
  company_id: "company-a",
  data_mapeamento: "2026-08-10",
  analista: "Ana",
  nome: "Processo autorizado",
  classificacao: "Negócio",
  area: "Operações",
  responsavel: "João",
  entrevistados: "",
  objetivo: "Objetivo",
  cliente_processo: "Cliente",
  areas_envolvidas: "Operações",
  gatilho: "Pedido",
  entradas: [],
  etapas: [],
  decisoes: "",
  saidas: [],
  recursos: "",
  problemas: {},
  problemas_texto: "",
  riscos_texto: "",
  riscos: [],
  indicadores: [],
  oportunidades_melhoria: "",
  plano_acao: [],
  bpmn_as_is: "",
  bpmn_to_be: "",
  interview_messages: [],
  status: "Rascunho",
  mapa_revisao: "Rev.00",
  mapa_aprovado_em: null,
};

describe("ProcessoFormulario access handling", () => {
  beforeEach(() => {
    state.queryResult = Promise.resolve({ data: null, error: null });
  });

  it("shows loading while access is being resolved", () => {
    state.queryResult = new Promise(() => undefined);
    renderForm();
    expect(screen.getByText("Carregando dados do processo...")).toBeInTheDocument();
  });

  it("renders a process authorized for the active company", async () => {
    state.queryResult = Promise.resolve({ data: authorizedProcess, error: null });
    renderForm();
    expect(await screen.findByDisplayValue("Processo autorizado")).toBeInTheDocument();
  });

  it("returns a 404 view instead of an empty form for a cross-tenant or missing process", async () => {
    state.queryResult = Promise.resolve({ data: null, error: null });
    renderForm();
    expect(await screen.findByText("404")).toBeInTheDocument();
    expect(screen.getByText("Processo não encontrado")).toBeInTheDocument();
  });

  it("returns a 403 view when RLS explicitly denies the query", async () => {
    state.queryResult = Promise.resolve({ data: null, error: { code: "42501", message: "RLS" } });
    renderForm();
    expect(await screen.findByText("403")).toBeInTheDocument();
    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
  });
});
