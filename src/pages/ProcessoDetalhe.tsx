import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const statusColors: Record<string, string> = {
  Novo: "bg-muted text-muted-foreground",
  Mapeado: "bg-info text-info-foreground",
  "Em Análise": "bg-warning text-warning-foreground",
  Documentado: "bg-success text-success-foreground",
};

const ProcessoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="outline" onClick={() => navigate("/processos")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Processo não encontrado ou dados ainda não cadastrados.
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessoDetalhe;
