import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

const cadeiaValor = {
  estrategicos: [
    { nome: "Planejamento Estratégico", processos: 3 },
    { nome: "Gestão da Empresa", processos: 2 },
  ],
  operacionais: [
    { nome: "Gestão Comercial", processos: 6 },
    { nome: "Gestão de Operações", processos: 8 },
    { nome: "Entrega de Serviços", processos: 4 },
  ],
  apoio: [
    { nome: "Financeiro", processos: 4 },
    { nome: "RH", processos: 3 },
    { nome: "TI", processos: 3 },
  ],
};

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

      {/* Dashboard cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">24</p>
            <p className="text-sm text-muted-foreground">Processos Mapeados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-destructive">5</p>
            <p className="text-sm text-muted-foreground">Processos Críticos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-warning">8</p>
            <p className="text-sm text-muted-foreground">Sem Documentação</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-info">12</p>
            <p className="text-sm text-muted-foreground">Sem Indicadores</p>
          </CardContent>
        </Card>
      </div>

      {/* Cadeia de Valor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Process Landscape</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estratégicos */}
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <h3 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wider">Processos Estratégicos</h3>
            <div className="flex flex-wrap gap-3">
              {cadeiaValor.estrategicos.map((mp) => (
                <div key={mp.nome} className="bg-card rounded-lg border px-4 py-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <p className="font-medium text-sm text-foreground">{mp.nome}</p>
                  <Badge variant="outline" className="mt-1 text-xs">{mp.processos} processos</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Operacionais */}
          <div className="rounded-lg border-2 border-success/30 bg-success/5 p-4">
            <h3 className="font-semibold text-success mb-3 text-sm uppercase tracking-wider">Processos Operacionais</h3>
            <div className="flex flex-wrap gap-3">
              {cadeiaValor.operacionais.map((mp) => (
                <div key={mp.nome} className="bg-card rounded-lg border px-4 py-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <p className="font-medium text-sm text-foreground">{mp.nome}</p>
                  <Badge variant="outline" className="mt-1 text-xs">{mp.processos} processos</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Apoio */}
          <div className="rounded-lg border-2 border-info/30 bg-info/5 p-4">
            <h3 className="font-semibold text-info mb-3 text-sm uppercase tracking-wider">Processos de Apoio</h3>
            <div className="flex flex-wrap gap-3">
              {cadeiaValor.apoio.map((mp) => (
                <div key={mp.nome} className="bg-card rounded-lg border px-4 py-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <p className="font-medium text-sm text-foreground">{mp.nome}</p>
                  <Badge variant="outline" className="mt-1 text-xs">{mp.processos} processos</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Arquitetura;
