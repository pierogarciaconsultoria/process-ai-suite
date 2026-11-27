import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { usePodeGerenciar } from "@/lib/perfil";
import { nomesNovos } from "@/lib/estrutura-empresa";

type Setor = Tables<"setores">;
type Cargo = Tables<"cargos">;
type Pessoa = Tables<"pessoas">;
type Aba = "setores" | "cargos" | "pessoas";

interface Rascunho {
  aba: Aba;
  id: string | null;
  nome: string;
  vinculo: string; // setor do cargo ou cargo da pessoa
  email: string;
}

const NENHUM = "__nenhum__";
const TITULO: Record<Aba, string> = { setores: "setor", cargos: "cargo", pessoas: "pessoa" };
const NOVO: Record<Aba, string> = { setores: "Novo setor", cargos: "Novo cargo", pessoas: "Nova pessoa" };
const EDITAR: Record<Aba, string> = { setores: "Editar setor", cargos: "Editar cargo", pessoas: "Editar pessoa" };

const ConfigEstrutura = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const podeGerenciar = usePodeGerenciar(companyId);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>("cargos");
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: auth } = await supabase.auth.getUser();
    const empresa = await resolveAccessibleCompanyId(auth.user?.id ?? null);
    setCompanyId(empresa);
    if (!empresa) {
      setCarregando(false);
      return;
    }
    const [s, c, p] = await Promise.all([
      supabase.from("setores").select("*").eq("company_id", empresa).order("nome"),
      supabase.from("cargos").select("*").eq("company_id", empresa).order("nome"),
      supabase.from("pessoas").select("*").eq("company_id", empresa).order("nome"),
    ]);
    const erro = s.error ?? c.error ?? p.error;
    if (erro) toast({ title: "Não foi possível carregar a estrutura", description: erro.message, variant: "destructive" });
    setSetores(s.data ?? []);
    setCargos(c.data ?? []);
    setPessoas(p.data ?? []);
    setCarregando(false);
  }, [toast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nomeSetor = (id: string | null) => setores.find((item) => item.id === id)?.nome ?? "—";
  const nomeCargo = (id: string | null) => cargos.find((item) => item.id === id)?.nome ?? "—";

  const salvar = async () => {
    if (!rascunho || !companyId) return;
    const nome = rascunho.nome.trim();
    if (!nome) {
      toast({ title: "Preencha o nome", variant: "destructive" });
      return;
    }
    const vinculo = rascunho.vinculo === NENHUM ? null : rascunho.vinculo || null;
    setSalvando(true);
    const { id } = rascunho;
    let resultado;
    if (rascunho.aba === "setores") {
      resultado = id ? await supabase.from("setores").update({ nome }).eq("id", id) : await supabase.from("setores").insert({ nome, company_id: companyId });
    } else if (rascunho.aba === "cargos") {
      const campos = { nome, setor_id: vinculo };
      resultado = id ? await supabase.from("cargos").update(campos).eq("id", id) : await supabase.from("cargos").insert({ ...campos, company_id: companyId });
    } else {
      const campos = { nome, cargo_id: vinculo, email: rascunho.email.trim() || null };
      resultado = id ? await supabase.from("pessoas").update(campos).eq("id", id) : await supabase.from("pessoas").insert({ ...campos, company_id: companyId });
    }
    const { error } = resultado;
    setSalvando(false);
    if (error) {
      const repetido = error.code === "23505";
      toast({ title: repetido ? `Já existe ${rascunho.aba === "pessoas" ? "uma" : "um"} ${TITULO[rascunho.aba]} com esse nome` : "Não foi possível salvar", description: repetido ? undefined : error.message, variant: "destructive" });
      return;
    }
    setRascunho(null);
    void carregar();
  };

  const excluir = async (tabela: Aba, id: string, nome: string) => {
    if (!window.confirm(`Excluir "${nome}"?`)) return;
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (error) toast({ title: "Não foi possível excluir", description: error.message, variant: "destructive" });
    void carregar();
  };

  // Traz os setores (área do processo) e os cargos (responsáveis das atividades) já mapeados.
  const importarDosProcessos = async () => {
    if (!companyId) return;
    setImportando(true);
    const { data, error } = await supabase.from("processos").select("area, etapas").eq("company_id", companyId);
    if (error) {
      setImportando(false);
      toast({ title: "Não foi possível ler os processos", description: error.message, variant: "destructive" });
      return;
    }
    const areas = (data ?? []).map((processo) => processo.area);
    const responsaveis = (data ?? []).flatMap((processo) =>
      Array.isArray(processo.etapas) ? processo.etapas.map((etapa) => (etapa as { responsavel?: unknown })?.responsavel) : [],
    );
    const novosSetores = nomesNovos(areas, setores.map((item) => item.nome));
    const novosCargos = nomesNovos(responsaveis, cargos.map((item) => item.nome));
    const r1 = novosSetores.length ? await supabase.from("setores").insert(novosSetores.map((nome) => ({ nome, company_id: companyId }))) : { error: null };
    const r2 = novosCargos.length ? await supabase.from("cargos").insert(novosCargos.map((nome) => ({ nome, company_id: companyId }))) : { error: null };
    setImportando(false);
    const falha = r1.error ?? r2.error;
    if (falha) toast({ title: "Importação incompleta", description: falha.message, variant: "destructive" });
    else toast({ title: "Importado dos processos", description: `${novosSetores.length} setores e ${novosCargos.length} cargos novos. Ligue cada cargo ao seu setor.` });
    void carregar();
  };

  const acoes = (tabela: Aba, id: string, nome: string, editar: () => void) =>
    podeGerenciar && (
      <TableCell className="w-24 text-right">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${nome}`} onClick={editar}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Excluir ${nome}`} onClick={() => void excluir(tabela, id, nome)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </TableCell>
    );

  const vazio = (texto: string) => <p className="py-8 text-center text-sm text-muted-foreground">{texto}</p>;

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/configuracoes")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Configurações
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Setores, cargos e pessoas</h1>
          <p className="text-muted-foreground">Os documentos apontam para cargos e setores. As pessoas ocupam um cargo e não precisam ter acesso ao sistema.</p>
        </div>
        {podeGerenciar && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => void importarDosProcessos()} disabled={!companyId || importando}>
              {importando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Importar dos processos
            </Button>
            <Button onClick={() => setRascunho({ aba, id: null, nome: "", vinculo: NENHUM, email: "" })} disabled={!companyId}>
              <Plus className="mr-2 h-4 w-4" /> {NOVO[aba]}
            </Button>
          </div>
        )}
      </div>

      {carregando ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !companyId ? (
        <p className="text-muted-foreground">Escolha uma empresa no menu para ver a estrutura.</p>
      ) : (
        <Tabs value={aba} onValueChange={(valor) => setAba(valor as Aba)}>
          <TabsList>
            <TabsTrigger value="setores">Setores ({setores.length})</TabsTrigger>
            <TabsTrigger value="cargos">Cargos ({cargos.length})</TabsTrigger>
            <TabsTrigger value="pessoas">Pessoas ({pessoas.length})</TabsTrigger>
          </TabsList>
          <Card className="mt-3">
            <CardContent className="p-0">
              <TabsContent value="setores" className="m-0">
                {setores.length === 0 ? vazio("Nenhum setor. Use \"Importar dos processos\" ou cadastre.") : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Setor</TableHead><TableHead>Cargos</TableHead>{podeGerenciar && <TableHead />}</TableRow></TableHeader>
                    <TableBody>
                      {setores.map((setor) => (
                        <TableRow key={setor.id}>
                          <TableCell className="font-medium">{setor.nome}</TableCell>
                          <TableCell>{cargos.filter((cargo) => cargo.setor_id === setor.id).length}</TableCell>
                          {acoes("setores", setor.id, setor.nome, () => setRascunho({ aba: "setores", id: setor.id, nome: setor.nome, vinculo: NENHUM, email: "" }))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              <TabsContent value="cargos" className="m-0">
                {cargos.length === 0 ? vazio("Nenhum cargo. Use \"Importar dos processos\" ou cadastre.") : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Cargo</TableHead><TableHead>Setor</TableHead><TableHead>Pessoas</TableHead>{podeGerenciar && <TableHead />}</TableRow></TableHeader>
                    <TableBody>
                      {cargos.map((cargo) => (
                        <TableRow key={cargo.id}>
                          <TableCell className="font-medium">{cargo.nome}</TableCell>
                          <TableCell className={cargo.setor_id ? "" : "text-muted-foreground"}>{nomeSetor(cargo.setor_id)}</TableCell>
                          <TableCell>{pessoas.filter((pessoa) => pessoa.cargo_id === cargo.id).length}</TableCell>
                          {acoes("cargos", cargo.id, cargo.nome, () => setRascunho({ aba: "cargos", id: cargo.id, nome: cargo.nome, vinculo: cargo.setor_id ?? NENHUM, email: "" }))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              <TabsContent value="pessoas" className="m-0">
                {pessoas.length === 0 ? vazio("Nenhuma pessoa cadastrada.") : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>E-mail</TableHead>{podeGerenciar && <TableHead />}</TableRow></TableHeader>
                    <TableBody>
                      {pessoas.map((pessoa) => (
                        <TableRow key={pessoa.id}>
                          <TableCell className="font-medium">{pessoa.nome}</TableCell>
                          <TableCell className={pessoa.cargo_id ? "" : "text-muted-foreground"}>{nomeCargo(pessoa.cargo_id)}</TableCell>
                          <TableCell className="text-muted-foreground">{pessoa.email || "—"}</TableCell>
                          {acoes("pessoas", pessoa.id, pessoa.nome, () => setRascunho({ aba: "pessoas", id: pessoa.id, nome: pessoa.nome, vinculo: pessoa.cargo_id ?? NENHUM, email: pessoa.email ?? "" }))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      )}

      <Dialog open={rascunho !== null} onOpenChange={(aberto) => !aberto && setRascunho(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{rascunho ? (rascunho.id ? EDITAR : NOVO)[rascunho.aba] : ""}</DialogTitle>
          </DialogHeader>
          {rascunho && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="estrutura-nome">Nome</Label>
                <Input id="estrutura-nome" value={rascunho.nome} maxLength={160} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
              </div>
              {rascunho.aba !== "setores" && (
                <div className="space-y-2">
                  <Label htmlFor="estrutura-vinculo">{rascunho.aba === "cargos" ? "Setor" : "Cargo"}</Label>
                  <Select value={rascunho.vinculo} onValueChange={(vinculo) => setRascunho({ ...rascunho, vinculo })}>
                    <SelectTrigger id="estrutura-vinculo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Sem {rascunho.aba === "cargos" ? "setor" : "cargo"}</SelectItem>
                      {(rascunho.aba === "cargos" ? setores : cargos).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {rascunho.aba === "pessoas" && (
                <div className="space-y-2">
                  <Label htmlFor="estrutura-email">E-mail (opcional)</Label>
                  <Input id="estrutura-email" type="email" value={rascunho.email} onChange={(e) => setRascunho({ ...rascunho, email: e.target.value })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRascunho(null)}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConfigEstrutura;
