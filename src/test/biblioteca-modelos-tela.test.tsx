import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDocumentationState, storageKeyForDocumentation } from "@/data/documentation-config";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
    functions: { invoke: vi.fn() },
  },
}));

import DocumentationWorkspace from "@/components/documentation/DocumentationWorkspace";

// Biblioteca local (sem empresa) com dois modelos personalizados e os do sistema.
function semear() {
  const base = createDefaultDocumentationState(null, "local-user");
  const personalizado = (id: string, name: string) => ({ ...base.templates[0], id, name, isSystemTemplate: false, isDefault: false });
  const estado = { ...base, templates: [personalizado("p6", "Novo modelo 6"), personalizado("p5", "Novo modelo 5"), ...base.templates] };
  window.localStorage.setItem(storageKeyForDocumentation(null), JSON.stringify(estado));
  return estado;
}

describe("Biblioteca de modelos", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("mostra a lixeira só nos modelos personalizados e exclui pelo card", async () => {
    const estado = semear();
    render(<MemoryRouter><DocumentationWorkspace /></MemoryRouter>);

    const lixeira = await screen.findByRole("button", { name: "Excluir o modelo Novo modelo 5" });
    expect(screen.getByRole("button", { name: "Excluir o modelo Novo modelo 6" })).toBeInTheDocument();
    // Modelos do sistema não têm lixeira.
    const doSistema = estado.templates.find((template) => template.isSystemTemplate)!;
    expect(screen.queryByRole("button", { name: `Excluir o modelo ${doSistema.name}` })).not.toBeInTheDocument();

    fireEvent.click(lixeira);
    expect(window.confirm).toHaveBeenCalledWith('Excluir o modelo "Novo modelo 5"? Documentos já gerados com ele não são alterados.');
    expect(screen.queryByText("Novo modelo 5")).not.toBeInTheDocument();
    expect(screen.getByText("Novo modelo 6")).toBeInTheDocument();
    const gravado = JSON.parse(window.localStorage.getItem(storageKeyForDocumentation(null))!);
    expect(gravado.templates.map((template: { id: string }) => template.id)).not.toContain("p5");
  });

  it("não exclui quando a pessoa cancela", async () => {
    semear();
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<MemoryRouter><DocumentationWorkspace /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir o modelo Novo modelo 5" }));
    const card = screen.getByText("Novo modelo 5").closest("div.relative") as HTMLElement;
    expect(within(card).getByText("Novo modelo 5")).toBeInTheDocument();
  });
});
