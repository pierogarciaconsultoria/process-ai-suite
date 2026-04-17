import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Eye, Pencil } from "lucide-react";
import { processos as mockProcessos } from "@/data/mock-processos";
import { demoProcessoForm } from "@/data/processo-form-types";
type Status = "Novo" | "Mapeado" | "Em Análise" | "Documentado";
type Criticidade = "Baixa" | "Média" | "Alta" | "Crítica";
type Processo = {
  id: string;
  nome: string;
  area: string;
  responsavel: string;
  status: Status;
  criticidade: Criticidade;
  data_criacao: string;
};

const statusColors: Record<string, string> = {
  Novo: "bg-muted text-muted-foreground",
  Mapeado: "bg-info text-info-foreground",
  "Em Análise": "bg-warning text-warning-foreground",
  Documentado: "bg-success text-success-foreground",
};

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
  const [statusFilter, setStatusFilter] = useState<Status | "all" | "">("");
  const navigate = useNavigate();

  const [lista] = useState<Processo[]>(mockProcessos);
  const areas = useMemo(
    () => Array.from(new Set(lista.map((p) => p.area).filter((a) => a && a.trim().length > 0))),
    [lista],
  );
  const responsaveis = useMemo(
    () => Array.from(new Set(lista.map((p) => p.responsavel).filter((r) => r && r.trim().length > 0))),
    [lista],
  );
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
          <Button variant="outline" onClick={() => navigate("/processos/novo", { state: { formPrefill: demoProcessoForm } })}>
            Ver exemplo na prática
          </Button>
          <Button onClick={() => navigate("/processos/entrevista")}>
            <Plus className="h-4 w-4 mr-2" />
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
                  <SelectTrigger className="w-[160px]">
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
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "all" | "")}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Novo">Novo</SelectItem>
                    <SelectItem value="Mapeado">Mapeado</SelectItem>
                    <SelectItem value="Em Análise">Em Análise</SelectItem>
                    <SelectItem value="Documentado">Documentado</SelectItem>
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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhum processo cadastrado. Clique em “Novo Processo” para começar.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((processo) => (
                  <TableRow key={processo.id}>
                    <TableCell className="font-medium">{processo.nome}</TableCell>
                    <TableCell>{processo.area}</TableCell>
                    <TableCell>{processo.responsavel}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[processo.status]}>{processo.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={criticidadeColors[processo.criticidade]}>
                        {processo.criticidade}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(processo.data_criacao).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/processos/${processo.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/processos/${processo.id}/editar`, { state: processo })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Processos;
