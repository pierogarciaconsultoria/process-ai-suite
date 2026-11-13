import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { extrairTextoDocx, extrairTextoPdf } from "@/lib/peter-upload";
import { MAX_DOCUMENTO_DE_APOIO } from "../../../supabase/functions/_shared/procedimento-padrao";

export interface DocumentoDeApoioValor {
  nome: string;
  texto: string;
}

const TAMANHO_MAX = 10 * 1024 * 1024;

// Procedimento ou instrução que a empresa já usa para o processo. O Peter usa o texto para
// detalhar o "como fazer"; a ordem e os responsáveis continuam vindo do mapeamento.
export function DocumentoDeApoio({ valor, onChange }: { valor: DocumentoDeApoioValor | null; onChange: (valor: DocumentoDeApoioValor | null) => void }) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const anexar = async (arquivo: File | undefined) => {
    if (arquivoRef.current) arquivoRef.current.value = "";
    if (!arquivo) return;
    setErro(null);
    const pdf = /\.pdf$/i.test(arquivo.name);
    if (!pdf && !/\.docx$/i.test(arquivo.name)) {
      setErro("Anexe o documento em PDF ou Word (.docx).");
      return;
    }
    if (arquivo.size > TAMANHO_MAX) {
      setErro("O arquivo deve ter no máximo 10 MB.");
      return;
    }
    setLendo(true);
    try {
      const texto = pdf ? await extrairTextoPdf(arquivo) : await extrairTextoDocx(arquivo);
      onChange({ nome: arquivo.name, texto });
    } catch (error) {
      setErro(error instanceof Error ? error.message : `Não foi possível ler "${arquivo.name}".`);
    } finally {
      setLendo(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Documento de apoio (opcional)</Label>
      <p className="text-xs text-muted-foreground">
        Anexe o procedimento ou a instrução que a empresa já usa para este processo. O Peter usa o texto para detalhar como executar cada atividade.
      </p>
      <input
        ref={arquivoRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        data-testid="documento-apoio"
        onChange={(event) => void anexar(event.target.files?.[0])}
      />
      {valor ? (
        <div className="flex max-w-full items-center gap-2 rounded-md border bg-muted/40 py-1 pl-2 pr-1 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{valor.nome}</span>
          {valor.texto.length > MAX_DOCUMENTO_DE_APOIO && <span className="shrink-0 text-xs text-muted-foreground">(só o início)</span>}
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onChange(null)} aria-label={`Remover ${valor.nome}`}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={lendo} onClick={() => arquivoRef.current?.click()}>
          {lendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
          {lendo ? "Lendo o documento..." : "Anexar PDF ou Word"}
        </Button>
      )}
      {erro && <p className="text-xs text-destructive" role="alert">{erro}</p>}
    </div>
  );
}
