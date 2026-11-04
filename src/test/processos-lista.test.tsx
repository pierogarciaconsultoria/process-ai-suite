import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  linhas: [] as Record<string, unknown>[],
  excluidos: [] as Array<Record<string, string>>,
  podeGerenciar: true,
}));

vi.mock("@/lib/perfil", () => ({ usePodeGerenciar: () => mocks.podeGerenciar }));

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: mocks.linhas, error: null }) }) }),
      delete: () => {
        const filtros: Record<string, string> = {};
        const cadeia = {
          eq: (coluna: string, valor: string) => {
            filtros[coluna] = valor;
            return cadeia;
          },
          select: async () => {
            mocks.excluidos.push(filtros);
            return { data: [{ id: filtros.id }], error: null };
          },
        };
        return cadeia;
      },
    }),
  },
}));

import Processos from "@/pages/Processos";

function linha(id: string, nome: string, status: string, created_at: string) {
  return { id, nome, status, created_at, area: "Pós vendas", responsavel: "", criticidade: "Baixa", mapa_revisao: "", mapa_aprovado_em: null };
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={["/processos"]}>
      <Routes>
        <Route path="/processos" element={<Processos />} />
        <Route path="/processos/novo/entrevista" element={<div>Entrevista nova</div>} />
        <Route path="/processos/:id/entrevista" element={<div>Entrevista retomada</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Lista de processos", () => {
  beforeEach(() => {
    mocks.excluidos.length = 0;
    mocks.podeGerenciar = true;
    mocks.linhas = [
      linha("p1", "COOPERA - PÓS VENDAS - AS IS", "Implementado", "2026-10-29T12:00:00Z"),
      linha("p2", "COOPERA - PÓS VENDAS - AS IS", "Em entrevista", "2026-10-28T12:00:00Z"),
    ];
  });

  it("mostra as entrevistas paradas antes de começar um processo novo", async () => {
    renderizar();
    await screen.findAllByText("COOPERA - PÓS VENDAS - AS IS");
    fireEvent.click(screen.getAllByRole("button", { name: /Novo Processo/ })[0]);
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Iniciada em 28/10/2026")).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Entrevista retomada")).toBeInTheDocument();
  });

  it("começa direto quando não há entrevista parada", async () => {
    mocks.linhas = [mocks.linhas[0]];
    renderizar();
    await screen.findByText("COOPERA - PÓS VENDAS - AS IS");
    fireEvent.click(screen.getByRole("button", { name: /Novo Processo/ }));
    expect(await screen.findByText("Entrevista nova")).toBeInTheDocument();
  });

  it("exclui só entrevistas não concluídas, depois de confirmar", async () => {
    renderizar();
    await screen.findAllByText("COOPERA - PÓS VENDAS - AS IS");
    expect(screen.getAllByRole("button", { name: /Excluir entrevista/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Excluir entrevista de COOPERA - PÓS VENDAS - AS IS" }));
    const confirmacao = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmacao).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.getAllByText("COOPERA - PÓS VENDAS - AS IS")).toHaveLength(1));
    expect(mocks.excluidos).toEqual([{ id: "p2", company_id: "empresa-1", status: "Em entrevista" }]);
  });

  it("a Equipe não vê o botão de excluir", async () => {
    mocks.podeGerenciar = false;
    renderizar();
    await screen.findAllByText("COOPERA - PÓS VENDAS - AS IS");
    expect(screen.queryByRole("button", { name: /Excluir entrevista/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retomar entrevista/ })).toBeInTheDocument();
  });
});
