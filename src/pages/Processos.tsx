import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Sparkles } from "lucide-react";
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
  const navigate = useNavigate();

  const [lista] = useState<Processo[]>([]);
  const filtered = useMemo(
    () =>
      lista.filter(
        (p) =>
          p.nome.toLowerCase().includes(search.toLowerCase()) ||
          p.area.toLowerCase().includes(search.toLowerCase()),
      ),
    [lista, search],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Processos</h1>
          <p className="text-muted-foreground">Gerencie os processos da organização</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate("/processos/entrevista")}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Processo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar processo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Responsável</TableHead>
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
