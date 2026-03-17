import { useEffect, useRef, useState } from "react";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import "./BpmnEditor.css";
import { supabase } from "@/integrations/supabase/client";

const EMPTY_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_1" isExecutable="false">
    <startEvent id="StartEvent_1" name="Início" />
  </process>
  <bpmndi:BPMNDiagram>
    <bpmndi:BPMNPlane bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

const STORAGE_KEY = "process_ai_bpmn_as_is";

type ModelerLike = {
  importXML: (xml: string) => Promise<unknown>;
  saveXML: (opts: { format: boolean }) => Promise<{ xml: string }>;
  destroy: () => void;
  get: <T = unknown>(name: string) => T;
  saveSVG?: () => Promise<{ svg: string }>;
  on?: (event: string, fn: () => void) => void;
};

type StepLike = {
  ordem?: number;
  atividade?: string;
  responsavel?: string;
  sistema?: string;
};

type ModelingLike = {
  createShape: (
    attrs: Record<string, unknown>,
    position: { x: number; y: number },
    parent: unknown
  ) => unknown;
  connect: (
    source: unknown,
    target: unknown,
    attrs: Record<string, unknown>
  ) => unknown;
  updateProperties: (element: unknown, properties: Record<string, unknown>) => void;
};

type CanvasLike = {
  getRootElement: () => unknown;
};

