import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, FileText, GitCompare, BarChart3, ListChecks, Download } from "lucide-react";

const ProcessoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/processos")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Vendas</h1>
            <p className="text-muted-foreground">Processo #{id} • Comercial</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-info text-info-foreground">Mapeado</Badge>
          <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">Alta</Badge>
        </div>
      </div>

      <Tabs defaultValue="bpmn">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="bpmn">BPMN</TabsTrigger>
          <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
          <TabsTrigger value="redesenho">Redesenho</TabsTrigger>
          <TabsTrigger value="documentacao">Documentação</TabsTrigger>
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="melhorias">Melhorias</TabsTrigger>
        </TabsList>

        <TabsContent value="bpmn" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Fluxograma BPMN - AS IS</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><Download className="h-3 w-3 mr-1" /> PNG</Button>
                <Button variant="outline" size="sm"><Download className="h-3 w-3 mr-1" /> SVG</Button>
                <Button variant="outline" size="sm"><Download className="h-3 w-3 mr-1" /> XML</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96 border rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground">
                <p>O fluxograma BPMN será renderizado aqui após processamento com IA</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostico" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-destructive">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-destructive">Gargalo</p>
                <p className="text-sm text-muted-foreground mt-1">Aprovação manual do gerente causa atraso de 2 dias em média</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-warning">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-warning">Risco</p>
                <p className="text-sm text-muted-foreground mt-1">Processo depende de planilha Excel sem backup</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-info">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-info">Atenção</p>
                <p className="text-sm text-muted-foreground mt-1">3 atividades duplicadas entre departamentos</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="redesenho" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GitCompare className="h-5 w-5" /> Comparação AS IS vs TO BE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 bg-destructive/5">
                  <h3 className="font-semibold mb-2 text-destructive">AS IS (Atual)</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• 12 etapas no processo</li>
                    <li>• 3 aprovações manuais</li>
                    <li>• Tempo médio: 5 dias</li>
                  </ul>
                </div>
                <div className="border rounded-lg p-4 bg-success/5">
                  <h3 className="font-semibold mb-2 text-success">TO BE (Melhorado)</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• 8 etapas no processo</li>
                    <li>• 1 aprovação automatizada</li>
                    <li>• Tempo estimado: 2 dias</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentacao" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" /> Procedimento Operacional Padrão
              </CardTitle>
              <Button variant="outline" size="sm"><Download className="h-3 w-3 mr-1" /> PDF</Button>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>O procedimento operacional será gerado automaticamente pela IA após o processamento do formulário master.</p>
                <p>Seções incluídas: Identificação, Objetivo, Escopo, Responsabilidades, Descrição das atividades, Fluxograma, Documentos, Riscos, Controles.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indicadores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Indicadores do Processo
              </CardTitle>
            </CardHeader>
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
                  <TableRow>
                    <TableCell className="font-medium">Tempo médio de execução</TableCell>
                    <TableCell>Soma do tempo / Nº execuções</TableCell>
                    <TableCell>≤ 3 dias</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Taxa de erro</TableCell>
                    <TableCell>Erros / Total × 100</TableCell>
                    <TableCell>≤ 2%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Tempo de resposta</TableCell>
                    <TableCell>Data resposta - Data solicitação</TableCell>
                    <TableCell>≤ 24h</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="melhorias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ListChecks className="h-5 w-5" /> Plano de Melhoria
              </CardTitle>
            </CardHeader>
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
                  <TableRow>
                    <TableCell className="font-medium">Automatizar aprovação de propostas até R$10k</TableCell>
                    <TableCell>Ana Silva</TableCell>
                    <TableCell>30/04/2024</TableCell>
                    <TableCell><Badge className="bg-warning text-warning-foreground">Em andamento</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Migrar planilhas para sistema CRM</TableCell>
                    <TableCell>Carlos Souza</TableCell>
                    <TableCell>15/05/2024</TableCell>
                    <TableCell><Badge className="bg-muted text-muted-foreground">Pendente</Badge></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProcessoDetalhe;
