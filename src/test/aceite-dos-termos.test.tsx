import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ limit: mocks.select }) }),
      insert: mocks.insert,
    }),
    auth: { getUser: mocks.getUser, signOut: mocks.signOut },
  },
}));

import { AceiteDosTermos } from "@/components/AceiteDosTermos";
import DocumentoLegal from "@/pages/DocumentoLegal";
import { VERSAO_DOCUMENTOS_LEGAIS } from "@/data/documentos-legais";

function renderGate() {
  return render(
    <MemoryRouter>
      <AceiteDosTermos>
        <div>Conteúdo do app</div>
      </AceiteDosTermos>
    </MemoryRouter>,
  );
}

describe("AceiteDosTermos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", user_metadata: {} } } });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("libera o app quando a versão vigente já foi aceita", async () => {
    mocks.select.mockResolvedValue({ data: [{ id: "a1" }], error: null });
    renderGate();
    expect(await screen.findByText("Conteúdo do app")).toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("pede o aceite e só libera depois de marcar e confirmar", async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });
    renderGate();
    const botao = await screen.findByRole("button", { name: /Aceitar e continuar/ });
    expect(botao).toBeDisabled();
    expect(screen.queryByText("Conteúdo do app")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(botao);
    expect(await screen.findByText("Conteúdo do app")).toBeInTheDocument();
    expect(mocks.insert).toHaveBeenCalledWith({ versao: VERSAO_DOCUMENTOS_LEGAIS });
  });

  it("registra sozinho o aceite feito no cadastro", async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", user_metadata: { aceite_termos_versao: VERSAO_DOCUMENTOS_LEGAIS } } } });
    renderGate();
    expect(await screen.findByText("Conteúdo do app")).toBeInTheDocument();
    expect(mocks.insert).toHaveBeenCalledWith({ versao: VERSAO_DOCUMENTOS_LEGAIS });
  });

  it("não pede de novo um aceite de versão antiga do cadastro", async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1", user_metadata: { aceite_termos_versao: "2000-01-01" } } } });
    renderGate();
    expect(await screen.findByRole("button", { name: /Aceitar e continuar/ })).toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("não bloqueia o uso se a verificação falhar (tabela ausente)", async () => {
    mocks.select.mockResolvedValue({ data: null, error: { code: "PGRST205" } });
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderGate();
    expect(await screen.findByText("Conteúdo do app")).toBeInTheDocument();
    aviso.mockRestore();
  });

  it("trata aceite duplicado (outra aba) como aceito", async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    renderGate();
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar e continuar/ }));
    await waitFor(() => expect(screen.getByText("Conteúdo do app")).toBeInTheDocument());
  });
});

describe("DocumentoLegal", () => {
  it("mostra a política com seções, versão e links", () => {
    render(
      <MemoryRouter>
        <DocumentoLegal tipo="privacidade" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "4. Com quem compartilhamos" })).toBeInTheDocument();
    expect(screen.getByText(/OpenAI, nos Estados Unidos/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos");
  });

  it("mostra os termos", () => {
    render(
      <MemoryRouter>
        <DocumentoLegal tipo="termos" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "5. Inteligência artificial" })).toBeInTheDocument();
  });
});
