import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const dados: Record<string, unknown[]> = {
    empresas: [{ id: "a", nome: "COOPERA", segmento: "Cooperativa" }, { id: "b", nome: "Piero Garcia Consultoria", segmento: null }],
    processos: [{ company_id: "a", status: "Implementado" }],
    acoes: [{ company_id: "a", status: "A fazer", prazo: "2020-01-01" }],
    indicadores: [], indicador_medicoes: [], generated_documents: [],
  };
  return {
    supabase: {
      from: (tabela: string) => {
        const resposta = { data: dados[tabela], error: null };
        const consulta: Record<string, unknown> = {};
        Object.assign(consulta, {
          select: () => consulta, order: () => consulta, limit: () => consulta, gte: () => consulta, in: () => consulta,
          then: (resolver: (valor: unknown) => unknown) => Promise.resolve(resposta).then(resolver),
        });
        return consulta;
      },
    },
  };
});

import MinhasEmpresas from "@/pages/MinhasEmpresas";

describe("Tela Minhas empresas", () => {
  it("mostra a situação de cada empresa e entra na escolhida", async () => {
    window.localStorage.setItem("process:activeEmpresaId", "b");
    render(
      <MemoryRouter initialEntries={["/minhas-empresas"]}>
        <Routes>
          <Route path="/minhas-empresas" element={<MinhasEmpresas />} />
          <Route path="/inicio" element={<div>Tela do Peter</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("COOPERA")).toBeInTheDocument();
    expect(screen.getByLabelText("Ações atrasadas: 1")).toHaveClass("text-destructive");
    expect(screen.getByText("Atual")).toBeInTheDocument();
    const linhas = screen.getAllByRole("row");
    expect(linhas[1]).toHaveTextContent("COOPERA");

    fireEvent.click(screen.getByRole("button", { name: "Entrar em COOPERA" }));
    expect(await screen.findByText("Tela do Peter")).toBeInTheDocument();
    expect(window.localStorage.getItem("process:activeEmpresaId")).toBe("a");
  });
});
