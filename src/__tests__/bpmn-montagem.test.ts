import { describe, expect, it } from "vitest";
import {
  estruturaLinear,
  montarBpmnXml,
  normalizarEstrutura,
  totalDeTarefas,
} from "../../supabase/functions/_shared/bpmn-montagem";

const contar = (xml: string, trecho: string) => xml.split(trecho).length - 1;

describe("montagem do BPMN", () => {
  it("cria uma raia por papel e mantém todas as atividades, com sistemas", () => {
    const estrutura = estruturaLinear(
      [
        { atividade: "Emitir requisição", responsavel: "Auxiliar de Almoxarifado, Vendedor", ferramentaDocumento: "Useall M2" },
        { atividade: "Separar material", responsavel: "Separador" },
        { atividade: "Conferir material", responsavel: "Conferente", ferramentaDocumento: "Espelho da requisição" },
      ],
      "Estoque baixo",
      "Mercadoria recebida",
    );
    const xml = montarBpmnXml(estrutura, "Transferência");

    expect(contar(xml, "<bpmn:lane ")).toBe(3);
    expect(xml).toContain('name="Auxiliar de Almoxarifado"');
    expect(contar(xml, "<bpmn:userTask ")).toBe(2);
    expect(contar(xml, "<bpmn:task ")).toBe(1);
    expect(contar(xml, "<bpmn:dataStoreReference ")).toBe(2);
    expect(contar(xml, "<bpmn:sequenceFlow ")).toBe(4);
    expect(xml).toContain('<bpmn:participant id="Pool" name="Transferência"');
  });

  it("aceita decisão com dois ramos e laço de volta, sem ids duplicados", () => {
    const estrutura = normalizarEstrutura({
      raias: ["Separador", "Solicitante"],
      nos: [
        { id: "i", tipo: "inicio", nome: "Pedido <urgente>", raia: "Separador" },
        { id: "v", tipo: "tarefa", nome: "Verificar estoque", raia: "Separador" },
        { id: "d", tipo: "decisao", nome: "Estoque correto?", raia: "Separador" },
        { id: "t", tipo: "tarefa", nome: "Tratar divergência", raia: "Solicitante" },
        { id: "s", tipo: "tarefa", nome: "Separar material", raia: "Separador" },
        { id: "f", tipo: "fim", nome: "Separado", raia: "Separador" },
        { id: "x", tipo: "invalido", nome: "ignorado", raia: "Separador" },
      ],
      fluxos: [
        { de: "i", para: "v" },
        { de: "v", para: "d" },
        { de: "d", para: "s", rotulo: "Sim" },
        { de: "d", para: "t", rotulo: "Não" },
        { de: "t", para: "v" },
        { de: "s", para: "f" },
        { de: "s", para: "inexistente" },
      ],
    });
    expect(estrutura).not.toBeNull();
    expect(totalDeTarefas(estrutura!)).toBe(3);

    const xml = montarBpmnXml(estrutura!, "Separação");
    const ids = [...xml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(contar(xml, "<bpmn:exclusiveGateway ")).toBe(1);
    expect(contar(xml, "<bpmn:sequenceFlow ")).toBe(6);
    expect(xml).toContain('name="Não"');
    expect(xml).toContain("Pedido &lt;urgente&gt;");
    expect(new DOMParser().parseFromString(xml, "application/xml").querySelector("parsererror")).toBeNull();
  });

  it("recusa estrutura sem início ou fim", () => {
    expect(normalizarEstrutura({ nos: [{ id: "a", tipo: "tarefa", nome: "A", raia: "X" }], fluxos: [] })).toBeNull();
    expect(normalizarEstrutura("texto")).toBeNull();
  });
});
