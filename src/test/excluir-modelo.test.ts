import { describe, expect, it } from "vitest";
import { createDefaultDocumentationState, excluirModelo, type DocumentationState } from "@/data/documentation-config";

// Biblioteca com os modelos do sistema e dois personalizados, um deles marcado como padrão.
function biblioteca(): DocumentationState {
  const base = createDefaultDocumentationState("empresa-1", "user-1");
  const sistema = base.templates[0];
  const personalizado = (id: string, nome: string, padrao = false) => ({ ...sistema, id, name: nome, isSystemTemplate: false, isDefault: padrao });
  const templates = [
    personalizado("p1", "Novo modelo 6", true),
    personalizado("p2", "Novo modelo 5"),
    ...base.templates.map((template) => ({ ...template, isDefault: false })),
  ];
  return { templates, generationSettings: { ...base.generationSettings, defaultTemplateId: "p1" } };
}

describe("Excluir modelo da biblioteca", () => {
  it("exclui um modelo personalizado e mantém o padrão", () => {
    const estado = biblioteca();
    const depois = excluirModelo(estado, "p2")!;
    expect(depois.templates.map((template) => template.id)).not.toContain("p2");
    expect(depois.templates).toHaveLength(estado.templates.length - 1);
    expect(depois.generationSettings.defaultTemplateId).toBe("p1");
  });

  it("ao excluir o modelo padrão, o padrão volta para o primeiro modelo do sistema", () => {
    const estado = biblioteca();
    const primeiroDoSistema = estado.templates.find((template) => template.isSystemTemplate)!.id;
    const depois = excluirModelo(estado, "p1")!;
    expect(depois.generationSettings.defaultTemplateId).toBe(primeiroDoSistema);
    expect(depois.templates.filter((template) => template.isDefault).map((template) => template.id)).toEqual([primeiroDoSistema]);
  });

  it("não exclui modelo do sistema, modelo inexistente nem o último modelo", () => {
    const estado = biblioteca();
    const doSistema = estado.templates.find((template) => template.isSystemTemplate)!.id;
    expect(excluirModelo(estado, doSistema)).toBeNull();
    expect(excluirModelo(estado, "nao-existe")).toBeNull();
    const unico = { ...estado, templates: [estado.templates[0]] };
    expect(excluirModelo(unico, "p1")).toBeNull();
  });
});
