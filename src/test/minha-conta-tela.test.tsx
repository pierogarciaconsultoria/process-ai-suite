import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  deletes: [] as unknown[],
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useAdminDaPlataforma", () => ({ useAdminDaPlataforma: () => ({ admin: false, carregando: false }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u-admin" } } }) },
    rpc: async (nome: string) => {
      if (nome === "minhas_contas") return { data: [{ id: "c1", papel: "admin" }], error: null };
      if (nome === "membros_da_conta") {
        return { data: [
          { id: "m1", user_id: "u-admin", email: "admin@consultoria.com", nome: "Ana Admin", papel: "admin" },
          { id: "m2", user_id: "u-cons", email: "bia@consultoria.com", nome: null, papel: "consultor" },
        ], error: null };
      }
      return { data: null, error: null };
    },
    from: (tabela: string) => {
      const consulta: Record<string, unknown> = {};
      Object.assign(consulta, {
        select: () => consulta,
        eq: () => consulta,
        order: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: { id: "c1", nome: "Consultoria Exemplo", tipo: "consultoria", plano: "teste", situacao: "ativa", limite_empresas: 10 }, error: null }),
        insert: (dados: Record<string, unknown>) => {
          mocks.inserts.push({ tabela, ...dados });
          return { select: () => ({ single: async () => ({ data: { id: "cv1", email: dados.email, papel: dados.papel, token: "tok-abc", expira_em: "2026-11-28T00:00:00Z" }, error: null }) }) };
        },
        delete: () => ({ eq: async (_c: string, id: unknown) => { mocks.deletes.push(id); return { error: null }; } }),
      });
      return consulta;
    },
  },
}));

import MinhaConta from "@/pages/MinhaConta";

describe("Minha conta", () => {
  beforeEach(() => {
    mocks.inserts = [];
    mocks.deletes = [];
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("mostra as pessoas da conta e gera o link de convite", async () => {
    render(<MemoryRouter><MinhaConta /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Consultoria Exemplo" })).toBeInTheDocument();
    expect(screen.getByText("Ana Admin")).toBeInTheDocument();
    expect(screen.getByText("bia@consultoria.com")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "novo@consultoria.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gerar convite/ }));
    await waitFor(() => expect(mocks.inserts).toEqual([{ tabela: "convites_conta", conta_id: "c1", email: "novo@consultoria.com", papel: "consultor" }]));
    expect(await screen.findByTestId("link-convite")).toHaveTextContent("/convite-conta/tok-abc");
    expect(screen.getByText("novo@consultoria.com")).toBeInTheDocument();
  });

  it("remove uma pessoa da conta", async () => {
    render(<MemoryRouter><MinhaConta /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Remover bia@consultoria.com" }));
    await waitFor(() => expect(mocks.deletes).toEqual(["m2"]));
    expect(screen.queryByText("bia@consultoria.com")).not.toBeInTheDocument();
  });
});
