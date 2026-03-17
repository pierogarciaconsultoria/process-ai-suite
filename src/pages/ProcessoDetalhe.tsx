import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil } from "lucide-react";
import { processosDetalhados, processos } from "@/data/mock-processos";

const statusColors: Record<string, string> = {
  Novo: "bg-muted text-muted-foreground",
  Mapeado: "bg-info text-info-foreground",
  "Em Análise": "bg-warning text-warning-foreground",
  Documentado: "bg-success text-success-foreground",
};

const ProcessoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const processo = processosDetalhados[id || ""] || processos.find((p) => p.id === id);

  if (!processo) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="outline" onClick={() => navigate("/processos")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Processo não encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }

  const detalhado = processosDetalhados[id || ""];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{processo.nome}</h1>
          <p className="text-muted-foreground">{processo.area} • {processo.responsavel}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/processos")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Button onClick={() => navigate(`/processos/${id}/editar`)}>
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Badge className={statusColors[processo.status]}>{processo.status}</Badge>
        <Badge variant="outline">{processo.criticidade}</Badge>
      </div>

      {detalhado?.descricao && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Descrição</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">{detalhado.descricao}</p></CardContent>
        </Card>
      )}

      {detalhado?.diagnostico && detalhado.diagnostico.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Diagnóstico</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {detalhado.diagnostico.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Badge variant="outline" className="shrink-0">{d.tipo}</Badge>
                  <span className="text-sm text-muted-foreground">{d.descricao}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {detalhado?.indicadores && detalhado.indicadores.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Indicadores</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead>Fórmula</TableHead>
                  <TableHead>Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalhado.indicadores.map((ind, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{ind.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{ind.formula}</TableCell>
                    <TableCell>{ind.meta}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {detalhado?.melhorias && detalhado.melhorias.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Melhorias</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ação</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalhado.melhorias.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.acao}</TableCell>
                    <TableCell>{m.responsavel}</TableCell>
                    <TableCell>{m.prazo}</TableCell>
                    <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProcessoDetalhe;
