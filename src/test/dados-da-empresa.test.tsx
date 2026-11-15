import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

import { confirmacaoConfere, nomeDoArquivoDeExportacao } from "@/lib/dados-da-empresa";
import { DadosDaEmpresa } from "@/components/empresas/DadosDaEmpresa";
import { PrazosDeGuarda } from "@/components/PrazosDeGuarda";

describe("dados-da-empresa", () => {
  it("monta o nome do arquivo sem acentos nem espaços", () => {
    expect(nomeDoArquivoDeExportacao("Indústria São João Ltda.", new Date("2026-11-15T12:00:00Z"))).toBe("peter-industria-sao-joao-ltda-2026-11-15.json");
    expect(nomeDoArquivoDeExportacao("***", new Date("2026-11-15T12:00:00Z"))).toBe("peter-empresa-2026-11-15.json");
  });

  it("confere o nome digitado sem diferenciar maiúsculas e espaços nas pontas", () => {
    expect(confirmacaoConfere("Empresa Um", "  empresa um ")).toBe(true);
    expect(confirmacaoConfere("Empresa Um", "Empresa")).toBe(false);
  });
});

describe("DadosDaEmpresa", () => {
  beforeEach(() => vi.clearAllMocks());

  it("só libera a exclusão com o nome digitado e avisa a tela", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const onExcluida = vi.fn();
    render(<DadosDaEmpresa empresaId="e1" nome="Empresa Um" onExcluida={onExcluida} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir Empresa Um" }));
    const confirmar = await screen.findByRole("button", { name: /Excluir de vez/ });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/digite o nome da empresa/i), { target: { value: "empresa um" } });
    expect(confirmar).not.toBeDisabled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(onExcluida).toHaveBeenCalledWith("e1"));
    expect(mocks.rpc).toHaveBeenCalledWith("excluir_empresa", { _empresa_id: "e1", _confirmacao: "empresa um" });
  });

  it("mostra o erro do banco quando a pessoa não pode excluir", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Só o dono da empresa, o administrador da conta ou a plataforma exclui a empresa." } });
    const onExcluida = vi.fn();
    render(<DadosDaEmpresa empresaId="e1" nome="Empresa Um" onExcluida={onExcluida} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir Empresa Um" }));
    fireEvent.change(await screen.findByLabelText(/digite o nome da empresa/i), { target: { value: "Empresa Um" } });
    fireEvent.click(screen.getByRole("button", { name: /Excluir de vez/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Só o dono da empresa");
    expect(onExcluida).not.toHaveBeenCalled();
  });

  it("exporta baixando um JSON", async () => {
    mocks.rpc.mockResolvedValue({ data: { formato: "peter-exportacao-v1" }, error: null });
    const criarUrl = vi.fn(() => "blob:teste");
    Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: vi.fn() });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<DadosDaEmpresa empresaId="e1" nome="Empresa Um" onExcluida={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar dados de Empresa Um" }));
    await waitFor(() => expect(clique).toHaveBeenCalled());
    expect(mocks.rpc).toHaveBeenCalledWith("exportar_dados_empresa", { _empresa_id: "e1" });
    expect(criarUrl).toHaveBeenCalled();
    clique.mockRestore();
  });
});

describe("PrazosDeGuarda", () => {
  it("aplica e mostra quanto foi limpo", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { item: "texto de anexos do chat (90 dias)", quantidade: 3 },
        { item: "conversas com o Peter (12 meses)", quantidade: 0 },
      ],
      error: null,
    });
    render(<PrazosDeGuarda />);
    fireEvent.click(screen.getByRole("button", { name: /Aplicar prazos agora/ }));
    expect(await screen.findByText(/texto de anexos do chat/)).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("aplicar_prazos_de_guarda");
  });
});
