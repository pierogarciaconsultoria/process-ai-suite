import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enviarLogo: vi.fn(), removerLogo: vi.fn(), toast: vi.fn() }));

vi.mock("@/lib/logo-empresa", async (original) => ({
  ...(await original<typeof import("@/lib/logo-empresa")>()),
  enviarLogo: mocks.enviarLogo,
  removerLogo: mocks.removerLogo,
  urlDoLogo: (id: string) => `https://exemplo.test/logos/${id}/logo`,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

import { LogoDaEmpresa } from "@/components/empresas/LogoDaEmpresa";

describe("Logo da empresa", () => {
  beforeEach(() => {
    mocks.enviarLogo.mockReset().mockResolvedValue(undefined);
    mocks.removerLogo.mockReset().mockResolvedValue(undefined);
    mocks.toast.mockReset();
  });

  it("envia PNG ou JPG e recusa outros formatos e arquivos grandes", async () => {
    render(<LogoDaEmpresa companyId="empresa-1" nome="Empresa Exemplo" />);
    const campo = screen.getByTestId("logo-empresa-1");

    fireEvent.change(campo, { target: { files: [new File(["svg"], "logo.svg", { type: "image/svg+xml" })] } });
    expect(mocks.toast).toHaveBeenCalledWith({ title: "Logo não enviado", description: "Use uma imagem PNG, JPG ou WebP.", variant: "destructive" });
    expect(mocks.enviarLogo).not.toHaveBeenCalled();

    const grande = new File([new Uint8Array(1024 * 1024 + 1)], "logo.png", { type: "image/png" });
    fireEvent.change(campo, { target: { files: [grande] } });
    expect(mocks.toast).toHaveBeenLastCalledWith({ title: "Logo não enviado", description: "O logo deve ter no máximo 1 MB.", variant: "destructive" });

    const png = new File(["png"], "logo.png", { type: "image/png" });
    fireEvent.change(campo, { target: { files: [png] } });
    await waitFor(() => expect(mocks.enviarLogo).toHaveBeenCalledWith("empresa-1", png));
    expect(mocks.toast).toHaveBeenLastCalledWith({ title: "Logo atualizado", description: "O logo de Empresa Exemplo já aparece nos documentos exportados." });
  });

  it("mostra o aviso de permissão quando o envio é recusado", async () => {
    mocks.enviarLogo.mockRejectedValue({ message: "new row violates row-level security policy" });
    render(<LogoDaEmpresa companyId="empresa-1" nome="Empresa Exemplo" />);
    fireEvent.change(screen.getByTestId("logo-empresa-1"), { target: { files: [new File(["png"], "logo.png", { type: "image/png" })] } });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Não foi possível enviar o logo", variant: "destructive" })));
  });
});
