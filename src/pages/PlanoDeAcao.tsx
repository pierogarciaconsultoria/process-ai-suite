import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditorAcao, type RascunhoAcao } from "@/components/acoes/EditorAcao";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { estaAtrasada, formatarPrazo, ORIGEM_ACAO, resumirAcoes, STATUS_ACAO, type Acao } from "@/lib/plano-de-acao";
import { usePodeGerenciar } from "@/lib/perfil";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";

const TODOS = "todos";
const ABERTAS = "abertas";

const COR_STATUS: Record<string, string> = {
  "A fazer": "bg-muted text-muted-foreground",
  "Em andamento": "bg-primary/15 text-primary",
  "Concluída": "bg-success/20 text-success",
  Cancelada: "bg-secondary text-secondary-foreground line-through",
};

function Indicador({ rotulo, valor, destaque = false }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{rotulo}</div>
        <div className={`text-2xl font-bold ${destaque && valor > 0 ? "text-destructive" : "text-foreground"}`}>{valor}</div>
      </CardContent>
    </Card>
  );
}

const PlanoDeAcao = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [parametros] = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(null);
  // A Equipe cria e atualiza ações; excluir é de Consultor e Gestor.
  const podeGerenciar = usePodeGerenciar(companyId);
  const [userId, setUserId] = useState<string | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [processos, setProcessos] = useState<Array<{ id: string; nome: string }>>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroProcesso, setFiltroProcesso] = useState(parametros.get("processo") ?? TODOS);
  const [filtroStatus, setFiltroStatus] = useState(ABERTAS);
  const [editando, setEditando] = useState<{ acao: Acao | null } | null>(null);
  const [excluindo, setExcluindo] = useState<Acao | null>(null);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const empresa = await resolveAccessibleCompanyId(auth.user?.id ?? null);
        if (!ativo) return;
        setUserId(auth.user?.id ?? null);
        setCompanyId(empresa);
        if (!empresa) return;
        const [resAcoes, resProcessos] = await Promise.all([
          supabase.from("acoes").select("*").eq("company_id", empresa).order("prazo", { ascending: true, nullsFirst: false }),
          supabase.from("processos").select("id, nome").eq("company_id", empresa).order("nome"),
        ]);
        if (resAcoes.error) throw resAcoes.error;
        if (resProcessos.error) throw resProcessos.error;
        if (!ativo) return;
        setAcoes(resAcoes.data ?? []);
        setProcessos(resProcessos.data ?? []);
      } catch (error) {
        console.error("Erro ao carregar o Plano de Ação:", error);
        toast({ title: "Não foi possível carregar o Plano de Ação", description: mensagemDoErroDoProcesso(error, "Tente novamente."), variant: "destructive" });
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [toast]);

  const nomeDoProcesso = useMemo(() => new Map(processos.map((processo) => [processo.id, processo.nome || "Sem nome"])), [processos]);
  const resumo = useMemo(() => resumirAcoes(acoes), [acoes]);
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return acoes.filter((acao) => {
      if (filtroProcesso !== TODOS && acao.processo_id !== filtroProcesso) return false;
      if (filtroStatus === ABERTAS && (acao.status === "Concluída" || acao.status === "Cancelada")) return false;
      if (filtroStatus !== ABERTAS && filtroStatus !== TODOS && acao.status !== filtroStatus) return false;
      return !termo || [acao.oque, acao.quem, acao.porque].some((valor) => valor.toLowerCase().includes(termo));
    });
  }, [acoes, busca, filtroProcesso, filtroStatus]);

  const gravar = async (id: string | null, campos: Partial<RascunhoAcao>): Promise<Acao | null> => {
    if (!companyId || !userId) return null;
    const consulta = id
      ? supabase.from("acoes").update({ ...campos, updated_by: userId }).eq("id", id).eq("company_id", companyId)
      : supabase.from("acoes").insert({ oque: "", ...campos, company_id: companyId, origem: "manual", created_by: userId, updated_by: userId });
    const { data, error } = await consulta.select("*").single();
    if (error) {
      toast({ title: "Não foi possível salvar a ação", description: mensagemDoErroDoProcesso(error, "Tente novamente."), variant: "destructive" });
      return null;
    }
    setAcoes((atuais) => (id ? atuais.map((acao) => (acao.id === id ? data : acao)) : [...atuais, data]));
    return data;
  };

  const salvarEditor = async (rascunho: RascunhoAcao) => {
    const salva = await gravar(editando?.acao?.id ?? null, rascunho);
    if (salva) toast({ title: "Ação salva" });
    return Boolean(salva);
  };

  const excluir = async () => {
    if (!excluindo || !companyId) return;
    const { error } = await supabase.from("acoes").delete().eq("id", excluindo.id).eq("company_id", companyId);
    if (error) {
      toast({ title: "Não foi possível excluir", description: mensagemDoErroDoProcesso(error, "Tente novamente."), variant: "destructive" });
      return;
    }
    setAcoes((atuais) => atuais.filter((acao) => acao.id !== excluindo.id));
    setExcluindo(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plano de Ação</h1>
          <p className="text-muted-foreground">Ações de melhoria e de correção, do registro até a verificação da eficácia.</p>
        </div>
        <Button onClick={() => setEditando({ acao: null })} disabled={!companyId}>
          <Plus className="mr-2 h-4 w-4" /> Nova ação
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="A fazer" valor={resumo.aFazer} />
        <Indicador rotulo="Em andamento" valor={resumo.emAndamento} />
        <Indicador rotulo="Atrasadas" valor={resumo.atrasadas} destaque />
        <Indicador rotulo="Concluídas" valor={resumo.concluidas} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar ação ou responsável..." value={busca} onChange={(event) => setBusca(event.target.value)} className="pl-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Processo</Label>
              <Select value={filtroProcesso} onValueChange={setFiltroProcesso}>
                <SelectTrigger className="w-full md:w-[220px]" aria-label="Filtrar por processo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {processos.map((processo) => <SelectItem key={processo.id} value={processo.id}>{processo.nome || "Sem nome"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-full md:w-[180px]" aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ABERTAS}>Abertas</SelectItem>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {STATUS_ACAO.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>O quê</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando ações...</span>
                    </TableCell>
                  </TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {acoes.length === 0
                        ? "Nenhuma ação ainda. As ações do plano de melhoria de um processo podem ser enviadas para cá pela página do processo."
                        : "Nenhuma ação com esses filtros."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((acao) => {
                    const atrasada = estaAtrasada(acao);
                    return (
                      <TableRow key={acao.id}>
                        <TableCell className="max-w-[320px]">
                          <div className="font-medium">{acao.oque}</div>
                          <div className="text-xs text-muted-foreground">{ORIGEM_ACAO[acao.origem] ?? acao.origem}</div>
                        </TableCell>
                        <TableCell>
                          {acao.processo_id ? (
                            <button type="button" className="text-left hover:underline" onClick={() => navigate(`/processos/${acao.processo_id}`)}>
                              {nomeDoProcesso.get(acao.processo_id) ?? "—"}
                            </button>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{acao.quem || "[a definir]"}</TableCell>
                        <TableCell className={atrasada ? "font-medium text-destructive" : ""}>
                          {formatarPrazo(acao)}
                          {atrasada && <Badge variant="destructive" className="ml-2">Atrasada</Badge>}
                        </TableCell>
                        <TableCell>
                          <Select value={acao.status} onValueChange={(status) => void gravar(acao.id, { status })}>
                            <SelectTrigger className={`h-8 w-[150px] border-0 ${COR_STATUS[acao.status] ?? ""}`} aria-label={`Status de ${acao.oque}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_ACAO.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button variant="ghost" size="icon" title="Editar ação" aria-label={`Editar ${acao.oque}`} onClick={() => setEditando({ acao })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {podeGerenciar && (
                            <Button variant="ghost" size="icon" title="Excluir ação" aria-label={`Excluir ${acao.oque}`} onClick={() => setExcluindo(acao)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EditorAcao
        aberto={editando !== null}
        acao={editando?.acao ?? null}
        processos={processos}
        onFechar={() => setEditando(null)}
        onSalvar={salvarEditor}
      />

      <AlertDialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta ação?</AlertDialogTitle>
            <AlertDialogDescription>
              "{excluindo?.oque}" será apagada. Para manter o histórico, prefira mudar o status para Cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void excluir()}>Excluir</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlanoDeAcao;
