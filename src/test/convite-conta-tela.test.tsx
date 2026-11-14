import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  convite: { conta_nome: "Consultoria Exemplo", conta_tipo: "consultoria", papel: "consultor", email: "novo@exemplo.com", status: "pendente", expirado: false } as Record<string, unknown> | null,
  emailLogado: null as string | null,
  aceitar: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: mocks.emailLogado ? { id: "u1", email: mocks.emailLogado } : null } }),
      signOut: mocks.signOut,
    },
    rpc: async (nome: string, args: Record<string, unknown>) => {
      if (nome === "convite_conta_info") return { data: mocks.convite ? [mocks.convite] : [], error: null };
      if (nome === "aceitar_convite_conta") return mocks.aceitar(args);
      if (nome === "empresas_do_usuario") return { data: [{ id: "e1", nome: "Cliente A" }], error: null };
      return { data: null, error: null };
    },
  },
}));

import ConviteConta from "@/pages/ConviteConta";

function abrir() {
  return render(
    <MemoryRouter initialEntries={["/convite-conta/tok123"]}>
      <Routes>
        <Route path="/convite-conta/:token" element={<ConviteConta />} />
        <Route path="/inicio" element={<div>Início do Peter</div>} />
        <Route path="/login" element={<div>Tela de login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Convite para a conta", () => {
  beforeEach(() => {
    mocks.emailLogado = null;
    mocks.convite = { conta_nome: "Consultoria Exemplo", conta_tipo: "consultoria", papel: "consultor", email: "novo@exemplo.com", status: "pendente", expirado: false };
    mocks.aceitar.mockReset().mockResolvedValue({ data: "c1", error: null });
  });

  it("sem login, pede para entrar com o e-mail convidado", async () => {
    abrir();
    expect(await screen.findByText(/Consultoria Exemplo/)).toBeInTheDocument();
    expect(screen.getByText(/Entre ou crie seu acesso com o e-mail/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar ou criar acesso" })).toHaveAttribute("href", "/login?redirect=%2Fconvite-conta%2Ftok123");
  });

  it("com outro e-mail, oferece trocar de usuário", async () => {
    mocks.emailLogado = "outro@exemplo.com";
    abrir();
    expect(await screen.findByText(/mas o convite é para/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sair e entrar com novo@exemplo.com" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
  });

  it("com o e-mail certo, aceita e vai para o início", async () => {
    mocks.emailLogado = "novo@exemplo.com";
    abrir();
    fireEvent.click(await screen.findByRole("button", { name: /Aceitar convite/ }));
    await waitFor(() => expect(mocks.aceitar).toHaveBeenCalledWith({ _token: "tok123" }));
    expect(await screen.findByText("Início do Peter")).toBeInTheDocument();
  });

  it("convite usado ou expirado não pode ser aceito", async () => {
    mocks.convite = { ...mocks.convite!, status: "aceito" };
    abrir();
    expect(await screen.findByText(/Este convite já foi usado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aceitar convite/ })).not.toBeInTheDocument();
  });
});
