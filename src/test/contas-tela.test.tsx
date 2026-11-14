import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  contas: [] as Array<Record<string, unknown>>,
  rpcErro: null as unknown,
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ dados: Record<string, unknown>; id: unknown }>,
  orgList: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async (nome: string) =>
      nome === "contas_da_plataforma"
        ? { data: mocks.contas, error: null }
        : { data: null, error: mocks.rpcErro ?? { code: "PGRST202", message: "função não existe" } },
    functions: { invoke: mocks.orgList },
    from: () => ({
      insert: async (dados: Record<string, unknown>) => {
        mocks.inserts.push(dados);
        return { error: null };
      },
      update: (dados: Record<string, unknown>) => ({
        eq: async (_coluna: string, id: unknown) => {
          mocks.updates.push({ dados, id });
          return { error: null };
        },
      }),
    }),
  },
}));

import ConfigContas from "@/pages/ConfigContas";
import { listarEmpresasDoUsuario } from "@/lib/empresas-do-usuario";

describe("Contas da plataforma", () => {
  beforeEach(() => {
    mocks.contas = [
      { id: "c1", nome: "Consultoria Exemplo", tipo: "consultoria", plano: "teste", situacao: "ativa", limite_empresas: 10, limite_usuarios: null, created_at: "", empresas: 3, administradores: "admin@exemplo.com" },
      { id: "c2", nome: "Indústria Exemplo", tipo: "empresa", plano: "teste", situacao: "suspensa", limite_empresas: null, limite_usuarios: 20, created_at: "", empresas: 1, administradores: null },
    ];
    mocks.inserts = [];
    mocks.updates = [];
    mocks.toast.mockReset();
  });

  it("lista as contas com tipo, situação, empresas e administradores", async () => {
    render(<MemoryRouter><ConfigContas /></MemoryRouter>);
    expect(await screen.findByText("Consultoria Exemplo")).toBeInTheDocument();
    expect(screen.getByText("Empresa direta")).toBeInTheDocument();
    expect(screen.getByText("Suspensa")).toBeInTheDocument();
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
    expect(screen.getByText("admin@exemplo.com")).toBeInTheDocument();
  });

  it("cria uma conta e edita o plano de outra", async () => {
    render(<MemoryRouter><ConfigContas /></MemoryRouter>);
    await screen.findByText("Consultoria Exemplo");

    fireEvent.click(screen.getByRole("button", { name: /Nova conta/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Consultoria Nova" } });
    fireEvent.change(screen.getByLabelText("Limite de empresas"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(mocks.inserts).toEqual([{ nome: "Consultoria Nova", tipo: "consultoria", plano: "teste", situacao: "ativa", limite_empresas: 5, limite_usuarios: null }]));

    fireEvent.click(await screen.findByRole("button", { name: "Editar Indústria Exemplo" }));
    fireEvent.change(screen.getByLabelText("Plano"), { target: { value: "profissional" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(mocks.updates).toEqual([{ id: "c2", dados: { nome: "Indústria Exemplo", tipo: "empresa", plano: "profissional", situacao: "suspensa", limite_empresas: null, limite_usuarios: 20 } }]));
  });
});

describe("Lista de empresas do usuário", () => {
  it("usa a função do banco e, sem ela, a edge function org-list", async () => {
    mocks.orgList.mockResolvedValue({ data: [{ id: "e1", nome: "Cliente A" }], error: null });
    expect(await listarEmpresasDoUsuario()).toEqual({ data: [{ id: "e1", nome: "Cliente A" }], error: null });
    expect(mocks.orgList).toHaveBeenCalledWith("org-list");
  });
});
