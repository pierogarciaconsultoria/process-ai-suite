import { useEffect, useRef } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import { Button } from "@/components/ui/button";

type BPMNCanvasProps = {
  processName?: string;
  processCode?: string;
  executors?: string;
  description?: string;
  generateKey?: number;
  onSave?: (xml: string) => void;
  onGenerated?: () => void;
  hideGenerateButton?: boolean;
};

function toId(text: string) {
  return String(text || "processo").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function generateBPMNFromDescription(description: string, processName?: string, processCode?: string, executors?: string) {
  const steps = description
    .split(/[\n•-]|[,;.]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
  const pid = toId(processCode || processName || "processo");
  const executorsList = (executors || "").split(",").map((e) => e.trim()).filter(Boolean);

  let elements = "";
  let flows = "";
  let diagrams = "";
  let flowId = 1;
  let previousId = "StartEvent_1";
  let yPos = 100;

  elements += `
    <bpmn:startEvent id="StartEvent_1" name="Início do ${processName || "Processo"}">
      <bpmn:outgoing>Flow_${flowId}</bpmn:outgoing>
    </bpmn:startEvent>`;

  diagrams += `
    <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
      <dc:Bounds x="152" y="${yPos}" width="36" height="36" />
    </bpmndi:BPMNShape>`;

  steps.forEach((step, index) => {
    const taskId = `Task_${index + 1}`;
    const isDecision = /aprovar|rejeitar|\\bse\\b|decidir|escolher|verificar se/i.test(step);
    const isUserTask = /gestor|colaborador|vendedor|comprador|analista|rh|financeiro|comercial/i.test(step) || executorsList.length > 0;
    yPos += 120;

    if (isDecision) {
      const gatewayId = `Gateway_${index + 1}`;
      elements += `
    <bpmn:exclusiveGateway id="${gatewayId}" name="Decisão">
      <bpmn:incoming>Flow_${flowId}</bpmn:incoming>
      <bpmn:outgoing>Flow_${flowId + 1}</bpmn:outgoing>
      <bpmn:outgoing>Flow_${flowId + 2}</bpmn:outgoing>
    </bpmn:exclusiveGateway>`;

      diagrams += `
    <bpmndi:BPMNShape id="${gatewayId}_di" bpmnElement="${gatewayId}" isMarkerVisible="true">
      <dc:Bounds x="265" y="${yPos}" width="50" height="50" />
      <bpmndi:BPMNLabel>
        <dc:Bounds x="270" y="${yPos + 60}" width="40" height="14" />
      </bpmndi:BPMNLabel>
    </bpmndi:BPMNShape>`;

      flows += `
    <bpmn:sequenceFlow id="Flow_${flowId}" sourceRef="${previousId}" targetRef="${gatewayId}" />`;

      diagrams += `
    <bpmndi:BPMNEdge id="Flow_${flowId}_di" bpmnElement="Flow_${flowId}">
      <di:waypoint x="170" y="${yPos - 120 + 18}" />
      <di:waypoint x="290" y="${yPos + 25}" />
    </bpmndi:BPMNEdge>`;

      previousId = gatewayId;
      flowId += 3;
    } else {
      const taskType = isUserTask ? "userTask" : "task";
      const taskName = step.slice(0, 60);
      elements += `
    <bpmn:${taskType} id="${taskId}" name="${taskName}">
      <bpmn:incoming>Flow_${flowId}</bpmn:incoming>
      <bpmn:outgoing>Flow_${flowId + 1}</bpmn:outgoing>
    </bpmn:${taskType}>`;

      diagrams += `
    <bpmndi:BPMNShape id="${taskId}_di" bpmnElement="${taskId}">
      <dc:Bounds x="240" y="${yPos}" width="100" height="80" />
    </bpmndi:BPMNShape>`;

      flows += `
    <bpmn:sequenceFlow id="Flow_${flowId}" sourceRef="${previousId}" targetRef="${taskId}" />`;

      diagrams += `
    <bpmndi:BPMNEdge id="Flow_${flowId}_di" bpmnElement="Flow_${flowId}">
      <di:waypoint x="170" y="${yPos - 120 + 40}" />
      <di:waypoint x="290" y="${yPos + 40}" />
    </bpmndi:BPMNEdge>`;

      previousId = taskId;
      flowId += 2;
    }
  });

  yPos += 120;
  elements += `
    <bpmn:endEvent id="EndEvent_1" name="Fim do ${processName || "Processo"}">
      <bpmn:incoming>Flow_${flowId}</bpmn:incoming>
    </bpmn:endEvent>`;

  diagrams += `
    <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
      <dc:Bounds x="272" y="${yPos}" width="36" height="36" />
    </bpmndi:BPMNShape>`;

  flows += `
    <bpmn:sequenceFlow id="Flow_${flowId}" sourceRef="${previousId}" targetRef="EndEvent_1" />`;

  diagrams += `
    <bpmndi:BPMNEdge id="Flow_${flowId}_di" bpmnElement="Flow_${flowId}">
      <di:waypoint x="290" y="${yPos - 120 + 40}" />
      <di:waypoint x="290" y="${yPos + 18}" />
    </bpmndi:BPMNEdge>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                   id="Definitions_${pid}"
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_${pid}" name="${processName || "Processo"}" isExecutable="false">
    ${elements}
    ${flows}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_${pid}">
      ${diagrams}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  return xml;
}

export default function BPMNCanvas({ processName, processCode, executors, description, generateKey, onSave, onGenerated, hideGenerateButton }: BPMNCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  type CanvasService = { zoom: (value?: number | string) => number };

  useEffect(() => {
    if (!containerRef.current) return;
    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: { bindTo: window },
    });
    modelerRef.current = modeler;
    return () => {
      modeler.destroy();
    };
  }, []);

  useEffect(() => {
    if (generateKey !== undefined) {
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateKey]);

  const generate = async () => {
    if (!description || !description.trim()) return;
    const xml = generateBPMNFromDescription(description, processName, processCode, executors);
    await modelerRef.current?.importXML(xml);
    const canvas = modelerRef.current?.get("canvas") as CanvasService | undefined;
    canvas?.zoom("fit-viewport");
    onGenerated?.();
  };

  const save = async () => {
    const { xml } = await modelerRef.current!.saveXML({ format: true });
    onSave?.(xml);
  };

  const exportSVG = async () => {
    const { svg } = await modelerRef.current!.saveSVG();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${processCode || "processo"}-bpmn.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXML = async () => {
    const { xml } = await modelerRef.current!.saveXML({ format: true });
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${processCode || "processo"}-bpmn.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPNG = async () => {
    const { svg } = await modelerRef.current!.saveSVG();
    const svgBlob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = `${processCode || "processo"}-bpmn.png`;
            a.click();
            URL.revokeObjectURL(pngUrl);
          }
        }, "image/png");
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const clear = async () => {
    const xml = generateBPMNFromDescription("", processName, processCode, executors);
    await modelerRef.current?.importXML(xml);
    const canvas = modelerRef.current?.get("canvas") as CanvasService | undefined;
    canvas?.zoom("fit-viewport");
  };

  return (
    <div className="flex flex-col h-full">
      <style>{`.djs-palette{z-index:1000 !important}.djs-context-pad{z-index:1000 !important}.djs-overlay-container{z-index:1000 !important}.djs-container{overflow:visible !important}`}</style>
      <div className="flex items-center justify-between p-2 md:p-3 border rounded-md bg-card mb-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { const canvas = modelerRef.current?.get("canvas") as CanvasService | undefined; canvas?.zoom("fit-viewport"); }}>Ajustar</Button>
          <Button variant="outline" size="sm" onClick={() => { const canvas = modelerRef.current?.get("canvas") as CanvasService | undefined; if (canvas) canvas.zoom(canvas.zoom() + 0.1); }}>Zoom +</Button>
          <Button variant="outline" size="sm" onClick={() => { const canvas = modelerRef.current?.get("canvas") as CanvasService | undefined; if (canvas) canvas.zoom(canvas.zoom() - 0.1); }}>Zoom -</Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>Salvar</Button>
          <Button variant="outline" size="sm" onClick={exportSVG}>Exportar SVG</Button>
          <Button variant="outline" size="sm" onClick={exportPNG}>Exportar PNG</Button>
          <Button variant="outline" size="sm" onClick={exportXML}>Exportar XML</Button>
          <Button variant="outline" size="sm" onClick={clear}>Limpar</Button>
        </div>
      </div>
      <div className="flex-1 bg-muted/30 rounded-md w-full min-h-[500px] md:min-h-[700px] h-[80vh] md:h-[85vh] relative overflow-visible" ref={containerRef} />
      {!hideGenerateButton && (
        <div className="mt-2">
          <Button className="w-full" onClick={generate}>Gerar Diagrama BPMN Automaticamente</Button>
        </div>
      )}
    </div>
  );
}
