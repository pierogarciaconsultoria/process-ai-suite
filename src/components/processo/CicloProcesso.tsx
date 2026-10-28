import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ACOES_CICLO, ETAPAS_CICLO, acoesDisponiveis, normalizarStatus, type AcaoCiclo } from "@/lib/ciclo-processo";

const DICA_POR_STATUS: Record<string, string> = {
  "Em entrevista": "Conclua a entrevista com o Peter para gerar o diagnóstico.",
  Diagnosticado: "Diagnóstico validado: a documentação já pode ser gerada em \"Criar procedimento\". Falta aprovar o plano de melhoria na Etapa 6 da entrevista.",
  "Melhorias aprovadas": "Quando as melhorias estiverem implantadas, marque o processo como implementado e revise a documentação.",
  Implementado: "Processo implementado: a documentação pode ser gerada em \"Criar procedimento\".",
  Obsoleto: "Este processo não está mais em uso e não aceita nova documentação.",
};

export function CicloProcesso({ status, onAcao }: { status: string; onAcao: (acao: AcaoCiclo) => Promise<void> }) {
  const atual = normalizarStatus(status);
  const indiceAtual = ETAPAS_CICLO.findIndex((etapa) => etapa.status === atual);
  const [acaoAberta, setAcaoAberta] = useState<AcaoCiclo | null>(null);
  const [executando, setExecutando] = useState(false);

  const confirmar = async () => {
    if (!acaoAberta) return;
    setExecutando(true);
    try {
      await onAcao(acaoAberta);
      setAcaoAberta(null);
    } finally {
      setExecutando(false);
    }
  };

  return (
    <Card className="no-print">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Ciclo do processo</h2>
          {atual === "Obsoleto" && <Badge variant="secondary">Obsoleto</Badge>}
        </div>

        <ol className="grid gap-3 sm:grid-cols-4" aria-label="Etapas do ciclo do processo">
          {ETAPAS_CICLO.map((etapa, indice) => {
            const concluida = atual !== "Obsoleto" && indice < indiceAtual;
            const corrente = indice === indiceAtual;
            return (
              <li
                key={etapa.status}
                aria-current={corrente ? "step" : undefined}
                className={`flex gap-3 rounded-md border p-3 ${corrente ? "border-primary bg-primary/5" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    concluida || corrente ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {concluida ? <Check className="h-3.5 w-3.5" /> : indice + 1}
                </span>
                <div>
                  <div className={`text-sm font-medium ${corrente ? "text-foreground" : "text-muted-foreground"}`}>{etapa.status}</div>
                  <div className="text-xs text-muted-foreground">{etapa.descricao}</div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{DICA_POR_STATUS[atual]}</p>
          <div className="flex flex-wrap gap-2">
            {acoesDisponiveis(atual).map((acao) => (
              <Button
                key={acao}
                size="sm"
                variant={acao === "implementar" ? "default" : "outline"}
                onClick={() => setAcaoAberta(acao)}
              >
                {ACOES_CICLO[acao].rotulo}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>

      <AlertDialog open={acaoAberta !== null} onOpenChange={(aberto) => !aberto && !executando && setAcaoAberta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{acaoAberta ? ACOES_CICLO[acaoAberta].rotulo : ""}</AlertDialogTitle>
            <AlertDialogDescription>{acaoAberta ? ACOES_CICLO[acaoAberta].confirmacao : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={executando}
              onClick={(event) => {
                event.preventDefault();
                void confirmar();
              }}
            >
              {executando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
