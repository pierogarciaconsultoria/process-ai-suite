import { describe, expect, it } from "vitest";
import { bpmnParaTexto } from "@/lib/peter-bpmn";
import { processarArquivo } from "@/lib/peter-upload";
import { validarArquivo } from "../../supabase/functions/_shared/peter-interview-contract";

const COMPRAS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Defs">
  <bpmn:collaboration id="Colab">
    <bpmn:participant id="P_Cliente" name="Cliente" />
    <bpmn:participant id="P_Empresa" name="Empresa" processRef="Compras" />
    <bpmn:messageFlow id="M1" name="Pedido de compra" sourceRef="P_Cliente" targetRef="Inicio" />
  </bpmn:collaboration>
  <bpmn:process id="Compras" name="Compras de materiais">
    <bpmn:laneSet>
      <bpmn:lane id="L1" name="Comercial">
        <bpmn:flowNodeRef>Inicio</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Registrar</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Prazo</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="L2" name="Financeiro">
        <bpmn:flowNodeRef>Valor</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Aprovar</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Emitir</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Fim</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Inicio" name="Pedido recebido"><bpmn:messageEventDefinition /></bpmn:startEvent>
    <bpmn:userTask id="Registrar" name="Registrar pedido">
      <bpmn:dataInputAssociation id="DA1"><bpmn:sourceRef>RefPlanilha</bpmn:sourceRef></bpmn:dataInputAssociation>
    </bpmn:userTask>
    <bpmn:boundaryEvent id="Prazo" name="2 dias sem registro" attachedToRef="Registrar"><bpmn:timerEventDefinition /></bpmn:boundaryEvent>
    <bpmn:exclusiveGateway id="Valor" name="Valor acima de R$ 5 mil?" default="F_Nao" />
    <bpmn:userTask id="Aprovar" name="Aprovar pedido" />
    <bpmn:serviceTask id="Emitir" name="Emitir pedido no ERP" />
    <bpmn:endEvent id="Fim" name="Pedido emitido" />
    <bpmn:sequenceFlow id="F1" sourceRef="Inicio" targetRef="Registrar" />
    <bpmn:sequenceFlow id="F2" sourceRef="Registrar" targetRef="Valor" />
    <bpmn:sequenceFlow id="F_Sim" name="Sim" sourceRef="Valor" targetRef="Aprovar" />
    <bpmn:sequenceFlow id="F_Nao" sourceRef="Valor" targetRef="Emitir" />
    <bpmn:sequenceFlow id="F3" sourceRef="Aprovar" targetRef="Emitir" />
    <bpmn:sequenceFlow id="F4" sourceRef="Emitir" targetRef="Fim" />
    <bpmn:dataObject id="Planilha" name="Planilha de pedidos" />
    <bpmn:dataObjectReference id="RefPlanilha" dataObjectRef="Planilha" />
    <bpmn:textAnnotation id="N1"><bpmn:text>Hoje é feito por e-mail</bpmn:text></bpmn:textAnnotation>
    <bpmn:association id="A1" sourceRef="Registrar" targetRef="N1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="D1"><bpmndi:BPMNPlane id="Plano" bpmnElement="Colab">
    <bpmndi:BPMNShape id="S1" bpmnElement="Inicio"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

describe("Peter — diagrama BPMN", () => {
  it("converte o diagrama em texto na ordem do fluxo, com responsáveis, decisões e documentos", () => {
    const convertido = bpmnParaTexto(COMPRAS)!;
    expect(convertido.totalElementos).toBe(7);
    const { texto } = convertido;
    expect(texto).toContain("Processo: Compras de materiais (participante: Empresa)");
    expect(texto).toContain("Responsáveis (raias): Comercial, Financeiro");
    expect(texto).toContain("1. [Início por mensagem] Pedido recebido — Comercial");
    expect(texto).toContain('2. [Tarefa de usuário] Registrar pedido — Comercial | usa: Planilha de pedidos | nota: "Hoje é feito por e-mail" → 4');
    expect(texto).toContain("3. [Evento de borda por temporizador] 2 dias sem registro — Comercial | durante 2 (Registrar pedido) → (o fluxo não continua no diagrama)");
    expect(texto).toContain('4. [Decisão] Valor acima de R$ 5 mil? — Financeiro → "Sim": 5; "caso contrário": 6');
    expect(texto).toContain("6. [Tarefa automática (sistema)] Emitir pedido no ERP — Financeiro\n7. [Fim] Pedido emitido — Financeiro");
    expect(texto).toContain("Documentos e dados: Planilha de pedidos");
    expect(texto).toContain('Comunicação entre participantes:\n- Cliente → Pedido recebido: "Pedido de compra"');
    expect(texto).not.toContain("Bounds");
    expect(texto).not.toContain("Anotações:");
  });

  it("aceita BPMN sem prefixo e usa o participante como responsável quando não há raias", () => {
    const { texto } = bpmnParaTexto(`<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <collaboration><participant id="A" name="Atendimento" processRef="P1" /><participant id="B" name="Cliente" /></collaboration>
      <process id="P1">
        <startEvent id="s" /><task id="t" name="Abrir chamado" /><endEvent id="e" />
        <sequenceFlow id="f1" sourceRef="s" targetRef="t" /><sequenceFlow id="f2" sourceRef="t" targetRef="e" />
        <textAnnotation id="n"><text>Sem SLA definido</text></textAnnotation>
      </process>
    </definitions>`)!;
    expect(texto).toContain("Processo: Atendimento");
    expect(texto).toContain("1. [Início] (sem nome) — Atendimento\n2. [Tarefa] Abrir chamado — Atendimento\n3. [Fim] (sem nome) — Atendimento");
    expect(texto).toContain("Anotações:\n- Sem SLA definido");
  });

  it("recusa XML inválido ou que não é BPMN 2.0", () => {
    expect(bpmnParaTexto("<definitions><process>")).toBeNull();
    expect(bpmnParaTexto("<?xml version=\"1.0\"?><nota><texto>oi</texto></nota>")).toBeNull();
    expect(bpmnParaTexto('<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><process id="p" /></definitions>')?.totalElementos).toBe(0);
  });

  it("aceita .bpmn e .xml no upload e envia o diagrama convertido como texto", async () => {
    const arquivo = new File([COMPRAS], "compras.bpmn", { type: "" });
    expect(validarArquivo(arquivo).valido).toBe(true);
    expect(validarArquivo(new File(["x"], "exportado.xml", { type: "text/xml" })).valido).toBe(true);

    const { arquivo: processado } = await processarArquivo(arquivo);
    expect(processado).toMatchObject({ modoEnvio: "texto_extraido", tipoLabel: "Diagrama BPMN", truncado: false });
    expect(processado.textoExtraido).toContain("Registrar pedido");

    await expect(processarArquivo(new File(["<nota />"], "nota.xml", { type: "text/xml" }))).rejects.toThrow(/não é um diagrama BPMN 2.0 válido/);
    await expect(processarArquivo(new File(['<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" />'], "vazio.bpmn", { type: "" })))
      .rejects.toThrow(/não tem atividades nem eventos/);
  });
});
