import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { processos } from "@/data/mock-processos";

const statusColors: Record<string, string> = {
  Novo: "bg-muted text-muted-foreground",
  Mapeado: "bg-info text-info-foreground",
  "Em Análise": "bg-warning text-warning-foreground",
  Documentado: "bg-success text-success-foreground",
  Aprovado: "bg-primary text-primary-foreground",
};

const ProcessoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const processo = processos.find((item) => item.id === id);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="outline" onClick={() => navigate("/processos")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
      <Card>
        <CardContent className="py-12">
          {!processo ? (
            <div className="text-center text-muted-foreground">
              Processo não encontrado ou dados ainda não cadastrados.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold">{processo.nome}</h1>
                <Badge className={statusColors[processo.status]}>{processo.status}</Badge>
                {processo.mapa_revisao ? <Badge variant="outline">{processo.mapa_revisao}</Badge> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div><span className="font-medium">Área:</span> {processo.area}</div>
                <div><span className="font-medium">Responsável:</span> {processo.responsavel}</div>
                <div><span className="font-medium">Criado em:</span> {new Date(processo.data_criacao).toLocaleDateString("pt-BR")}</div>
                <div><span className="font-medium">Mapa aprovado em:</span> {processo.mapa_aprovado_em ? new Date(processo.mapa_aprovado_em).toLocaleDateString("pt-BR") : "Não informado"}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessoDetalhe;
