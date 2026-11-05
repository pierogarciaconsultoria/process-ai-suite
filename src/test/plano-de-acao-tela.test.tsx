import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acoes: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
// Consultor ou Gestor: a tela mostra tudo (a regra de perfil é testada em perfil.test.ts).
vi.mock("@/lib/perfil", () => ({ usePodeGerenciar: () => true }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (tabela: string) => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: tabela === "acoes" ? mocks.acoes : [{ id: "proc-1", nome: "Compras" }], error: null }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        mocks.updates.push(payload);
        const cadeia = {
          eq: () => cadeia,
          select: () => ({ single: async () => ({ data: { ...mocks.acoes[0], ...payload }, error: null }) }),
        };
        return cadeia;
      },
      insert: (payload: Record<string, unknown>) => {
        mocks.inserts.push(payload);
        return { select: () => ({ single: async () => ({ data: { ...payload, id: "nova", status: payload.status ?? "A fazer", prazo: payload.prazo ?? null, quando_texto: "" }, error: null }) }) };
      },
    }),
  },
}));

import { Toaster } from "@/components/ui/toaster";
import PlanoDeAcao from "@/pages/PlanoDeAcao";

function acao(extra: Record<string, unknown>) {
  return { id: "a1", company_id: "empresa-1", processo_id: "proc-1", origem: "plano_processo", chave_origem: "plano:x", oque: "Configurar cotação no ERP",
    porque: "", onde: "", como: "", quem: "Comprador", prazo: "2026-01-31", quando_texto: "", custo: "", status: "A fazer", concluida_em: null,
    resultado: "", created_by: null, updated_by: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", ...extra };
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={["/plano-de-acao"]}>
      <Routes><Route path="/plano-de-acao" element={<PlanoDeAcao />} /></Routes>
      <Toaster />
    </MemoryRouter>,
  );
}

describe("Tela do Plano de Ação", () => {
  beforeEach(() => {
    // O Select do Radix usa APIs de ponteiro e rolagem que o jsdom não tem.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
    mocks.updates.length = 0;
    mocks.inserts.length = 0;
    mocks.acoes = [acao({}), acao({ id: "a2", oque: "Treinar compradores", status: "Concluída", prazo: null })];
  });

  it("mostra as abertas, destaca a atrasada e esconde as concluídas", async () => {
    renderizar();
    expect(await screen.findByText("Configurar cotação no ERP")).toBeInTheDocument();
    expect(screen.queryByText("Treinar compradores")).not.toBeInTheDocument();
    expect(screen.getByText("Atrasada")).toBeInTheDocument();
    expect(screen.getByText("Plano de melhoria do processo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compras" })).toBeInTheDocument();
  });

  it("muda o status direto na lista", async () => {
    renderizar();
    await screen.findByText("Configurar cotação no ERP");
    const seletor = screen.getByRole("combobox", { name: "Status de Configurar cotação no ERP" });
    seletor.focus();
    fireEvent.keyDown(seletor, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Em andamento" }));
    await waitFor(() => expect(mocks.updates).toEqual([{ status: "Em andamento", updated_by: "user-1" }]));
  });

  it("cria uma ação manual", async () => {
    renderizar();
    await screen.findByText("Configurar cotação no ERP");
    fireEvent.click(screen.getByRole("button", { name: /Nova ação/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("O quê *"), { target: { value: "Revisar contrato de transporte" } });
    fireEvent.change(within(painel).getByLabelText("Quem"), { target: { value: "Gerente de logística" } });
    fireEvent.change(within(painel).getByLabelText("Quando (prazo)"), { target: { value: "2026-12-15" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.inserts).toHaveLength(1));
    expect(mocks.inserts[0]).toMatchObject({
      company_id: "empresa-1", origem: "manual", oque: "Revisar contrato de transporte", quem: "Gerente de logística", prazo: "2026-12-15", created_by: "user-1",
    });
    expect(await screen.findByText("Revisar contrato de transporte")).toBeInTheDocument();
  });
});
