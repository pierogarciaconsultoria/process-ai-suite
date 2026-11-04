import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatarMeta, lerNumero, type Indicador, type Medicao } from "@/lib/indicadores";

// Lança (ou corrige) o resultado de um mês. `periodo` é o primeiro dia do mês ("2026-11-01").
export function LancarResultado({
  indicador,
  periodoInicial,
  medicoes,
  onFechar,
  onSalvar,
}: {
  indicador: Indicador | null;
  periodoInicial: string;
  medicoes: Medicao[];
  onFechar: () => void;
  onSalvar: (periodo: string, valor: number, comentario: string) => Promise<boolean>;
}) {
  const [mes, setMes] = useState(periodoInicial.slice(0, 7));
  const [valor, setValor] = useState("");
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);

  const periodo = `${mes}-01`;
  const existente = indicador ? medicoes.find((medicao) => medicao.indicador_id === indicador.id && medicao.periodo === periodo) : undefined;

  useEffect(() => {
    setMes(periodoInicial.slice(0, 7));
  }, [periodoInicial, indicador]);

  // Ao trocar de mês, mostra o que já foi lançado nele.
  useEffect(() => {
    setValor(existente ? String(existente.valor).replace(".", ",") : "");
    setComentario(existente?.comentario ?? "");
  }, [existente]);

  const numero = lerNumero(valor);
  const valido = /^\d{4}-\d{2}$/.test(mes) && numero !== null;

  const salvar = async () => {
    if (numero === null) return;
    setSalvando(true);
    const ok = await onSalvar(periodo, numero, comentario.trim());
    setSalvando(false);
    if (ok) onFechar();
  };

  return (
    <Dialog open={indicador !== null} onOpenChange={(aberto) => !aberto && !salvando && onFechar()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar resultado</DialogTitle>
          <DialogDescription>{indicador ? `${indicador.nome} · meta ${formatarMeta(indicador)}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="resultado-mes">Mês</Label>
              <Input id="resultado-mes" type="month" value={mes} onChange={(event) => setMes(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="resultado-valor">Resultado{indicador?.unidade ? ` (${indicador.unidade})` : ""}</Label>
              <Input id="resultado-valor" inputMode="decimal" value={valor} onChange={(event) => setValor(event.target.value)} placeholder="Ex.: 92,5" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="resultado-comentario">Comentário</Label>
            <Textarea id="resultado-comentario" rows={2} value={comentario} onChange={(event) => setComentario(event.target.value)} placeholder="O que explica o resultado do mês?" />
          </div>
          {existente ? <p className="text-xs text-muted-foreground">Este mês já tem resultado; salvar substitui o valor.</p> : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando || !valido}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
