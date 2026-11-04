import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ORIGEM_ACAO, STATUS_ACAO, type Acao } from "@/lib/plano-de-acao";

export type RascunhoAcao = Pick<Acao, "oque" | "porque" | "onde" | "como" | "quem" | "prazo" | "custo" | "status" | "processo_id" | "resultado">;

const VAZIO: RascunhoAcao = { oque: "", porque: "", onde: "", como: "", quem: "", prazo: null, custo: "", status: "A fazer", processo_id: null, resultado: "" };
const SEM_PROCESSO = "sem-processo";

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
    </div>
  );
}

// `acao` null com `aberto`: nova ação.
export function EditorAcao({
  aberto,
  acao,
  processos,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  acao: Acao | null;
  processos: Array<{ id: string; nome: string }>;
  onFechar: () => void;
  onSalvar: (rascunho: RascunhoAcao) => Promise<boolean>;
}) {
  const [rascunho, setRascunho] = useState<RascunhoAcao>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) setRascunho(acao ? { ...VAZIO, ...acao } : VAZIO);
  }, [aberto, acao]);

  const alterar = (parcial: Partial<RascunhoAcao>) => setRascunho((atual) => ({ ...atual, ...parcial }));
  const texto = (campo: keyof RascunhoAcao) => ({
    id: `acao-${campo}`,
    value: String(rascunho[campo] ?? ""),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => alterar({ [campo]: event.target.value }),
  });

  const salvar = async () => {
    setSalvando(true);
    const ok = await onSalvar({ ...rascunho, oque: rascunho.oque.trim() });
    setSalvando(false);
    if (ok) onFechar();
  };

  return (
    <Sheet open={aberto} onOpenChange={(valor) => !valor && !salvando && onFechar()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{acao ? "Editar ação" : "Nova ação"}</SheetTitle>
          <SheetDescription>{acao ? ORIGEM_ACAO[acao.origem] ?? acao.origem : "Registre o que será feito, por quem e até quando."}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Campo id="acao-oque" rotulo="O quê *"><Textarea rows={2} {...texto("oque")} /></Campo>
          <Campo id="acao-porque" rotulo="Por quê"><Textarea rows={2} {...texto("porque")} /></Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="acao-quem" rotulo="Quem"><Input {...texto("quem")} /></Campo>
            <Campo id="acao-prazo" rotulo="Quando (prazo)">
              <Input id="acao-prazo" type="date" value={rascunho.prazo ?? ""} onChange={(event) => alterar({ prazo: event.target.value || null })} />
              {!rascunho.prazo && acao?.quando_texto ? <p className="text-xs text-muted-foreground">No plano: {acao.quando_texto}</p> : null}
            </Campo>
            <Campo id="acao-onde" rotulo="Onde"><Input {...texto("onde")} /></Campo>
            <Campo id="acao-custo" rotulo="Quanto"><Input {...texto("custo")} /></Campo>
          </div>
          <Campo id="acao-como" rotulo="Como"><Textarea rows={2} {...texto("como")} /></Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="acao-processo" rotulo="Processo">
              <Select value={rascunho.processo_id ?? SEM_PROCESSO} onValueChange={(valor) => alterar({ processo_id: valor === SEM_PROCESSO ? null : valor })}>
                <SelectTrigger id="acao-processo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_PROCESSO}>Sem processo</SelectItem>
                  {processos.map((processo) => <SelectItem key={processo.id} value={processo.id}>{processo.nome || "Sem nome"}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            <Campo id="acao-status" rotulo="Status">
              <Select value={rascunho.status} onValueChange={(valor) => alterar({ status: valor })}>
                <SelectTrigger id="acao-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ACAO.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <Campo id="acao-resultado" rotulo="Resultado e verificação de eficácia">
            <Textarea rows={3} placeholder="O que mudou depois da ação? Ela resolveu o problema?" {...texto("resultado")} />
          </Campo>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando || !rascunho.oque.trim()}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
