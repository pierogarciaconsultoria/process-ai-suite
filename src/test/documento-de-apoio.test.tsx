import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ extrairTextoDocx: vi.fn(), extrairTextoPdf: vi.fn() }));
vi.mock("@/lib/peter-upload", () => ({ extrairTextoDocx: mocks.extrairTextoDocx, extrairTextoPdf: mocks.extrairTextoPdf }));

import { DocumentoDeApoio, type DocumentoDeApoioValor } from "@/components/documentos/DocumentoDeApoio";

function Tela({ aoMudar }: { aoMudar: (valor: DocumentoDeApoioValor | null) => void }) {
  const [valor, setValor] = useState<DocumentoDeApoioValor | null>(null);
  return <DocumentoDeApoio valor={valor} onChange={(novo) => { setValor(novo); aoMudar(novo); }} />;
}

describe("Documento de apoio", () => {
  it("lê o Word ou PDF anexado, mostra o nome e permite remover", async () => {
    mocks.extrairTextoDocx.mockResolvedValue("8.4 Separar mercadorias: o Separador deve...");
    const aoMudar = vi.fn();
    render(<Tela aoMudar={aoMudar} />);

    fireEvent.change(screen.getByTestId("documento-apoio"), { target: { files: [new File(["x"], "planilha.xlsx")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Anexe o documento em PDF ou Word (.docx).");

    const docx = new File(["x"], "PA-001 Pós-vendas.docx");
    fireEvent.change(screen.getByTestId("documento-apoio"), { target: { files: [docx] } });
    await waitFor(() => expect(aoMudar).toHaveBeenCalledWith({ nome: "PA-001 Pós-vendas.docx", texto: "8.4 Separar mercadorias: o Separador deve..." }));
    expect(screen.getByText("PA-001 Pós-vendas.docx")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover PA-001 Pós-vendas.docx" }));
    expect(aoMudar).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: "Anexar PDF ou Word" })).toBeInTheDocument();
  });
});
