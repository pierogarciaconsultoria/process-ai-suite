import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { periodoDe, rotuloPeriodo } from "@/lib/indicadores";

const mocks = vi.hoisted(() => ({
  indicadores: [] as Record<string, unknown>[],
  medicoes: [] as Record<string, unknown>[],
  inserts: [] as Array<{ tabela: string; payload: Record<string, unknown> }>,
}));

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
// Consultor ou Gestor: a tela mostra tudo (a regra de perfil é testada em perfil.test.ts).
vi.mock("@/lib/perfil", () => ({ usePodeGerenciar: () => true }));
vi.mock("@/integrations/supabase/client", () => {
  const dados: Record<string, () => unknown[]> = {
    indicadores: () => mocks.indicadores,
    indicador_medicoes: () => mocks.medicoes,
    processos: () => [{ id: "proc-1", nome: "Compras" }],
    acoes: () => [],
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      from: (tabela: string) => {
        const consulta = {
          eq: () => consulta,
          order: async () => ({ data: dados[tabela](), error: null }),
          then: (resolver: (valor: unknown) => unknown) => Promise.resolve({ data: dados[tabela](), error: null }).then(resolver),
        };
        return {
          select: () => consulta,
          insert: (payload: Record<string, unknown>) => {
            mocks.inserts.push({ tabela, payload });
            const resposta = { data: { ...payload, id: `novo-${mocks.inserts.length}` }, error: null };
            return { select: () => ({ single: async () => resposta }), then: (resolver: (valor: unknown) => unknown) => Promise.resolve(resposta).then(resolver) };
          },
        };
      },
    },
  };
});

import { Toaster } from "@/components/ui/toaster";
import Indicadores from "@/pages/Indicadores";

function renderizar() {
  return render(
    <MemoryRouter initialEntries={["/indicadores"]}>
      <Routes><Route path="/indicadores" element={<Indicadores />} /></Routes>
      <Toaster />
    </MemoryRouter>,
  );
}

describe("Tela de Indicadores", () => {
  beforeEach(() => {
    mocks.inserts.length = 0;
    mocks.medicoes = [];
    mocks.indicadores = [{
      id: "i1", company_id: "empresa-1", processo_id: "proc-1", chave_origem: null, nome: "Entregas no prazo", objetivo: "", formula: "", unidade: "%",
      sentido: "maior", meta: 95, meta_texto: "", periodicidade: "Mensal", responsavel: "Coordenadora", ativo: true, created_by: null, updated_by: null,
      created_at: "", updated_at: "",
    }];
  });

  it("lança o resultado do mês, mostra fora da meta e cria a ação", async () => {
    renderizar();
    expect(await screen.findByText("Entregas no prazo")).toBeInTheDocument();
    expect(screen.getByText("≥ 95%")).toBeInTheDocument();
    expect(screen.getByText("Sem resultado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lançar" }));
    const janela = await screen.findByRole("dialog");
    fireEvent.change(within(janela).getByLabelText("Resultado (%)"), { target: { value: "90,5" } });
    fireEvent.click(within(janela).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.inserts).toHaveLength(1));
    const periodo = periodoDe(new Date());
    expect(mocks.inserts[0]).toEqual({
      tabela: "indicador_medicoes",
      payload: { company_id: "empresa-1", indicador_id: "i1", periodo, valor: 90.5, comentario: "", created_by: "user-1", updated_by: "user-1" },
    });
    expect(await screen.findAllByText("Fora da meta")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: `Entregas no prazo, ${rotuloPeriodo(periodo)}: 90,5%` })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Criar ação/ }));
    await waitFor(() => expect(mocks.inserts).toHaveLength(2));
    expect(mocks.inserts[1]).toMatchObject({ tabela: "acoes", payload: { origem: "indicador", chave_origem: `indicador:i1:${periodo}`, quem: "Coordenadora" } });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Criar ação/ })).not.toBeInTheDocument());
  });
});
