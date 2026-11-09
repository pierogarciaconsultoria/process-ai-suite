import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  carregarPadroes: vi.fn(),
  salvarPadrao: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/padroes-documento", async (original) => ({
  ...(await original<typeof import("@/lib/padroes-documento")>()),
  carregarPadroes: mocks.carregarPadroes,
  salvarPadrao: mocks.salvarPadrao,
}));
vi.mock("@/lib/empresa-ativa", () => ({ useEmpresaAtiva: () => "empresa-1" }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/peter-upload", () => ({ extrairTextoPdf: vi.fn(), extrairTextoDocx: vi.fn() }));

import { PadraoProcedimentoConfig } from "@/components/documentation/PadraoProcedimentoConfig";

// As abas do Radix trocam no mousedown do botão principal.
function abrirAba(nome: RegExp) {
  fireEvent.mouseDown(screen.getByRole("tab", { name: nome }), { button: 0, ctrlKey: false });
}

describe("Padrão de procedimento do Peter (configuração)", () => {
  beforeEach(() => {
    mocks.carregarPadroes.mockReset().mockResolvedValue({ estrutura_pr: "1. OBJETIVO", estrutura_it: "", manual_escrita: "" });
    mocks.salvarPadrao.mockReset().mockResolvedValue(undefined);
    mocks.toast.mockReset();
  });

  it("carrega o padrão da plataforma e salva só o que mudou", async () => {
    render(<PadraoProcedimentoConfig />);
    const estrutura = await screen.findByLabelText("Estrutura do procedimento (PR/PA)");
    expect(estrutura).toHaveValue("1. OBJETIVO");
    expect(mocks.carregarPadroes).toHaveBeenCalledWith(null);
    expect(screen.getByRole("button", { name: "Salvar padrão" })).toBeDisabled();

    // Cada parte do padrão fica numa aba; as vazias aparecem como "genérico".
    expect(screen.getByRole("tab", { name: /Procedimento \(PR\/PA\)\s*preenchido/ })).toBeInTheDocument();
    abrirAba(/Manual de escrita/);
    fireEvent.change(await screen.findByLabelText("Manual de escrita"), { target: { value: "Use verbo no infinitivo." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar padrão" }));
    await waitFor(() => expect(mocks.salvarPadrao).toHaveBeenCalledTimes(1));
    expect(mocks.salvarPadrao).toHaveBeenCalledWith(null, "manual_escrita", "Use verbo no infinitivo.");
    expect(mocks.toast).toHaveBeenCalledWith({ title: "Padrão salvo", description: "Vale para todas as empresas." });
  });

  it("parte do padrão genérico do Peter", async () => {
    render(<PadraoProcedimentoConfig />);
    await screen.findByLabelText("Estrutura do procedimento (PR/PA)");
    abrirAba(/Instrução \(IT\)/);
    await screen.findByLabelText("Estrutura da instrução de trabalho (IT)");
    fireEvent.click(screen.getByRole("button", { name: "Partir do genérico" }));
    expect((screen.getByLabelText("Estrutura da instrução de trabalho (IT)") as HTMLTextAreaElement).value).toContain("1. OBJETIVO — a tarefa que a instrução ensina");
  });
});
