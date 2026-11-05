import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  conversas: [] as Record<string, unknown>[],
  mensagens: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    functions: { invoke: mocks.invoke },
    from: (tabela: string) => ({
      select: () => {
        const consulta = {
          eq: () => consulta,
          order: () => (tabela === "peter_mensagens" ? Promise.resolve({ data: mocks.mensagens, error: null }) : consulta),
          limit: async () => ({ data: mocks.conversas, error: null }),
        };
        return consulta;
      },
    }),
  },
}));

import PeterChat from "@/pages/PeterChat";

function Destino() {
  const local = useLocation();
  const estado = local.state as { formPrefill?: { nomeProcesso: string } } | null;
  return <div>Destino {local.pathname} {estado?.formPrefill?.nomeProcesso ?? ""}</div>;
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={["/inicio"]}>
      <Routes>
        <Route path="/inicio" element={<PeterChat />} />
        <Route path="*" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Tela inicial do Peter", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    mocks.invoke.mockReset();
    mocks.conversas = [];
    mocks.mensagens = [];
    window.localStorage.clear();
  });

  it("oculta e mostra o histórico de conversas, e lembra a escolha", async () => {
    const { unmount } = renderizar();
    expect(await screen.findByRole("navigation", { name: "Conversas anteriores" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar histórico de conversas" }));
    expect(screen.queryByRole("navigation", { name: "Conversas anteriores" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova conversa" })).toBeInTheDocument();
    expect(window.localStorage.getItem("peter:historicoOculto")).toBe("1");

    unmount();
    renderizar();
    expect(await screen.findByRole("button", { name: "Mostrar histórico de conversas" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Conversas anteriores" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar histórico de conversas" }));
    expect(screen.getByRole("navigation", { name: "Conversas anteriores" })).toBeInTheDocument();
    expect(window.localStorage.getItem("peter:historicoOculto")).toBeNull();
  });

  it("abre com a saudação, sugestões e o convite para mapear", async () => {
    renderizar();
    expect(await screen.findByText("Olá! Sou o Peter.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quais ações do Plano de Ação estão atrasadas?" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Mapear um processo/ })[0]);
    expect(await screen.findByText(/Destino \/processos\/novo\/entrevista/)).toBeInTheDocument();
  });

  it("pergunta, mostra a resposta com atalhos e leva à entrevista com o nome do processo", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        conversa_id: "c1",
        mensagens: [
          { id: "m1", role: "user", conteudo: "Como está o processo de compras?", extras: {}, created_at: "" },
          {
            id: "m2", role: "assistant", conteudo: "O processo **Compras** ainda está em entrevista:\n- 1 ação atrasada", created_at: "",
            extras: { atalhos: [{ tipo: "plano_de_acao", id: null, rotulo: "Abrir Plano de Ação" }], convite: { nomeProcesso: "Compras" } },
          },
        ],
      },
      error: null,
    });
    renderizar();
    await screen.findByText("Olá! Sou o Peter.");
    await waitFor(() => expect(screen.getByPlaceholderText("Pergunte ao Peter…")).not.toBeDisabled());
    fireEvent.change(screen.getByPlaceholderText("Pergunte ao Peter…"), { target: { value: "Como está o processo de compras?" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Pergunte ao Peter…"), { key: "Enter" });

    expect(await screen.findByText("Compras", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("1 ação atrasada").tagName).toBe("LI");
    expect(mocks.invoke).toHaveBeenCalledWith("ai-peter-chat", { body: { company_id: "empresa-1", conversa_id: null, mensagem: "Como está o processo de compras?" } });
    expect(screen.getByRole("button", { name: "Como está o processo de compras?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: 'Mapear "Compras"' }));
    expect(await screen.findByText("Destino /processos/novo/entrevista Compras")).toBeInTheDocument();
  });

  it("retoma uma conversa anterior e manda o id dela na próxima pergunta", async () => {
    mocks.conversas = [{ id: "c9", titulo: "Indicadores de outubro", updated_at: "" }];
    mocks.mensagens = [{ id: "m1", role: "assistant", conteudo: "O indicador está dentro da meta.", extras: {}, created_at: "" }];
    mocks.invoke.mockResolvedValue({ data: { conversa_id: "c9", mensagens: [] }, error: null });
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Indicadores de outubro" }));
    expect(await screen.findByText("O indicador está dentro da meta.")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Pergunte ao Peter…"), { target: { value: "E em novembro?" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("ai-peter-chat", { body: { company_id: "empresa-1", conversa_id: "c9", mensagem: "E em novembro?" } }));
  });

  it("explica em português quando a função do Peter não responde", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("Failed to send a request to the Edge Function"), { name: "FunctionsFetchError" }) });
    renderizar();
    await screen.findByText("Olá! Sou o Peter.");
    await waitFor(() => expect(screen.getByPlaceholderText("Pergunte ao Peter…")).not.toBeDisabled());
    fireEvent.change(screen.getByPlaceholderText("Pergunte ao Peter…"), { target: { value: "Oi" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O Peter não está disponível agora.");
    expect(document.body.dataset.conversaPeter).toBe("true");
  });

  it("mostra o erro e devolve a pergunta ao campo", async () => {
    mocks.invoke.mockResolvedValue({ data: { error: "Limite de IA excedido." }, error: null });
    renderizar();
    await screen.findByText("Olá! Sou o Peter.");
    await waitFor(() => expect(screen.getByPlaceholderText("Pergunte ao Peter…")).not.toBeDisabled());
    fireEvent.change(screen.getByPlaceholderText("Pergunte ao Peter…"), { target: { value: "Oi" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite de IA excedido.");
    expect(screen.getByPlaceholderText("Pergunte ao Peter…")).toHaveValue("Oi");
  });
});
