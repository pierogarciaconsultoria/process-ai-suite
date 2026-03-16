import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";

const relatorios = [
  { id: "1", titulo: "Relatório Completo - Gestão de Vendas", processo: "Gestão de Vendas", data: "2024-03-15" },
  { id: "2", titulo: "Relatório Completo - Onboarding de Clientes", processo: "Onboarding de Clientes", data: "2024-03-12" },
  { id: "3", titulo: "Arquitetura de Processos - Tech Solutions", processo: "Todos", data: "2024-03-10" },
];

const Relatorios = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Relatórios gerados automaticamente</p>
      </div>

      <div className="grid gap-4">
        {relatorios.map((rel) => (
          <Card key={rel.id}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{rel.titulo}</p>
                  <p className="text-sm text-muted-foreground">Processo: {rel.processo} • {new Date(rel.data).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-3 w-3 mr-1" /> PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Relatorios;
