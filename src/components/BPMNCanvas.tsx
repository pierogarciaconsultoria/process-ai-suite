import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, Sparkles, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ProcessoFormData } from "@/data/processo-form-types";

// Default empty BPMN diagram
const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Início" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="183" y="203" width="30" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

interface BPMNCanvasProps {
  xml?: string;
  onChange?: (xml: string) => void;
  readOnly?: boolean;
  formData?: ProcessoFormData;
  mode?: "as-is" | "to-be";
}

interface BpmnCanvas {
  zoom(value?: number | "fit-viewport"): number | void;
}

interface BpmnInstance {
  importXML(xml: string): Promise<void>;
  get(service: "canvas"): BpmnCanvas;
  saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
  on(event: string, handler: () => void): void;
  destroy(): void;
}

export default function BPMNCanvas({ xml, onChange, readOnly = false, formData, mode = "as-is" }: BPMNCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bpmnInstanceRef = useRef<BpmnInstance | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!containerRef.current) return;

    let instance: BpmnInstance;

    const initBpmn = async () => {
      try {
        if (readOnly) {
          const { default: BpmnViewer } = await import("bpmn-js/lib/NavigatedViewer");
          instance = new BpmnViewer({ container: containerRef.current! }) as unknown as BpmnInstance;
        } else {
          const { default: BpmnModeler } = await import("bpmn-js/lib/Modeler");
          instance = new BpmnModeler({ container: containerRef.current! }) as unknown as BpmnInstance;
        }

        bpmnInstanceRef.current = instance;

        const xmlToLoad = xml || EMPTY_BPMN;
        await instance.importXML(xmlToLoad);

        const canvas = instance.get("canvas");
        canvas.zoom("fit-viewport");
        setIsLoaded(true);

        // Listen for changes (modeler only)
        if (!readOnly && onChange) {
          instance.on("commandStack.changed", async () => {
            try {
              const { xml: updatedXml } = await instance.saveXML({ format: true });
              onChange(updatedXml);
            } catch (err) {
              console.error("Error saving XML:", err);
            }
          });
        }
      } catch (err) {
        console.error("Error initializing BPMN:", err);
      }
    };

    initBpmn();

    return () => {
      if (instance) {
        instance.destroy();
      }
      bpmnInstanceRef.current = null;
      setIsLoaded(false);
    };
    // Only re-init when readOnly changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Update XML when prop changes (after initial load)
  useEffect(() => {
    if (!bpmnInstanceRef.current || !xml) return;

    const updateXml = async () => {
      try {
        await bpmnInstanceRef.current.importXML(xml);
        const canvas = bpmnInstanceRef.current.get("canvas");
        canvas.zoom("fit-viewport");
      } catch (err) {
        console.error("Error updating BPMN XML:", err);
      }
    };

    updateXml();
  }, [xml]);

  const handleZoomIn = () => {
    if (!bpmnInstanceRef.current) return;
    const canvas = bpmnInstanceRef.current.get("canvas");
    const current = canvas.zoom() as number;
    canvas.zoom(current * 1.2);
  };

  const handleZoomOut = () => {
    if (!bpmnInstanceRef.current) return;
    const canvas = bpmnInstanceRef.current.get("canvas");
    const current = canvas.zoom() as number;
    canvas.zoom(current / 1.2);
  };

  const handleFitViewport = () => {
    if (!bpmnInstanceRef.current) return;
    const canvas = bpmnInstanceRef.current.get("canvas");
    canvas.zoom("fit-viewport");
  };

  const handleExportXml = async () => {
    if (!bpmnInstanceRef.current) return;
    try {
      const { xml: exportedXml } = await bpmnInstanceRef.current.saveXML({ format: true });
      const blob = new Blob([exportedXml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bpmn-${mode}-${Date.now()}.bpmn`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting XML:", err);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!formData) {
      toast({
        title: "Dados insuficientes",
        description: "Preencha as atividades ou o objetivo do processo antes de gerar o mapa.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-bpmn", {
        body: {
          etapas: formData.etapas,
          decisoes: formData.decisoes,
          gatilho: formData.gatilho,
          entradas: formData.entradas,
          saidas: formData.saidas,
          nomeProcesso: formData.nomeProcesso,
          resumo: formData.objetivo,
          mode,
          oportunidadesMelhoria: mode === "to-be" ? formData.oportunidadesMelhoria : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const generatedXml = data.xml || data;

      if (bpmnInstanceRef.current) {
        await bpmnInstanceRef.current.importXML(generatedXml);
        const canvas = bpmnInstanceRef.current.get("canvas");
        canvas.zoom("fit-viewport");
      }

      if (onChange) {
        onChange(generatedXml);
      }

      toast({ title: "Mapa gerado!", description: "O diagrama BPMN foi gerado pela IA. Você pode editá-lo livremente." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      console.error("AI generate BPMN error:", err);
      toast({ title: "Erro ao gerar mapa BPMN", description: message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={handleZoomIn} disabled={!isLoaded}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleZoomOut} disabled={!isLoaded}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleFitViewport} disabled={!isLoaded}>
          <Maximize className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportXml} disabled={!isLoaded}>
          <Download className="h-4 w-4 mr-1" /> Exportar
        </Button>

        <div className="flex-1" />

        {formData && (
          <Button size="sm" onClick={handleGenerateWithAI} disabled={isGenerating || !isLoaded}>
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-1" /> Gerar Mapa com IA</>
            )}
          </Button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="border rounded-lg bg-background"
        style={{ width: "100%", height: "600px" }}
      />
    </div>
  );
}