export default function BpmnEditor(props: {
  steps?: StepLike[];
  entradas?: string;
  decisoes?: string;
  saidas?: string;
  processId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modelerRef = useRef<ModelerLike | null>(null);
  const [mode, setMode] = useState<"modeler" | "viewer">("modeler");
  const [dirty, setDirty] = useState(false);
  const [lastSavedXml, setLastSavedXml] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!containerRef.current) return;
      let instance: ModelerLike;
      if (mode === "modeler") {
        const { default: BpmnModeler } = await import("bpmn-js/lib/Modeler");
        instance = new (BpmnModeler as unknown as { new (opts: unknown): ModelerLike })({
          container: containerRef.current,
          keyboard: { bindTo: document },
        }) as unknown as ModelerLike;
      } else {
        const { default: BpmnViewer } = await import("bpmn-js/lib/Viewer");
        instance = new (BpmnViewer as unknown as { new (opts: unknown): ModelerLike })({
          container: containerRef.current,
        }) as unknown as ModelerLike;
      }
      modelerRef.current = instance;
      let initialXml = localStorage.getItem(STORAGE_KEY) || EMPTY_DIAGRAM;
      if (props.processId) {
        const { data } = await supabase
          .from("processes")
          .select("bpmn_as_is")
          .eq("id", props.processId)
          .maybeSingle();
        if (data?.bpmn_as_is) initialXml = data.bpmn_as_is;
      }
      setLastSavedXml(initialXml);
      await instance.importXML(initialXml).catch(() => {});
      instance.on?.("commandStack.changed", () => setDirty(true));
    }, 50);
    return () => {
      clearTimeout(timer);
      modelerRef.current?.destroy();
      modelerRef.current = null;
    };
  }, [mode, props.processId]);

  const handleNovo = async () => {
    await modelerRef.current?.importXML(EMPTY_DIAGRAM);
    localStorage.removeItem(STORAGE_KEY);
    setLastSavedXml(EMPTY_DIAGRAM);
    setDirty(false);
  };

  const handleSalvar = async () => {
    const res = await modelerRef.current?.saveXML({ format: true });
    const xml = res?.xml ?? "";
    localStorage.setItem(STORAGE_KEY, xml);
    setLastSavedXml(xml);
    setDirty(false);
    if (props.processId) {
      await supabase
        .from("processes")
        .update({ bpmn_as_is: xml, updated_at: new Date().toISOString() })
        .eq("id", props.processId);
    }
  };

  const handleExportar = async () => {
    const res = await modelerRef.current?.saveXML({ format: true });
    const xml = res?.xml ?? "";
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagrama-as-is.bpmn";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportarSVG = async () => {
    const res = await modelerRef.current?.saveSVG?.();
    const svg = res?.svg ?? "";
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagrama-as-is.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportar = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".bpmn,.xml";
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      const text = await file.text();
      await modelerRef.current?.importXML(text);
    };
    input.click();
  };

  const handleGerar = async () => {
    const steps = (props.steps ?? []).filter(
      (s) => !!(s.atividade ?? "").trim()
    );
    await modelerRef.current?.importXML(EMPTY_DIAGRAM);
    const modeling = modelerRef.current?.get<ModelingLike>("modeling");
    const canvas = modelerRef.current?.get<CanvasLike>("canvas");
    if (!modeling || !canvas) return;
    const root = canvas.getRootElement();
    const y = 220;
    let x = 180;
    const start = modeling.createShape(
      { type: "bpmn:StartEvent", name: "Início" },
      { x, y },
      root
    );
    if ((props.entradas ?? "").trim()) {
      const ann = modeling.createShape(
        { type: "bpmn:TextAnnotation" },
        { x: x - 120, y: y - 60 },
        root
      );
      modeling.updateProperties(ann, { text: props.entradas });
      modeling.connect(ann, start, { type: "bpmn:Association" });
    }
    let prev = start;
    x += 140;
    for (const s of steps) {
      const task = modeling.createShape(
        { type: "bpmn:Task", name: s.atividade ?? "Atividade" },
        { x, y },
        root
      );
      modeling.connect(prev, task, { type: "bpmn:SequenceFlow" });
      prev = task;
      x += 160;
    }
    let end = modeling.createShape(
      { type: "bpmn:EndEvent", name: "Fim" },
      { x, y },
      root
    );
    if ((props.decisoes ?? "").trim()) {
      const gw = modeling.createShape(
        { type: "bpmn:ExclusiveGateway", name: "Decisão" },
        { x: x - 80, y },
        root
      );
      modeling.connect(prev, gw, { type: "bpmn:SequenceFlow" });
      const endYes = modeling.createShape(
        { type: "bpmn:EndEvent", name: "Fim" },
        { x: x + 80, y: y - 70 },
        root
      );
      const endNo = modeling.createShape(
        { type: "bpmn:EndEvent", name: "Fim" },
        { x: x + 80, y: y + 70 },
        root
      );
      const c1 = modeling.connect(gw, endYes, { type: "bpmn:SequenceFlow" });
      const c2 = modeling.connect(gw, endNo, { type: "bpmn:SequenceFlow" });
      modeling.updateProperties(c1, { name: "Sim" });
      modeling.updateProperties(c2, { name: "Não" });
      end = endYes;
    } else {
      modeling.connect(prev, end, { type: "bpmn:SequenceFlow" });
    }
    if ((props.saidas ?? "").trim()) {
      const ann2 = modeling.createShape(
        { type: "bpmn:TextAnnotation" },
        { x: x + 140, y: y + 60 },
        root
      );
      modeling.updateProperties(ann2, { text: props.saidas });
      modeling.connect(end, ann2, { type: "bpmn:Association" });
    }
    const res = await modelerRef.current?.saveXML({ format: true });
    const xml = res?.xml ?? "";
    localStorage.setItem(STORAGE_KEY, xml);
    setLastSavedXml(xml);
    setDirty(false);
  };

  const handleReset = async () => {
    if (!lastSavedXml) return;
    await modelerRef.current?.importXML(lastSavedXml);
    setDirty(false);
  };

  const handleToggleMode = async () => {
    const res = await modelerRef.current?.saveXML?.({ format: true });
    const xml = res?.xml ?? lastSavedXml;
    modelerRef.current?.destroy();
    modelerRef.current = null;
    setMode((m) => (m === "modeler" ? "viewer" : "modeler"));
    setTimeout(async () => {
      if (!containerRef.current) return;
      let instance: ModelerLike;
      if (mode === "modeler") {
        const { default: BpmnViewer } = await import("bpmn-js/lib/Viewer");
        instance = new (BpmnViewer as unknown as { new (opts: unknown): ModelerLike })({
          container: containerRef.current,
        }) as unknown as ModelerLike;
      } else {
        const { default: BpmnModeler } = await import("bpmn-js/lib/Modeler");
        instance = new (BpmnModeler as unknown as { new (opts: unknown): ModelerLike })({
          container: containerRef.current,
          keyboard: { bindTo: document },
        }) as unknown as ModelerLike;
      }
      modelerRef.current = instance;
      await instance.importXML(xml);
    }, 30);
  };

  return (
    <div className="bpmn-card">
      <div className="bpmn-toolbar">
        <button onClick={handleNovo}>Novo</button>
        <button onClick={handleSalvar}>Salvar</button>
        <button onClick={handleExportar}>Exportar BPMN</button>
        <button onClick={handleExportarSVG}>Exportar SVG</button>
        <button onClick={handleImportar}>Importar BPMN</button>
        <button onClick={handleGerar}>Gerar do Formulário</button>
        <button onClick={handleReset}>Resetar</button>
        <button onClick={handleToggleMode}>{mode === "modeler" ? "Modo leitura" : "Modo edição"}</button>
        {dirty && <span className="text-xs text-warning ml-2">Alterado</span>}
      </div>
      <div className="bpmn-container" ref={containerRef} />
    </div>
  );
}
