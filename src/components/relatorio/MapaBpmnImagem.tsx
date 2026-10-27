import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface BpmnViewer {
  importXML(xml: string): Promise<unknown>;
  saveSVG(): Promise<{ svg: string }>;
  destroy(): void;
}

// Converte o XML BPMN em SVG estático. O bpmn-js precisa de um container no DOM
// para medir textos, por isso renderiza fora da área visível e depois descarta.
async function bpmnParaSvg(xml: string): Promise<string> {
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;left:-10000px;top:0;width:1600px;height:1000px;";
  document.body.appendChild(container);
  const { default: Viewer } = await import("bpmn-js/lib/Viewer");
  const viewer = new Viewer({ container }) as unknown as BpmnViewer;
  try {
    await viewer.importXML(xml);
    return (await viewer.saveSVG()).svg;
  } finally {
    viewer.destroy();
    container.remove();
  }
}

export function MapaBpmnImagem({ xml }: { xml: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setSvg(null);
    setFalhou(false);
    bpmnParaSvg(xml)
      .then((resultado) => {
        if (!cancelado) setSvg(resultado);
      })
      .catch((error) => {
        console.error("Não foi possível desenhar o mapa BPMN:", error);
        if (!cancelado) setFalhou(true);
      });
    return () => {
      cancelado = true;
    };
  }, [xml]);

  if (falhou) return <p className="text-sm text-muted-foreground">Não foi possível desenhar o mapa a partir do BPMN salvo.</p>;
  if (!svg) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Desenhando o mapa…
      </div>
    );
  }
  return (
    <img
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
      alt="Mapa do processo AS IS em BPMN"
      className="h-auto w-full rounded-md border bg-white p-2"
    />
  );
}
