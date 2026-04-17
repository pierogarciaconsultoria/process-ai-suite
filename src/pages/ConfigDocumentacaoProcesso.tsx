import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";

const DEFAULT_TEMPLATE = `Use este espaço para definir o modelo padrão de documentação de processos da sua empresa.

Sugestão de estrutura:
- Identificação do Processo (nome, área, dono, código, data)
- Objetivo
- Escopo (o que está incluído e o que está excluído)
- Entradas e Fornecedores
- Atividades (passo a passo)
- Decisões e Regras de Negócio
- Saídas e Clientes
- Indicadores
- Riscos e Controles
- Anexos e Referências (políticas, normas, manuais)

Você pode ajustar estes tópicos conforme a metodologia da sua organização.`;

const ConfigDocumentacaoProcesso = () => {
  const [modelo, setModelo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("process:docTemplate");
    if (saved) {
      setModelo(saved);
    } else {
      setModelo(DEFAULT_TEMPLATE);
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
      } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
        text = await extractFromImage(file);
      } else {
        toast({
          title: "Formato não suportado",
          description: "Use PDF, DOCX ou imagem.",
          variant: "destructive",
        });
        return;
      }
      const snippet = text.length > 20000 ? text.slice(0, 20000) : text;
      if (!snippet) {
        toast({
          title: "Nenhum texto encontrado",
          description: "Não foi possível extrair texto do documento.",
          variant: "destructive",
        });
        return;
      }
      setModelo((prev) => {
        if (!prev.trim()) return snippet;
        return `${prev.trim()}\n\n${snippet}`;
      });
      toast({
        title: "Documento importado",
        description: "O conteúdo do documento foi adicionado ao modelo. Revise antes de salvar.",
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
      localStorage.setItem("process:docTemplate", modelo);
      toast({
        title: "Modelo atualizado",
        description: "O modelo de documentação de processos foi salvo.",
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o modelo.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setModelo(DEFAULT_TEMPLATE);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Documentação do Processo</h1>
        <p className="text-muted-foreground">
          Defina o modelo padrão de documentação que será usado como referência para os processos (texto base e, se quiser, importação de um documento existente).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelo de Documentação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Preencha abaixo o esqueleto da documentação de processos da sua empresa. Você pode colar um modelo já existente ou importar um arquivo para acelerar.
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Documento base (opcional)</Label>
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
              <Label>Texto do modelo</Label>
              <Textarea
                className="min-h-[320px]"
                placeholder="Descreva o modelo padrão de documentação..."
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar Configuração"}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={isImporting}>
              Restaurar Padrão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfigDocumentacaoProcesso;

