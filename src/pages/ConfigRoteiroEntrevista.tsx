import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_SCRIPT = `Você é um entrevistador de processos com tom humano e didático.
Siga estas regras principais e adapte-se caso o usuário especifique novas prioridades:
- Faça perguntas curtas e diretas
- Progrida fase a fase
- Estimule sempre o máximo de detalhes objetivos sobre cada resposta (quem faz, o que faz, quando, onde, ferramentas, documentos, exceções).

Seja sempre educado.`;

const ConfigRoteiroEntrevista = () => {
  const [roteiro, setRoteiro] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedScript = localStorage.getItem("process:routeScript");
    if (savedScript) {
      setRoteiro(savedScript);
    } else {
      setRoteiro(DEFAULT_SCRIPT);
    }
  }, []);

  const extractFromPdf = async (file: File): Promise<string> => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker as string;
    const buf = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: buf });
    const pdf = await loadingTask.promise;
    let full = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((it: unknown) => {
          const rec = it as { str?: unknown };
          return typeof rec.str === "string" ? rec.str : "";
        })
        .filter((s) => s && s.trim().length > 0)
        .join(" ");
      full += "\n" + pageText;
    }
    return full.trim();
  };

  const extractFromDocx = async (file: File): Promise<string> => {
    const mammoth = await import("mammoth/mammoth.browser");
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    return String(res.value || "").trim();
  };

  const extractFromImage = async (file: File): Promise<string> => {
    const Tesseract = await import("tesseract.js");
    const result = await Tesseract.recognize(file, "por+eng");
    return String(result.data?.text || "").trim();
  };

  const handleImportFile = async (file: File) => {
    setIsImporting(true);
    try {
      const name = file.name.toLowerCase();
      let text = "";
      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        text = await extractFromPdf(file);
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) {
        text = await extractFromDocx(file);
      } else if ((file.type.startsWith("image/")) || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
        text = await extractFromImage(file);
      } else {
        toast({
          title: "Formato não suportado",
          description: "Use PDF, DOCX ou imagem.",
          variant: "destructive",
        });
        return;
      }
      const snippet = text.length > 16000 ? text.slice(0, 16000) : text;
      if (!snippet) {
        toast({
          title: "Nenhum texto encontrado",
          description: "Não foi possível extrair texto do documento.",
          variant: "destructive",
        });
        return;
      }
      setRoteiro((prev) => {
        if (!prev.trim()) return snippet;
        return `${prev.trim()}\n\n${snippet}`;
      });
      toast({
        title: "Documento importado",
        description: "O texto do documento foi adicionado ao roteiro. Revise antes de salvar.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao processar o arquivo.";
      toast({
        title: "Falha ao importar documento",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem("process:routeScript", roteiro);
      toast({
        title: "Roteiro atualizado",
        description: "O roteiro da entrevista com a IA foi salvo e será utilizado nos próximos mapeamentos.",
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o roteiro.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setRoteiro(DEFAULT_SCRIPT);
  };

  const handleReview = async () => {
    if (!roteiro.trim()) {
      toast({
        title: "Roteiro vazio",
        description: "Preencha o roteiro antes de pedir revisão com IA.",
        variant: "destructive",
      });
      return;
    }
    setIsReviewing(true);
    try {
      const skinRaw = localStorage.getItem("process:aiSkin");
      const skin = skinRaw ? JSON.parse(skinRaw) : null;
      const { data, error } = await supabase.functions.invoke("ai-review-config", {
        body: { roteiro, skin },
      });
      if (error) throw error;
      if (data?.error) {
        toast({
          title: "Falha na revisão",
          description: data.error as string,
          variant: "destructive",
        });
        return;
      }
      if (data?.roteiroSugerido && typeof data.roteiroSugerido === "string") {
        setRoteiro(data.roteiroSugerido);
      }
      toast({
        title: "Roteiro revisado",
        description: data?.comentarios || "A IA sugeriu ajustes no roteiro e na skin.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao revisar com IA.";
      toast({
        title: "Falha na revisão",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Roteiro IA</h1>
        <p className="text-muted-foreground">Configure as diretrizes e comportamentos para a IA durante as entrevistas de mapeamento de processos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instruções para o Assistente (System Prompt)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            As instruções que você preencher abaixo serão enviadas para a Inteligência Artificial no momento da entrevista.
            Você pode pedir para ela seguir um roteiro específico, utilizar jargões da sua empresa, perguntar no formato de uma determinada metodologia, etc.
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Documento base do roteiro (opcional)</Label>
              <Input
                type="file"
                accept=".pdf,.docx,image/*"
                disabled={isSaving || isImporting}
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  if (!file) return;
                  await handleImportFile(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>
            <div className="space-y-2">
              <Textarea
                className="min-h-[300px]"
                placeholder="Digite as instruções..."
                value={roteiro}
                onChange={(e) => setRoteiro(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleSave} disabled={isSaving || isReviewing}>
              {isSaving ? "Salvando..." : "Salvar Configuração"}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={isImporting || isReviewing}>
              Restaurar Padrão
            </Button>
            <Button variant="outline" onClick={handleReview} disabled={isReviewing || isSaving || isImporting}>
              {isReviewing ? "Revisando com IA..." : "Pedir sugestão com IA"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfigRoteiroEntrevista;
