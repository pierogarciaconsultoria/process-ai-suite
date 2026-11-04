import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { lerNumero, PERIODICIDADES, type Indicador } from "@/lib/indicadores";

export type RascunhoIndicador = Pick<Indicador, "nome" | "processo_id" | "objetivo" | "formula" | "unidade" | "sentido" | "meta" | "periodicidade" | "responsavel">;

const VAZIO: RascunhoIndicador = { nome: "", processo_id: null, objetivo: "", formula: "", unidade: "", sentido: "maior", meta: null, periodicidade: "Mensal", responsavel: "" };
const SEM_PROCESSO = "sem-processo";

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
    </div>
  );
}

export function EditorIndicador({
  aberto,
  indicador,
  processos,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  indicador: Indicador | null;
  processos: Array<{ id: string; nome: string }>;
  onFechar: () => void;
  onSalvar: (rascunho: RascunhoIndicador) => Promise<boolean>;
}) {
  const [rascunho, setRascunho] = useState<RascunhoIndicador>(VAZIO);
  const [meta, setMeta] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const inicial = indicador ? { ...VAZIO, ...indicador } : VAZIO;
    setRascunho(inicial);
    setMeta(inicial.meta === null ? "" : String(inicial.meta).replace(".", ","));
  }, [aberto, indicador]);

  const alterar = (parcial: Partial<RascunhoIndicador>) => setRascunho((atual) => ({ ...atual, ...parcial }));
  const metaNumero = lerNumero(meta);
  const metaInvalida = meta.trim() !== "" && metaNumero === null;

  const salvar = async () => {
    setSalvando(true);
    const ok = await onSalvar({ ...rascunho, nome: rascunho.nome.trim(), meta: metaNumero });
    setSalvando(false);
    if (ok) onFechar();
  };

  return (
    <Sheet open={aberto} onOpenChange={(valor) => !valor && !salvando && onFechar()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{indicador ? "Editar indicador" : "Novo indicador"}</SheetTitle>
          <SheetDescription>O que é medido, como se calcula e qual resultado se espera.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Campo id="indicador-nome" rotulo="Indicador *">
            <Input id="indicador-nome" value={rascunho.nome} onChange={(event) => alterar({ nome: event.target.value })} placeholder="Ex.: Entregas no prazo" />
          </Campo>
          <Campo id="indicador-formula" rotulo="Fórmula">
            <Textarea id="indicador-formula" rows={2} value={rascunho.formula} onChange={(event) => alterar({ formula: event.target.value })} placeholder="Ex.: entregas no prazo ÷ total de entregas × 100" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="indicador-sentido" rotulo="Melhor quando">
              <Select value={rascunho.sentido} onValueChange={(valor) => alterar({ sentido: valor })}>
                <SelectTrigger id="indicador-sentido"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="maior">Maior</SelectItem>
                  <SelectItem value="menor">Menor</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            <Campo id="indicador-meta" rotulo="Meta">
              <Input id="indicador-meta" inputMode="decimal" value={meta} onChange={(event) => setMeta(event.target.value)} placeholder="Ex.: 95" />
              {metaInvalida ? <p className="text-xs text-destructive">Use só o número, por exemplo 95 ou 2,5.</p> : null}
              {!meta && indicador?.meta_texto ? <p className="text-xs text-muted-foreground">No mapeamento: {indicador.meta_texto}</p> : null}
            </Campo>
            <Campo id="indicador-unidade" rotulo="Unidade">
              <Input id="indicador-unidade" value={rascunho.unidade} onChange={(event) => alterar({ unidade: event.target.value })} placeholder="%, dias, R$" />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="indicador-periodicidade" rotulo="Periodicidade">
              <Select value={rascunho.periodicidade} onValueChange={(valor) => alterar({ periodicidade: valor })}>
                <SelectTrigger id="indicador-periodicidade"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((opcao) => <SelectItem key={opcao} value={opcao}>{opcao}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            <Campo id="indicador-responsavel" rotulo="Responsável pela medição">
              <Input id="indicador-responsavel" value={rascunho.responsavel} onChange={(event) => alterar({ responsavel: event.target.value })} />
            </Campo>
          </div>
          <Campo id="indicador-processo" rotulo="Processo">
            <Select value={rascunho.processo_id ?? SEM_PROCESSO} onValueChange={(valor) => alterar({ processo_id: valor === SEM_PROCESSO ? null : valor })}>
              <SelectTrigger id="indicador-processo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_PROCESSO}>Sem processo</SelectItem>
                {processos.map((processo) => <SelectItem key={processo.id} value={processo.id}>{processo.nome || "Sem nome"}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo id="indicador-objetivo" rotulo="Objetivo">
            <Textarea id="indicador-objetivo" rows={2} value={rascunho.objetivo} onChange={(event) => alterar({ objetivo: event.target.value })} placeholder="Para que serve acompanhar este número?" />
          </Campo>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando || !rascunho.nome.trim() || metaInvalida}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
