import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileUp, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { usePodeGerenciar } from "@/lib/perfil";
import { extrairTextoPdf } from "@/lib/peter-upload";

type Norma = Tables<"normas_empresa">;

// Mesmo teto da coluna requisitos no banco.
const LIMITE_REQUISITOS = 100000;

interface Rascunho {
  id: string | null;
  nome: string;
  requisitos: string;
  origem: "texto" | "pdf";
  arquivo_nome: string | null;
}

const VAZIO: Rascunho = { id: null, nome: "", requisitos: "", origem: "texto", arquivo_nome: null };

const ConfigNormas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const podeGerenciar = usePodeGerenciar(companyId);
  const [normas, setNormas] = useState<Norma[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [lendoPdf, setLendoPdf] = useState(false);
  const [excluindo, setExcluindo] = useState<Norma | null>(null);
  const entradaPdf = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: auth } = await supabase.auth.getUser();
    const empresa = await resolveAccessibleCompanyId(auth.user?.id ?? null);
    setCompanyId(empresa);
    if (!empresa) {
      setNormas([]);
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase.from("normas_empresa").select("*").eq("company_id", empresa).order("created_at");
    if (error) toast({ title: "Não foi possível carregar as normas", description: error.message, variant: "destructive" });
    setNormas(data ?? []);
    setCarregando(false);
  }, [toast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const lerPdf = async (arquivo: File | undefined) => {
    if (!arquivo || !rascunho) return;
    setLendoPdf(true);
    try {
      const texto = (await extrairTextoPdf(arquivo)).replace(/\[Página \d+\]\s*/g, "").trim();
      if (!texto) throw new Error("O PDF não tem texto legível.");
      const cortado = texto.length > LIMITE_REQUISITOS;
      setRascunho({
        ...rascunho,
        nome: rascunho.nome || arquivo.name.replace(/\.pdf$/i, ""),
        requisitos: texto.slice(0, LIMITE_REQUISITOS),
        origem: "pdf",
        arquivo_nome: arquivo.name,
      });
      toast({
        title: "Texto do PDF importado",
        description: cortado
          ? `O texto passou de ${LIMITE_REQUISITOS.toLocaleString("pt-BR")} caracteres e foi cortado. Deixe só os requisitos que se aplicam.`
          : "Revise e apague o que não se aplica antes de salvar.",
      });
    } catch (erro) {
      toast({ title: "Não foi possível ler o PDF", description: erro instanceof Error ? erro.message : String(erro), variant: "destructive" });
    } finally {
      setLendoPdf(false);
      if (entradaPdf.current) entradaPdf.current.value = "";
    }
  };

  const salvar = async () => {
    if (!rascunho || !companyId) return;
    const nome = rascunho.nome.trim();
    const requisitos = rascunho.requisitos.trim();
    if (!nome || !requisitos) {
      toast({ title: "Preencha o nome e os requisitos", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const campos = { nome, requisitos, origem: rascunho.origem, arquivo_nome: rascunho.arquivo_nome };
    const { error } = rascunho.id
      ? await supabase.from("normas_empresa").update(campos).eq("id", rascunho.id)
      : await supabase.from("normas_empresa").insert({ ...campos, company_id: companyId });
    setSalvando(false);
    if (error) {
      toast({ title: "Não foi possível salvar a norma", description: error.message, variant: "destructive" });
      return;
    }
    setRascunho(null);
    toast({ title: "Norma salva", description: "O Peter passa a considerá-la nas próximas entrevistas e diagnósticos." });
    void carregar();
  };

  const alternarAtiva = async (norma: Norma, ativa: boolean) => {
    const { error } = await supabase.from("normas_empresa").update({ ativa }).eq("id", norma.id);
    if (error) {
      toast({ title: "Não foi possível alterar a norma", description: error.message, variant: "destructive" });
      return;
    }
    setNormas((lista) => lista.map((item) => (item.id === norma.id ? { ...item, ativa } : item)));
  };

  const excluir = async () => {
    if (!excluindo) return;
    const { error } = await supabase.from("normas_empresa").delete().eq("id", excluindo.id);
    setExcluindo(null);
    if (error) {
      toast({ title: "Não foi possível excluir a norma", description: error.message, variant: "destructive" });
      return;
    }
    void carregar();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/configuracoes")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Configurações
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Normas e requisitos</h1>
          <p className="text-muted-foreground">
            Normas, certificações e contratos que a empresa segue. O Peter usa estes requisitos na entrevista, no diagnóstico, no plano de melhoria e nos documentos.
          </p>
        </div>
        {podeGerenciar && (
          <Button onClick={() => setRascunho({ ...VAZIO })} disabled={!companyId}>
            <Plus className="h-4 w-4 mr-2" /> Nova norma
          </Button>
        )}
      </div>

      {carregando ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !companyId ? (
        <p className="text-muted-foreground">Escolha uma empresa no menu para ver as normas.</p>
      ) : normas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">Nenhuma norma cadastrada</p>
            <p className="text-sm text-muted-foreground">
              Cadastre os requisitos que se aplicam aos processos (ex.: ISO 9001 itens 8.4 e 8.5). Prefira o resumo ou o checklist da norma ao texto integral.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {normas.map((norma) => (
            <Card key={norma.id} className={norma.ativa ? "" : "opacity-60"}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-base break-words">{norma.nome}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{norma.origem === "pdf" ? `PDF: ${norma.arquivo_nome ?? "arquivo"}` : "Texto"}</Badge>
                    <Badge variant="outline">{norma.requisitos.length.toLocaleString("pt-BR")} caracteres</Badge>
                    {!norma.ativa && <Badge variant="outline">Desativada</Badge>}
                  </div>
                </div>
                {podeGerenciar && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={norma.ativa}
                      onCheckedChange={(ativa) => void alternarAtiva(norma, ativa)}
                      aria-label={norma.ativa ? `Desativar ${norma.nome}` : `Ativar ${norma.nome}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${norma.nome}`}
                      onClick={() => setRascunho({
                        id: norma.id,
                        nome: norma.nome,
                        requisitos: norma.requisitos,
                        origem: norma.origem === "pdf" ? "pdf" : "texto",
                        arquivo_nome: norma.arquivo_nome,
                      })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir ${norma.nome}`} onClick={() => setExcluindo(norma)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">{norma.requisitos}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={rascunho !== null} onOpenChange={(aberto) => !aberto && setRascunho(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{rascunho?.id ? "Editar norma" : "Nova norma"}</DialogTitle>
            <DialogDescription>Escreva os requisitos ou importe o texto de um PDF. O arquivo não fica guardado, só o texto.</DialogDescription>
          </DialogHeader>
          {rascunho && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="norma-nome">Nome</Label>
                <Input
                  id="norma-nome"
                  value={rascunho.nome}
                  maxLength={200}
                  placeholder="Ex.: ISO 9001:2015, Contrato cliente X, NR-12"
                  onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="norma-requisitos">Requisitos</Label>
                  <input
                    ref={entradaPdf}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => void lerPdf(e.target.files?.[0])}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={lendoPdf} onClick={() => entradaPdf.current?.click()}>
                    {lendoPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
                    {lendoPdf ? "Lendo PDF..." : "Importar PDF"}
                  </Button>
                </div>
                <Textarea
                  id="norma-requisitos"
                  rows={12}
                  value={rascunho.requisitos}
                  maxLength={LIMITE_REQUISITOS}
                  placeholder={"Ex.:\n8.4.1 Controle de fornecedores externos: avaliar e reavaliar fornecedores...\n8.5.1 Controle de produção: critérios de aceitação documentados..."}
                  onChange={(e) => setRascunho({ ...rascunho, requisitos: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {rascunho.requisitos.length.toLocaleString("pt-BR")} de {LIMITE_REQUISITOS.toLocaleString("pt-BR")} caracteres. Normas ISO têm direitos autorais: prefira o resumo dos itens que se aplicam.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRascunho(null)}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando || lendoPdf}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a norma?</AlertDialogTitle>
            <AlertDialogDescription>
              "{excluindo?.nome}" deixa de ser considerada pelo Peter. Diagnósticos já gerados não mudam. Para só pausar, use o botão de ativar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void excluir()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ConfigNormas;
