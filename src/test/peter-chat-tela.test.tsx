import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  conversas: [] as Record<string, unknown>[],
  mensagens: [] as Record<string, unknown>[],
  processarArquivo: vi.fn(),
}));

vi.mock("@/lib/peter-upload", () => ({ processarArquivo: mocks.processarArquivo }));

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
    mocks.processarArquivo.mockReset();
  });

  it("anexa Word, PDF ou imagem, manda o conteúdo lido e mostra o nome no balão", async () => {
    mocks.processarArquivo.mockImplementation(async (arquivo: File) => ({
      arquivo: arquivo.name.endsWith(".png")
        ? { nome: arquivo.name, tipo: "image/png", tipoLabel: "Imagem (PNG)", tamanhoBytes: 3, base64: "aWZh", modoEnvio: "image_url", truncado: false }
        : { nome: arquivo.name, tipo: arquivo.type, tipoLabel: "Word (DOCX)", tamanhoBytes: 3, textoExtraido: "1. Objetivo: comprar no prazo", modoEnvio: "texto_extraido", truncado: true },
      avisoTruncamento: false,
    }));
    mocks.invoke.mockResolvedValue({
      data: {
        conversa_id: "c1",
        mensagens: [
          { id: "m1", role: "user", conteudo: "Analise o anexo.", extras: { anexos: [{ nome: "PR-001.docx", tipo: "Word (DOCX)" }, { nome: "fluxo.png", tipo: "Imagem (PNG)" }] }, created_at: "" },
          { id: "m2", role: "assistant", conteudo: "O PR-001 descreve a compra.", extras: {}, created_at: "" },
        ],
      },
      error: null,
    });
    renderizar();
    await screen.findByText("Olá! Sou o Peter.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Anexar Word, PDF ou imagem" })).not.toBeDisabled());

    const docx = new File(["doc"], "PR-001.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const png = new File(["png"], "fluxo.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("anexo-peter"), { target: { files: [docx, png] } });
    const lista = await screen.findByRole("list", { name: "Arquivos anexados" });
    await waitFor(() => expect(lista).not.toHaveTextContent("Lendo"));
    expect(lista).toHaveTextContent("PR-001.docx(só o início)");
    expect(lista).toHaveTextContent("fluxo.png");

    // Sem texto, a mensagem vai com o pedido padrão.
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("ai-peter-chat", {
      body: {
        company_id: "empresa-1", conversa_id: null, mensagem: "Analise o anexo.",
        anexos: [
          { nome: "PR-001.docx", tipo: "Word (DOCX)", texto: "1. Objetivo: comprar no prazo", imagem: null },
          { nome: "fluxo.png", tipo: "Imagem (PNG)", texto: null, imagem: "data:image/png;base64,aWZh" },
        ],
      },
    }));
    expect(await screen.findByText("O PR-001 descreve a compra.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Anexos" })).toHaveTextContent("PR-001.docxfluxo.png");
    expect(screen.queryByRole("list", { name: "Arquivos anexados" })).not.toBeInTheDocument();
  });

  it("recusa outros formatos e permite remover um anexo", async () => {
    mocks.processarArquivo.mockResolvedValue({
      arquivo: { nome: "a.pdf", tipo: "application/pdf", tipoLabel: "PDF", tamanhoBytes: 3, textoExtraido: "texto", modoEnvio: "texto_extraido", truncado: false },
      avisoTruncamento: false,
    });
    renderizar();
    await screen.findByText("Olá! Sou o Peter.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Anexar Word, PDF ou imagem" })).not.toBeDisabled());

    fireEvent.change(screen.getByTestId("anexo-peter"), { target: { files: [new File(["x"], "planilha.xlsx", { type: "application/vnd.ms-excel" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent('"planilha.xlsx" não é aceito. Anexe Word (.docx), PDF ou imagem (PNG ou JPG).');
    expect(mocks.processarArquivo).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("anexo-peter"), { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    fireEvent.click(await screen.findByRole("button", { name: "Remover a.pdf" }));
    expect(screen.queryByRole("list", { name: "Arquivos anexados" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
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
