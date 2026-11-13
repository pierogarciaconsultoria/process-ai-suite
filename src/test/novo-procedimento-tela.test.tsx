import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  inserts: [] as Array<{ tabela: string; dados: Record<string, unknown> }>,
}));

// Processo fictício já diagnosticado, com dois cargos (recomenda Procedimento).
const processo = {
  id: "proc-1", company_id: "empresa-1", status: "Melhorias aprovadas", nome: "Compras", data_mapeamento: "2026-10-26",
  analista: "", classificacao: "Apoio", area: "Suprimentos", responsavel: "Ana Exemplo", entrevistados: "", objetivo: "Comprar no prazo",
  cliente_processo: "Produção", areas_envolvidas: "", gatilho: "Requisição", entradas: [], saidas: [],
  etapas: [
    { ordem: 1, atividade: "Cotar", responsavel: "Comprador", ferramentaDocumento: "ERP" },
    { ordem: 2, atividade: "Aprovar", responsavel: "Gerente", ferramentaDocumento: "" },
  ],
  decisoes: "", recursos: "", problemas: {}, problemas_texto: "", riscos_texto: "", riscos: [], indicadores: [], oportunidades_melhoria: "",
  plano_acao: [], bpmn_as_is: "", bpmn_to_be: "", diagnostico: null, entrevista_roteiro: null, interview_messages: [],
  interview_session_id: null, criticidade: "Baixa", mapa_revisao: "Rev.00", mapa_aprovado_em: "2026-10-29T12:00:00Z", published_at: null,
  obsolete_at: null, created_by: null, updated_by: null, created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T10:00:00Z",
};

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
vi.mock("@/lib/logo-empresa", () => ({ logoComoDataUrl: async () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "ana@exemplo.com", user_metadata: { full_name: "Ana Exemplo" } } } }) },
    functions: { invoke: mocks.invoke },
    from: (tabela: string) => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: tabela === "processos" ? [processo] : [], error: null }) }),
      }),
      insert: (dados: Record<string, unknown>) => {
        mocks.inserts.push({ tabela, dados });
        return {
          select: () => ({ single: async () => ({ data: { id: "doc-1", ...dados }, error: null }) }),
          then: (resolve: (valor: unknown) => void) => resolve({ error: null }),
        };
      },
    }),
  },
}));

import Documentos from "@/pages/Documentos";

describe("Novo procedimento em poucos cliques", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.inserts = [];
  });

  it("abre pelo processo, gera com o padrão do Peter e salva o rascunho", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        title: "Compras",
        content_markdown: "## 1 – OBJETIVO\nComprar no prazo.\n\n## 8 – DESCRIÇÃO\n\n### 8.1 – Cotar\n\nO **Comprador** deve cotar [detalhar: fornecedores].",
        executive_summary: "Resumo",
        attention_points: ["Conferir [detalhar: fornecedores] na 8.1"],
        suggested_risks: [],
        suggested_indicators: [],
        generation_metadata: { ai_model: "gpt-4o", padrao: "plataforma" },
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/documentos?processId=proc-1"]}>
        <Routes><Route path="/documentos" element={<Documentos />} /></Routes>
      </MemoryRouter>,
    );

    // Passo 1: o processo já vem escolhido e o tipo, recomendado.
    expect(await screen.findByText("Novo procedimento")).toBeInTheDocument();
    expect(screen.getByText(/Ana Exemplo · Mapa aprovado em/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Procedimento \(PR\)/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("Modelo do documento")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gerar" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalled());
    const corpo = mocks.invoke.mock.calls[0][1].body;
    expect(corpo.template).toMatchObject({ id: "5e7e0001-0000-4000-8000-000000000001", documentType: "Procedimento" });
    expect(corpo.sections).toEqual([]);
    expect(corpo.process_id).toBe("proc-1");

    // Passo 2: prévia formatada, pontos para revisar e salvar.
    expect(await screen.findByText("Revise o procedimento")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Compras")).toBeInTheDocument();
    expect(screen.getByText("1 ponto para revisar")).toBeInTheDocument();
    expect(screen.getByTitle("Prévia do procedimento")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Editar texto/ }));
    expect((screen.getByLabelText("Texto do procedimento") as HTMLTextAreaElement).value).toContain("### 8.1 – Cotar");

    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/ }));
    await waitFor(() => expect(mocks.inserts.some((item) => item.tabela === "generated_documents")).toBe(true));
    const salvo = mocks.inserts.find((item) => item.tabela === "generated_documents")!.dados;
    expect(salvo).toMatchObject({
      template_id: "5e7e0001-0000-4000-8000-000000000001",
      document_type: "Procedimento",
      procedure_category: "Procedimento Operacional",
      title: "Compras",
      document_owner: "Ana Exemplo",
      status: "Rascunho",
    });
  });

  it("troca para Instrução de Trabalho e para procedimento sem processo", async () => {
    render(
      <MemoryRouter initialEntries={["/documentos?processId=proc-1"]}>
        <Routes><Route path="/documentos" element={<Documentos />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("radio", { name: /Instrução de Trabalho \(IT\)/ }));
    expect(screen.getByRole("radio", { name: /Instrução de Trabalho \(IT\)/ })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("button", { name: "Criar sem processo mapeado" }));
    expect(screen.getByLabelText("Nome do procedimento")).toBeInTheDocument();
    expect(screen.queryByText("Documento de apoio (opcional)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar um processo mapeado" }));
    expect(screen.getByText("Documento de apoio (opcional)")).toBeInTheDocument();
  });
});
