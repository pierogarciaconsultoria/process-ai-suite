import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Configuracoes from "@/pages/Configuracoes";

const mocks = vi.hoisted(() => ({ consultor: false as boolean | null }));

vi.mock("@/hooks/useAuthUser", () => ({ useAuthUser: () => ({ user: { email: "pessoa@cliente.com.br" }, loading: false }) }));
vi.mock("@/lib/perfil", () => ({ useEhConsultor: () => mocks.consultor }));

function abrir() {
  render(<MemoryRouter><Configuracoes /></MemoryRouter>);
}

describe("Configurações", () => {
  beforeEach(() => {
    mocks.consultor = false;
  });

  it("mostra Minhas empresas para o Consultor", () => {
    mocks.consultor = true;
    abrir();
    expect(screen.getByText("Minhas empresas")).toBeInTheDocument();
  });

  it("esconde Minhas empresas de Gestor e Equipe, e enquanto verifica", () => {
    abrir();
    expect(screen.queryByText("Minhas empresas")).not.toBeInTheDocument();
    expect(screen.getByText("Usuários")).toBeInTheDocument();
  });
});
