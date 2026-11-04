import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Bot, Loader2, Search, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { mapProcessRowToListItem, PROCESSO_STATUS, type ProcessoListItem, type ProcessoStatus } from "@/lib/processos";
import { usePodeGerenciar } from "@/lib/perfil";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";
import { entrevistaEmAberto, STATUS_CORES } from "@/lib/ciclo-processo";

const criticidadeColors: Record<string, string> = {
  Baixa: "bg-success/20 text-success border-success/30",
  Média: "bg-warning/20 text-warning border-warning/30",
  Alta: "bg-destructive/20 text-destructive border-destructive/30",
  Crítica: "bg-destructive text-destructive-foreground",
};

const Processos = () => {
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [responsavelFilter, setResponsavelFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<ProcessoStatus | "all" | "">("");
  const [lista, setLista] = useState<ProcessoListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  // Excluir entrevistas é de Consultor e Gestor.
  const podeGerenciar = usePodeGerenciar(companyId);
  // Entrevistas paradas mostradas antes de começar outra, para não mapear o mesmo processo duas vezes.
  const [escolhendoInicio, setEscolhendoInicio] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<ProcessoListItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    const loadProcessos = async () => {
      setIsLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const activeCompanyId = await resolveAccessibleCompanyId(auth.user?.id ?? null);
        if (isMounted) setCompanyId(activeCompanyId);

        if (!activeCompanyId) {
          if (isMounted) setLista([]);
          return;
        }

        const { data, error } = await supabase
          .from("processos")
          .select("*")
          .eq("company_id", activeCompanyId)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        if (isMounted) {
          setLista((data || []).map(mapProcessRowToListItem));
        }
      } catch (error) {
        console.error("Erro ao carregar processos:", error);
        if (isMounted) setLista([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadProcessos();

    return () => {
      isMounted = false;
    };
  }, []);

  const areas = useMemo(
    () => Array.from(new Set(lista.map((p) => p.area).filter((a) => a && a.trim().length > 0))),
    [lista],
  );
  const responsaveis = useMemo(
    () => Array.from(new Set(lista.map((p) => p.responsavel).filter((r) => r && r.trim().length > 0))),
    [lista],
  );
  const entrevistasParadas = useMemo(() => lista.filter((p) => p.status === "Em entrevista"), [lista]);

  const comecarNovo = () => navigate("/processos/novo/entrevista", { state: { guidedExperience: true } });
  const retomar = (id: string) => navigate(`/processos/${id}/entrevista?guided=1`, { state: { guidedExperience: true } });
  const novoProcesso = () => (entrevistasParadas.length > 0 ? setEscolhendoInicio(true) : comecarNovo());

  const excluir = async () => {
    if (!paraExcluir || !companyId) return;
    setExcluindo(true);
    // Só entrevistas não concluídas podem ser excluídas por aqui.
    const { data, error } = await supabase
      .from("processos")
      .delete()
      .eq("id", paraExcluir.id)
      .eq("company_id", companyId)
      .eq("status", "Em entrevista")
      .select("id");
    setExcluindo(false);
    if (error || !data?.length) {
      const motivo = error ? mensagemDoErroDoProcesso(error, "Tente novamente.") : "A entrevista já não está mais em andamento. Atualize a página.";
      toast({ title: "Não foi possível excluir", description: motivo, variant: "destructive" });
      return;
    }
    setLista((atual) => atual.filter((p) => p.id !== paraExcluir.id));
    toast({ title: "Entrevista excluída", description: paraExcluir.nome || "Entrevista sem nome" });
    setParaExcluir(null);
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return lista.filter((p) => {
      if (
        term &&
        !p.nome.toLowerCase().includes(term) &&
        !p.area.toLowerCase().includes(term) &&
        !p.responsavel.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (areaFilter && areaFilter !== "all" && p.area !== areaFilter) return false;
      if (responsavelFilter && responsavelFilter !== "all" && p.responsavel !== responsavelFilter) return false;
      if (statusFilter && statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [lista, search, areaFilter, responsavelFilter, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Processos</h1>
          <p className="text-muted-foreground">Gerencie os processos da organização</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={novoProcesso}>
            <Bot className="h-4 w-4 mr-2" />
            Novo Processo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar processo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Área</Label>
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger className="w-[190px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {areas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Responsável</Label>
                <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {responsaveis.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProcessoStatus | "all" | "")}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PROCESSO_STATUS.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Dono do Processo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criticidade</TableHead>
                <TableHead>Data</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando processos...
                    </span>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3 py-6">
                      <span>Nenhum processo cadastrado ainda. Inicie uma experiência guiada com o Peter.</span>
                      <Button onClick={novoProcesso}>
                        <Bot className="h-4 w-4 mr-2" />
                        Novo Processo
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((processo) => (
                  <TableRow key={processo.id}>
                    <TableCell className="font-medium">{processo.nome || <span className="text-muted-foreground">Sem nome</span>}</TableCell>
                    <TableCell>{processo.area}</TableCell>
                    <TableCell>{processo.responsavel}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_CORES[processo.status]}>{processo.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={criticidadeColors[processo.criticidade]}>
                        {processo.criticidade}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(processo.data_criacao).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {entrevistaEmAberto(processo.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Retomar entrevista"
                          aria-label={`Retomar entrevista de ${processo.nome}`}
                          onClick={() => retomar(processo.id)}
                        >
                          <Bot className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Abrir processo"
                        aria-label={`Abrir ${processo.nome || "processo sem nome"}`}
                        onClick={() => navigate(`/processos/${processo.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {processo.status === "Em entrevista" && podeGerenciar && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir entrevista"
                          aria-label={`Excluir entrevista de ${processo.nome || "processo sem nome"}`}
                          onClick={() => setParaExcluir(processo)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={escolhendoInicio} onOpenChange={setEscolhendoInicio}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Você tem entrevistas não concluídas</DialogTitle>
            <DialogDescription>
              Se o processo que você vai mapear já está aqui, continue a entrevista dele em vez de começar outra.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {entrevistasParadas.map((processo) => (
              <li key={processo.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{processo.nome || "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground">
                    Iniciada em {new Date(processo.data_criacao).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => retomar(processo.id)}>Continuar</Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={comecarNovo}>Começar um processo novo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={paraExcluir !== null} onOpenChange={(aberto) => !aberto && !excluindo && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta entrevista?</AlertDialogTitle>
            <AlertDialogDescription>
              "{paraExcluir?.nome || "Entrevista sem nome"}" e tudo o que foi respondido nela serão apagados. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void excluir()} disabled={excluindo}>
              {excluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Processos;
