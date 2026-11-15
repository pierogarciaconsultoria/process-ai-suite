import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { confirmacaoConfere, excluirEmpresa, exportarDadosDaEmpresa } from "@/lib/dados-da-empresa";

// Exportar (JSON com tudo da empresa) e excluir a empresa, digitando o nome para confirmar.
// Quem pode cada coisa é decidido no banco (migration 202611150003).
export function DadosDaEmpresa({ empresaId, nome, onExcluida }: { empresaId: string; nome: string; onExcluida: (id: string) => void }) {
  const { toast } = useToast();
  const [exportando, setExportando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  const exportar = async () => {
    setExportando(true);
    const { erro: falha } = await exportarDadosDaEmpresa(empresaId, nome);
    setExportando(false);
    if (falha) toast({ title: "Não foi possível exportar", description: falha, variant: "destructive" });
    else toast({ title: "Dados exportados", description: `O arquivo com os dados de ${nome} foi baixado.` });
  };

  const excluir = async () => {
    setExcluindo(true);
    setErro("");
    const { erro: falha } = await excluirEmpresa(empresaId, digitado);
    setExcluindo(false);
    if (falha) {
      setErro(falha);
      return;
    }
    setAberto(false);
    toast({ title: "Empresa excluída", description: `${nome} e todos os dados dela foram excluídos.` });
    onExcluida(empresaId);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => void exportar()} disabled={exportando} aria-label={`Exportar dados de ${nome}`}>
        {exportando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
        Exportar
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => {
          setDigitado("");
          setErro("");
          setAberto(true);
        }}
        aria-label={`Excluir ${nome}`}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Excluir
      </Button>

      <AlertDialog open={aberto} onOpenChange={(valor) => !excluindo && setAberto(valor)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {nome}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Isso apaga de vez a empresa e tudo o que é dela: processos, entrevistas, mapas, documentos, plano de ação, indicadores,
                  conversas, chamados, membros e convites. Não dá para desfazer.
                </p>
                <p>Antes, use Exportar para guardar uma cópia. Só o dono, o administrador da conta ou a plataforma podem excluir.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`confirma-${empresaId}`}>Para confirmar, digite o nome da empresa: <strong>{nome}</strong></Label>
            <Input id={`confirma-${empresaId}`} value={digitado} onChange={(event) => setDigitado(event.target.value)} autoComplete="off" />
            {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void excluir()} disabled={excluindo || !confirmacaoConfere(nome, digitado)}>
              {excluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />} Excluir de vez
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
