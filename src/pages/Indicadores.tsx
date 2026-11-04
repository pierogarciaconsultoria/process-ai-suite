import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ListChecks, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditorIndicador, type RascunhoIndicador } from "@/components/indicadores/EditorIndicador";
import { LancarResultado } from "@/components/indicadores/LancarResultado";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import {
  acaoParaResultadoFora,
  COR_SITUACAO,
  formatarMeta,
  formatarValor,
  periodoDe,
  rotuloPeriodo,
  ROTULO_SITUACAO,
  situacao,
  ultimaMedicao,
  ultimosPeriodos,
  type Indicador,
  type Medicao,
} from "@/lib/indicadores";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";

const TODOS = "todos";
const MESES_NA_TELA = 6;

const Indicadores = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [parametros] = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [processos, setProcessos] = useState<Array<{ id: string; nome: string }>>([]);
  const [acoesCriadas, setAcoesCriadas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [filtroProcesso, setFiltroProcesso] = useState(parametros.get("processo") ?? TODOS);
  const [editando, setEditando] = useState<{ indicador: Indicador | null } | null>(null);
  const [lancando, setLancando] = useState<{ indicador: Indicador; periodo: string } | null>(null);
  const [excluindo, setExcluindo] = useState<Indicador | null>(null);
  const periodos = useMemo(() => ultimosPeriodos(MESES_NA_TELA), []);

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
        const [resIndicadores, resMedicoes, resProcessos, resAcoes] = await Promise.all([
          supabase.from("indicadores").select("*").eq("company_id", empresa).order("nome"),
          supabase.from("indicador_medicoes").select("*").eq("company_id", empresa).order("periodo"),
          supabase.from("processos").select("id, nome").eq("company_id", empresa).order("nome"),
          supabase.from("acoes").select("chave_origem").eq("company_id", empresa).eq("origem", "indicador"),
        ]);
        if (resIndicadores.error) throw resIndicadores.error;
        if (resMedicoes.error) throw resMedicoes.error;
        if (!ativo) return;
        setIndicadores(resIndicadores.data ?? []);
        setMedicoes(resMedicoes.data ?? []);
        setProcessos(resProcessos.data ?? []);
        setAcoesCriadas(new Set((resAcoes.data ?? []).map((acao) => acao.chave_origem ?? "")));
      } catch (error) {
        console.error("Erro ao carregar os indicadores:", error);
        toast({ title: "Não foi possível carregar os indicadores", description: mensagemDoErroDoProcesso(error, "Tente novamente."), variant: "destructive" });
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
  const filtrados = useMemo(
    () => indicadores.filter((indicador) => filtroProcesso === TODOS || indicador.processo_id === filtroProcesso),
    [indicadores, filtroProcesso],
  );
  const resumo = useMemo(() => {
    const ultimas = filtrados.map((indicador) => situacao(indicador, ultimaMedicao(medicoes, indicador.id)?.valor));
    return { total: filtrados.length, dentro: ultimas.filter((s) => s === "dentro").length, fora: ultimas.filter((s) => s === "fora").length };
  }, [filtrados, medicoes]);

  const erro = (titulo: string, error: unknown) =>
    toast({ title: titulo, description: mensagemDoErroDoProcesso(error, "Tente novamente."), variant: "destructive" });

  const salvarIndicador = async (rascunho: RascunhoIndicador) => {
    if (!companyId || !userId) return false;
    const id = editando?.indicador?.id;
    const consulta = id
      ? supabase.from("indicadores").update({ ...rascunho, updated_by: userId }).eq("id", id).eq("company_id", companyId)
      : supabase.from("indicadores").insert({ ...rascunho, company_id: companyId, created_by: userId, updated_by: userId });
    const { data, error } = await consulta.select("*").single();
    if (error) {
      erro("Não foi possível salvar o indicador", error);
      return false;
    }
    setIndicadores((atuais) => (id ? atuais.map((item) => (item.id === id ? data : item)) : [...atuais, data]));
    toast({ title: "Indicador salvo" });
    return true;
  };

  const salvarResultado = async (periodo: string, valor: number, comentario: string) => {
    if (!lancando || !companyId || !userId) return false;
    const { indicador } = lancando;
    const existente = medicoes.find((medicao) => medicao.indicador_id === indicador.id && medicao.periodo === periodo);
    const consulta = existente
      ? supabase.from("indicador_medicoes").update({ valor, comentario, updated_by: userId }).eq("id", existente.id).eq("company_id", companyId)
      : supabase.from("indicador_medicoes").insert({ company_id: companyId, indicador_id: indicador.id, periodo, valor, comentario, created_by: userId, updated_by: userId });
    const { data, error } = await consulta.select("*").single();
    if (error) {
      erro("Não foi possível salvar o resultado", error);
      return false;
    }
    setMedicoes((atuais) => [...atuais.filter((medicao) => medicao.id !== data.id), data]);
    const fora = situacao(indicador, valor) === "fora";
    toast({ title: fora ? "Resultado fora da meta" : "Resultado salvo", description: fora ? "Registre uma ação para tratar a causa." : undefined });
    return true;
  };

  const criarAcao = async (indicador: Indicador, medicao: Medicao) => {
    if (!userId) return;
    const nova = acaoParaResultadoFora(indicador, medicao, userId);
    const { error } = await supabase.from("acoes").insert(nova);
    if (error) {
      erro("Não foi possível criar a ação", error);
      return;
    }
    setAcoesCriadas((atuais) => new Set(atuais).add(nova.chave_origem ?? ""));
    toast({ title: "Ação criada no Plano de Ação", description: "Defina responsável e prazo no Plano de Ação." });
  };

  const excluir = async () => {
    if (!excluindo || !companyId) return;
    const { error } = await supabase.from("indicadores").delete().eq("id", excluindo.id).eq("company_id", companyId);
    if (error) {
      erro("Não foi possível excluir", error);
      return;
    }
    setIndicadores((atuais) => atuais.filter((item) => item.id !== excluindo.id));
    setMedicoes((atuais) => atuais.filter((medicao) => medicao.indicador_id !== excluindo.id));
    setExcluindo(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Indicadores</h1>
          <p className="text-muted-foreground">Os resultados de cada processo comparados com a meta, mês a mês.</p>
        </div>
        <Button onClick={() => setEditando({ indicador: null })} disabled={!companyId}>
          <Plus className="mr-2 h-4 w-4" /> Novo indicador
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Indicadores</div><div className="text-2xl font-bold">{resumo.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Dentro da meta</div><div className="text-2xl font-bold text-success">{resumo.dentro}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Fora da meta</div><div className={`text-2xl font-bold ${resumo.fora ? "text-destructive" : ""}`}>{resumo.fora}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Processo</Label>
            <Select value={filtroProcesso} onValueChange={setFiltroProcesso}>
              <SelectTrigger className="w-full sm:w-[260px]" aria-label="Filtrar por processo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {processos.map((processo) => <SelectItem key={processo.id} value={processo.id}>{processo.nome || "Sem nome"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead>Meta</TableHead>
                  {periodos.map((periodo) => <TableHead key={periodo} className="text-center">{rotuloPeriodo(periodo)}</TableHead>)}
                  <TableHead>Situação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando ? (
                  <TableRow>
                    <TableCell colSpan={MESES_NA_TELA + 4} className="text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores...</span>
                    </TableCell>
                  </TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={MESES_NA_TELA + 4} className="py-8 text-center text-muted-foreground">
                      {indicadores.length === 0
                        ? "Nenhum indicador ainda. Os indicadores definidos no mapeamento de um processo podem ser enviados para cá pela página do processo."
                        : "Nenhum indicador neste processo."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((indicador) => {
                    const ultima = ultimaMedicao(medicoes, indicador.id);
                    const atual = situacao(indicador, ultima?.valor);
                    const podeCriarAcao = atual === "fora" && ultima && !acoesCriadas.has(`indicador:${indicador.id}:${ultima.periodo}`);
                    return (
                      <TableRow key={indicador.id}>
                        <TableCell className="max-w-[260px]">
                          <div className="font-medium">{indicador.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {indicador.processo_id ? (
                              <button type="button" className="text-left hover:underline" onClick={() => navigate(`/processos/${indicador.processo_id}`)}>
                                {nomeDoProcesso.get(indicador.processo_id) ?? "Processo"}
                              </button>
                            ) : "Sem processo"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[indicador.periodicidade, indicador.responsavel].filter(Boolean).join(" · ")}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatarMeta(indicador)}</TableCell>
                        {periodos.map((periodo) => {
                          const medicao = medicoes.find((item) => item.indicador_id === indicador.id && item.periodo === periodo);
                          const estado = situacao(indicador, medicao?.valor);
                          return (
                            <TableCell key={periodo} className="p-1 text-center">
                              <button
                                type="button"
                                className={`w-full whitespace-nowrap rounded px-2 py-1 text-sm hover:ring-1 hover:ring-primary ${COR_SITUACAO[estado]}`}
                                title={medicao?.comentario || `Lançar ${rotuloPeriodo(periodo)}`}
                                aria-label={`${indicador.nome}, ${rotuloPeriodo(periodo)}: ${medicao ? formatarValor(medicao.valor, indicador.unidade) : "sem resultado"}`}
                                onClick={() => setLancando({ indicador, periodo })}
                              >
                                {medicao ? formatarValor(medicao.valor, indicador.unidade) : "—"}
                              </button>
                            </TableCell>
                          );
                        })}
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className={COR_SITUACAO[atual]}>{ROTULO_SITUACAO[atual]}</Badge>
                          {podeCriarAcao && (
                            <Button variant="link" size="sm" className="h-auto px-2" onClick={() => void criarAcao(indicador, ultima)}>
                              <ListChecks className="mr-1 h-3.5 w-3.5" /> Criar ação
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button size="sm" variant="outline" onClick={() => setLancando({ indicador, periodo: periodoDe(new Date()) })}>Lançar</Button>
                          <Button variant="ghost" size="icon" title="Editar indicador" aria-label={`Editar ${indicador.nome}`} onClick={() => setEditando({ indicador })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Excluir indicador" aria-label={`Excluir ${indicador.nome}`} onClick={() => setExcluindo(indicador)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <EditorIndicador
        aberto={editando !== null}
        indicador={editando?.indicador ?? null}
        processos={processos}
        onFechar={() => setEditando(null)}
        onSalvar={salvarIndicador}
      />

      <LancarResultado
        indicador={lancando?.indicador ?? null}
        periodoInicial={lancando?.periodo ?? periodoDe(new Date())}
        medicoes={medicoes}
        onFechar={() => setLancando(null)}
        onSalvar={salvarResultado}
      />

      <AlertDialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este indicador?</AlertDialogTitle>
            <AlertDialogDescription>
              "{excluindo?.nome}" e todos os resultados lançados nele serão apagados. Não dá para desfazer.
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

export default Indicadores;
