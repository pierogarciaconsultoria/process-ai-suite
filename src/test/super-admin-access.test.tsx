import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { useAuthUser } from "@/hooks/useAuthUser";
import { isSuperAdmin } from "@/lib/permissions";
import Configuracoes from "@/pages/Configuracoes";

const banco = vi.hoisted(() => ({ adminPelaTabela: false }));

vi.mock("@/hooks/useAuthUser", () => ({ useAuthUser: vi.fn() }));
// is_super_admin no banco: e-mail original ou tabela plataforma_admins.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async () => ({ data: banco.adminPelaTabela, error: null }),
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));

const mockedUseAuthUser = vi.mocked(useAuthUser);

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/restrito"]}>
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/restrito" element={<SuperAdminRoute><div>Configuração restrita</div></SuperAdminRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("acesso de super admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    banco.adminPelaTabela = false;
  });

  it("normaliza o e-mail antes de validar", () => {
    expect(isSuperAdmin({ email: " CONTATO@PIEROGARCIA.COM.BR " })).toBe(true);
    expect(isSuperAdmin({ email: "usuario@empresa.com" })).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });

  it("permite a rota para o super admin", () => {
    mockedUseAuthUser.mockReturnValue({ user: { email: "contato@pierogarcia.com.br" } as never, loading: false });
    renderGuard();
    expect(screen.getByText("Configuração restrita")).toBeInTheDocument();
  });

  it("permite a rota para administrador da plataforma cadastrado na tabela", async () => {
    banco.adminPelaTabela = true;
    mockedUseAuthUser.mockReturnValue({ user: { id: "u-2", email: "socio@pierogarcia.com.br" } as never, loading: false });
    renderGuard();
    expect(await screen.findByText("Configuração restrita")).toBeInTheDocument();
  });

  it("redireciona os demais usuários", async () => {
    mockedUseAuthUser.mockReturnValue({ user: { id: "u-3", email: "usuario@empresa.com" } as never, loading: false });
    renderGuard();
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Configuração restrita")).not.toBeInTheDocument();
  });

  it("aguarda a resolução da sessão", () => {
    mockedUseAuthUser.mockReturnValue({ user: null, loading: true });
    renderGuard();
    expect(screen.getByText("Verificando permissão...")).toBeInTheDocument();
  });

  it("oculta os três cards para usuários comuns", () => {
    mockedUseAuthUser.mockReturnValue({ user: { email: "usuario@empresa.com" } as never, loading: false });
    render(<MemoryRouter><Configuracoes /></MemoryRouter>);

    expect(screen.queryByText("Roteiro IA")).not.toBeInTheDocument();
    expect(screen.queryByText("Skin da IA")).not.toBeInTheDocument();
    expect(screen.queryByText("Documentação do Processo")).not.toBeInTheDocument();
  });

  it("exibe os três cards para o super admin", () => {
    mockedUseAuthUser.mockReturnValue({ user: { email: "contato@pierogarcia.com.br" } as never, loading: false });
    render(<MemoryRouter><Configuracoes /></MemoryRouter>);

    expect(screen.getByText("Roteiro IA")).toBeInTheDocument();
    expect(screen.getByText("Skin da IA")).toBeInTheDocument();
    expect(screen.getByText("Documentação do Processo")).toBeInTheDocument();
  });
});
