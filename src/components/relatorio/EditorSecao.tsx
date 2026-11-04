import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/integrations/supabase/types";
import {
  camposDaSecao,
  lerEstadoDoProcesso,
  rascunhoDaSecao,
  TITULO_SECAO,
  type CampoTexto,
  type RascunhoSecao,
  type SecaoEditavel,
} from "@/lib/edicao-processo";

type Coluna<T> = { chave: keyof T & string; rotulo: string; largo?: boolean };

// Lista de linhas editáveis (entradas, atividades, indicadores…), com incluir, remover e reordenar.
function ListaEditavel<T extends object>({
  titulo,
  itens,
  colunas,
  novo,
  rotuloNovo,
  ordenavel = false,
  onChange,
}: {
  titulo: string;
  itens: T[];
  colunas: Array<Coluna<T>>;
  novo: () => T;
  rotuloNovo: string;
  ordenavel?: boolean;
  onChange: (itens: T[]) => void;
}) {
  const alterar = (indice: number, chave: keyof T & string, valor: string) =>
    onChange(itens.map((item, i) => (i === indice ? { ...item, [chave]: valor } : item)));
  const mover = (indice: number, destino: number) => {
    const proximos = [...itens];
    const [item] = proximos.splice(indice, 1);
    proximos.splice(destino, 0, item);
    onChange(proximos);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{titulo}</legend>
      {itens.map((item, indice) => (
        <div key={indice} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{ordenavel ? `Passo ${indice + 1}` : `${indice + 1}.`}</span>
            <div className="flex">
              {ordenavel && (
                <>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={indice === 0} onClick={() => mover(indice, indice - 1)} aria-label={`Subir item ${indice + 1}`}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={indice === itens.length - 1} onClick={() => mover(indice, indice + 1)} aria-label={`Descer item ${indice + 1}`}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(itens.filter((_, i) => i !== indice))} aria-label={`Remover item ${indice + 1}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {colunas.map((coluna) => (
              <div key={coluna.chave} className={coluna.largo ? "sm:col-span-2" : ""}>
                <Label className="text-xs text-muted-foreground">{coluna.rotulo}</Label>
                <Input
                  aria-label={`${coluna.rotulo} ${indice + 1}`}
                  value={String(item[coluna.chave] ?? "")}
                  onChange={(event) => alterar(indice, coluna.chave, event.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...itens, novo()])}>
        <Plus className="mr-1 h-4 w-4" /> {rotuloNovo}
      </Button>
    </fieldset>
  );
}

function CampoDeTexto({ campo, valor, onChange }: { campo: CampoTexto; valor: string; onChange: (valor: string) => void }) {
  const id = `campo-${campo.chave}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{campo.rotulo}</Label>
      {campo.tipo === "opcao" ? (
        <Select value={valor} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue placeholder="Escolha" /></SelectTrigger>
          <SelectContent>
            {(campo.opcoes ?? []).map((opcao) => <SelectItem key={opcao} value={opcao}>{opcao}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : campo.tipo === "texto" ? (
        <Textarea id={id} rows={3} value={valor} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input id={id} type={campo.tipo === "data" ? "date" : "text"} value={valor} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

export function EditorSecao({
  processo,
  secao,
  onFechar,
  onSalvar,
  indicadoresNoModulo = false,
}: {
  processo: Tables<"processos">;
  secao: SecaoEditavel | null;
  onFechar: () => void;
  onSalvar: (secao: SecaoEditavel, rascunho: RascunhoSecao) => Promise<boolean>;
  // Os indicadores já são acompanhados no módulo Indicadores e são editados lá.
  indicadoresNoModulo?: boolean;
}) {
  const [rascunho, setRascunho] = useState<RascunhoSecao | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setRascunho(secao ? rascunhoDaSecao(processo, secao) : null);
    // Recomeça o rascunho só ao abrir outra seção, não a cada gravação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secao]);

  const campos = secao ? camposDaSecao(secao, lerEstadoDoProcesso(processo)) : [];
  const alterar = (parcial: Partial<RascunhoSecao>) => setRascunho((atual) => (atual ? { ...atual, ...parcial } : atual));

  const camposDeTexto = rascunho
    ? campos.map((campo) => (
      <CampoDeTexto
        key={campo.chave}
        campo={campo}
        valor={rascunho.textos[campo.chave] ?? ""}
        onChange={(valor) => alterar({ textos: { ...rascunho.textos, [campo.chave]: valor } })}
      />
    ))
    : null;

  const salvar = async () => {
    if (!secao || !rascunho) return;
    setSalvando(true);
    const ok = await onSalvar(secao, rascunho);
    setSalvando(false);
    if (ok) onFechar();
  };

  return (
    <Sheet open={secao !== null} onOpenChange={(aberto) => !aberto && !salvando && onFechar()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Editar: {secao ? TITULO_SECAO[secao] : ""}</SheetTitle>
          <SheetDescription>As mudanças aparecem no relatório assim que você salvar.</SheetDescription>
        </SheetHeader>

        {rascunho && secao && (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {secao !== "atividades" && camposDeTexto}

            {secao === "sipoc" && (
              <>
                <ListaEditavel
                  titulo="Fornecedores e entradas"
                  itens={rascunho.entradas}
                  colunas={[{ chave: "fornecedor", rotulo: "Fornecedor" }, { chave: "entrada", rotulo: "Entrada" }]}
                  novo={() => ({ fornecedor: "", entrada: "" })}
                  rotuloNovo="Incluir entrada"
                  onChange={(entradas) => alterar({ entradas })}
                />
                <ListaEditavel
                  titulo="Saídas e clientes"
                  itens={rascunho.saidas}
                  colunas={[{ chave: "saida", rotulo: "Saída" }, { chave: "cliente", rotulo: "Cliente" }]}
                  novo={() => ({ saida: "", cliente: "" })}
                  rotuloNovo="Incluir saída"
                  onChange={(saidas) => alterar({ saidas })}
                />
              </>
            )}

            {secao === "atividades" && (
              <ListaEditavel
                titulo="Atividades, na ordem em que acontecem"
                itens={rascunho.etapas}
                colunas={[
                  { chave: "atividade", rotulo: "Atividade", largo: true },
                  { chave: "responsavel", rotulo: "Responsável" },
                  { chave: "ferramentaDocumento", rotulo: "Sistema / ferramenta" },
                ]}
                novo={() => ({ ordem: rascunho.etapas.length + 1, atividade: "", responsavel: "", ferramentaDocumento: "" })}
                rotuloNovo="Incluir atividade"
                ordenavel
                onChange={(etapas) => alterar({ etapas })}
              />
            )}
            {/* No AS IS, primeiro as atividades e depois as regras do fluxo, como no relatório. */}
            {secao === "atividades" && camposDeTexto}

            {secao === "medicao" && indicadoresNoModulo && (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Os indicadores deste processo são editados em Indicadores, onde também são lançados os resultados.
              </p>
            )}
            {secao === "medicao" && !indicadoresNoModulo && (
              <ListaEditavel
                titulo="Indicadores"
                itens={rascunho.indicadores}
                colunas={[
                  { chave: "nome", rotulo: "Indicador", largo: true },
                  { chave: "formulaCalculo", rotulo: "Fórmula", largo: true },
                  { chave: "meta", rotulo: "Meta" },
                  { chave: "periodicidade", rotulo: "Periodicidade" },
                  { chave: "responsavel", rotulo: "Responsável" },
                ]}
                novo={() => ({ nome: "", objetivo: "", formulaCalculo: "", meta: "", periodicidade: "", responsavel: "" })}
                rotuloNovo="Incluir indicador"
                onChange={(indicadores) => alterar({ indicadores })}
              />
            )}

            {secao === "plano" && (
              <ListaEditavel
                titulo="Ações"
                itens={rascunho.planoAcao}
                colunas={[
                  { chave: "oque", rotulo: "O quê", largo: true },
                  { chave: "porque", rotulo: "Por quê", largo: true },
                  { chave: "quem", rotulo: "Quem" },
                  { chave: "quando", rotulo: "Quando" },
                  { chave: "onde", rotulo: "Onde" },
                  { chave: "custo", rotulo: "Quanto" },
                  { chave: "como", rotulo: "Como", largo: true },
                ]}
                novo={() => ({ oque: "", porque: "", quem: "", quando: "", onde: "", como: "", custo: "" })}
                rotuloNovo="Incluir ação"
                ordenavel
                onChange={(planoAcao) => alterar({ planoAcao })}
              />
            )}
          </div>
        )}

        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
