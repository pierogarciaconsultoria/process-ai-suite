import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEmpresaAtiva } from "@/lib/empresa-ativa";
import { carregarPadroes, PADRAO_VAZIO, salvarPadrao, TIPOS_PADRAO, type ConteudoPadrao } from "@/lib/padroes-documento";
import { extrairTextoDocx, extrairTextoPdf } from "@/lib/peter-upload";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";
import type { TipoPadrao } from "../../../supabase/functions/_shared/procedimento-padrao";

const LIMITE = 60_000;

function nomeDaEmpresaAtiva(): string {
  try {
    return window.localStorage.getItem("process:activeEmpresaNome") || "empresa atual";
  } catch {
    return "empresa atual";
  }
}

// Padrão de procedimento do Peter: estrutura do PR/PA, da IT e manual de escrita, guardados no
// banco. Vale para todas as empresas ou só para a empresa atual (que prevalece).
export function PadraoProcedimentoConfig() {
  const { toast } = useToast();
  const empresaAtiva = useEmpresaAtiva();
  const [escopo, setEscopo] = useState<"plataforma" | "empresa">("plataforma");
  const [conteudo, setConteudo] = useState<ConteudoPadrao>(PADRAO_VAZIO);
  const [original, setOriginal] = useState<ConteudoPadrao>(PADRAO_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState<TipoPadrao | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const alvoRef = useRef<TipoPadrao>("estrutura_pr");
  const companyId = escopo === "empresa" ? empresaAtiva : null;

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    carregarPadroes(companyId)
      .then((dados) => {
        if (!ativo) return;
        setConteudo(dados);
        setOriginal(dados);
      })
      .catch((error) => {
        if (ativo) toast({ title: "Padrão indisponível", description: mensagemDoErroDoProcesso(error, "Aplique a migration 202611070001 no banco."), variant: "destructive" });
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [companyId, toast]);

  const importar = async (arquivo: File | undefined) => {
    if (arquivoRef.current) arquivoRef.current.value = "";
    if (!arquivo) return;
    const tipo = alvoRef.current;
    setImportando(tipo);
    try {
      const texto = /\.pdf$/i.test(arquivo.name) ? await extrairTextoPdf(arquivo) : await extrairTextoDocx(arquivo);
      setConteudo((atual) => ({ ...atual, [tipo]: texto.slice(0, LIMITE) }));
      toast({ title: "Arquivo importado", description: `Revise o texto de "${arquivo.name}" e clique em Salvar.` });
    } catch (error) {
      toast({ title: "Não foi possível ler o arquivo", description: error instanceof Error ? error.message : "Tente outro arquivo.", variant: "destructive" });
    } finally {
      setImportando(null);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      for (const { tipo } of TIPOS_PADRAO) {
        if (conteudo[tipo].trim() !== original[tipo].trim()) await salvarPadrao(companyId, tipo, conteudo[tipo]);
      }
      setOriginal(conteudo);
      toast({ title: "Padrão salvo", description: escopo === "empresa" ? `Vale para ${nomeDaEmpresaAtiva()}.` : "Vale para todas as empresas." });
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: mensagemDoErroDoProcesso(error, "Tente de novo."), variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const alterado = TIPOS_PADRAO.some(({ tipo }) => conteudo[tipo].trim() !== original[tipo].trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Padrão de procedimento do Peter</CardTitle>
        <CardDescription>
          O Peter escreve os procedimentos (PR/PA) e as instruções de trabalho (IT) com esta estrutura e este manual. Campo em branco usa o padrão da plataforma ou, sem ele, o padrão genérico do Peter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="escopo-padrao">Vale para</Label>
          <Select value={escopo} onValueChange={(valor) => setEscopo(valor as "plataforma" | "empresa")}>
            <SelectTrigger id="escopo-padrao"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="plataforma">Todas as empresas (padrão da plataforma)</SelectItem>
              <SelectItem value="empresa" disabled={!empresaAtiva}>Só {nomeDaEmpresaAtiva()} (prevalece sobre o da plataforma)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <input
          ref={arquivoRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          data-testid="importar-padrao"
          onChange={(event) => void importar(event.target.files?.[0])}
        />

        {carregando ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o padrão...</p>
        ) : (
          TIPOS_PADRAO.map(({ tipo, rotulo, ajuda, exemplo }) => (
            <div key={tipo} className="space-y-1.5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <Label htmlFor={`padrao-${tipo}`}>{rotulo}</Label>
                  <p className="text-xs text-muted-foreground">{ajuda}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setConteudo((atual) => ({ ...atual, [tipo]: exemplo }))}>
                    Partir do genérico
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={importando !== null}
                    onClick={() => {
                      alvoRef.current = tipo;
                      arquivoRef.current?.click();
                    }}
                  >
                    {importando === tipo ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}
                    Importar PDF ou Word
                  </Button>
                </div>
              </div>
              <Textarea
                id={`padrao-${tipo}`}
                rows={10}
                maxLength={LIMITE}
                value={conteudo[tipo]}
                placeholder={exemplo}
                onChange={(event) => setConteudo((atual) => ({ ...atual, [tipo]: event.target.value }))}
              />
            </div>
          ))
        )}

        <div className="flex justify-end">
          <Button onClick={() => void salvar()} disabled={salvando || carregando || !alterado}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
