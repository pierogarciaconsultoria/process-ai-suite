import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

const Arquitetura = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Arquitetura de Processos</h1>
          <p className="text-muted-foreground">Cadeia de valor e landscape de processos</p>
        </div>
        <Button className="gap-2">
          <Sparkles className="h-4 w-4" />
          Classificar com IA
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Nenhum dado disponível. Cadastre processos para visualizar a arquitetura.</p>
        </CardContent>
      </Card>

      {/* Cadeia de Valor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Process Landscape</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Arquitetura;
