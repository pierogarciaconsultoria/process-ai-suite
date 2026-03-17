import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, FileText, GitCompare, BarChart3, ListChecks, Pencil, Download } from "lucide-react";
import { processos, processosDetalhados, processosFormMock } from "@/data/mock-processos";
import { Textarea } from "@/components/ui/textarea";
import BpmnEditor from "@/components/BpmnEditor";
import { supabase } from "@/integrations/supabase/client";
 

const ProcessoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const processo = id ? processos.find((p) => p.id === id) ?? null : null;
  const detalhes = id ? processosDetalhados[id] ?? null : null;
  const formMock = id ? processosFormMock[id] ?? null : null;
  const executoresLista =
    formMock?.etapas
      ?.map((e) => e.responsavel)
      .filter(Boolean) ?? [];
  const executores =
    Array.from(new Set(executoresLista)).join(", ") ||
    formMock?.areasEnvolvidas ||
    "";
  const [toBeDesc, setToBeDesc] = useState("");
  const [tabValue, setTabValue] = useState("bpmn");
  const handlePrintAnalysis = () => window.print();
  const [bpmnText, setBpmnText] = useState("");
  const bpmnTextGenerated = useMemo(() => {
    const linhas: string[] = [];
    if (formMock?.entradas) linhas.push(`Entradas:\n${formMock.entradas}`);
    const etapas = (formMock?.etapas ?? []).map((e, i) => `${i + 1}. ${e.atividade} • ${e.responsavel ?? "-"} • ${e.sistema ?? "-"}`);
    if (etapas.length) linhas.push(`Etapas:\n${etapas.join("\n")}`);
    if (formMock?.decisoes) linhas.push(`Decisões:\n${formMock.decisoes}`);
    if (formMock?.saidas) linhas.push(`Saídas:\n${formMock.saidas}`);
    return linhas.join("\n\n");
  }, [formMock]);

  const statusColor =
    processo?.status === "Mapeado"
      ? "bg-info text-info-foreground"
      : processo?.status === "Em Análise"
      ? "bg-warning text-warning-foreground"
      : processo?.status === "Documentado"
      ? "bg-success text-success-foreground"
      : "bg-muted text-muted-foreground";

  const criticidadeColor =
    processo?.criticidade === "Crítica"
      ? "bg-destructive text-destructive-foreground"
      : processo?.criticidade === "Alta"
      ? "bg-destructive/20 text-destructive border-destructive/30"
      : processo?.criticidade === "Média"
      ? "bg-warning/20 text-warning border-warning/30"
      : "bg-success/20 text-success border-success/30";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/processos")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{processo?.nome ?? "Processo"}</h1>
            <p className="text-muted-foreground">
              Processo #{id} {processo?.area ? `• ${processo.area}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/processos/${id}/editar`, {
                state: processo
                  ? { nome: processo.nome, area: processo.area, responsavel: processo.responsavel }
                  : undefined,
              })
            }
          >
            <Pencil className="h-3 w-3 mr-1" /> Editar
          </Button>
          {processo?.status && <Badge className={statusColor}>{processo.status}</Badge>}
          {processo?.criticidade && (
            <Badge variant="outline" className={criticidadeColor}>
              {processo.criticidade}
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={tabValue} onValueChange={setTabValue}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="bpmn">BPMN</TabsTrigger>
          <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
          <TabsTrigger value="redesenho">Redesenho</TabsTrigger>
          <TabsTrigger value="documentacao">Documentação</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
        </TabsList>

        <TabsContent value="bpmn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mapa AS IS</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="visual">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="textual">BPMN Textual</TabsTrigger>
                  <TabsTrigger value="visual">Editor Visual BPMN</TabsTrigger>
                </TabsList>
                <TabsContent value="textual">
                  <div className="space-y-4">
                    <Textarea
                      value={bpmnText || bpmnTextGenerated}
                      onChange={(e) => setBpmnText(e.target.value)}
                      className="min-h-[280px]"
                      placeholder="BPMN textual"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBpmnText(bpmnTextGenerated)}
                      >
                        Gerar do Formulário
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={async () => {
                          const text = bpmnText || bpmnTextGenerated;
                          if (!id) return;
                          await supabase
                            .from("processes")
                            .update({ description_as_is: text, updated_at: new Date().toISOString() })
                            .eq("id", id);
                        }}
                      >
                        Salvar Textual
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="visual">
                  <BpmnEditor
                    steps={formMock?.etapas ?? []}
                    entradas={formMock?.entradas ?? ""}
                    decisoes={formMock?.decisoes ?? ""}
                    saidas={formMock?.saidas ?? ""}
                    processId={id ?? null}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostico" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {(detalhes?.diagnostico ?? []).map((d, i) => {
              const color =
                d.tipo === "Gargalo" ? "destructive" : d.tipo === "Risco" ? "warning" : "info";
              const border = `border-l-4 border-l-${color}`;
              const titleClass = `text-sm font-medium text-${color}`;
              return (
                <Card key={i} className={border}>
                  <CardContent className="p-4">
                    <p className={titleClass}>{d.tipo}</p>
                    <p className="text-sm text-muted-foreground mt-1">{d.descricao}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="redesenho" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mapa TO BE</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-2 lg:p-0">
                <div className="lg:col-span-2 space-y-4">
                  <div className="rounded-lg border p-6 bg-card">
                    <h3 className="text-lg font-semibold mb-4">Descreva o Processo Futuro (TO BE)</h3>
                    <Textarea
                      value={toBeDesc}
                      onChange={(e) => setToBeDesc(e.target.value)}
                      className="min-h-[400px] resize-none"
                      placeholder="Descreva o processo futuro otimizado, incluindo melhorias, automações e mudanças de responsabilidade."
                    />
                    <div className="mt-4 p-4 rounded-lg border bg-muted/30">
                      <p className="text-sm text-muted-foreground">💡 Dica: destaque melhorias e automações desejadas.</p>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-3 min-h-[600px] rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Resumo do Redesenho</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{toBeDesc || "Sem descrição do TO BE."}</p>
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

        <TabsContent value="analise" className="space-y-6">
          <style>{`@media print { body * { visibility: hidden; } #analysis-print, #analysis-print * { visibility: visible; } #analysis-print { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" /> Análise do Processo
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handlePrintAnalysis}><Download className="h-3 w-3 mr-1" /> PDF</Button>
            </CardHeader>
            <CardContent className="space-y-8" id="analysis-print">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="text-sm font-medium">{processo?.nome ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Área</p>
                  <p className="text-sm font-medium">{processo?.area ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Responsável</p>
                  <p className="text-sm font-medium">{processo?.responsavel ?? "-"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {processo?.status && <Badge className={statusColor}>{processo.status}</Badge>}
                  {processo?.criticidade && (
                    <Badge variant="outline" className={criticidadeColor}>
                      {processo.criticidade}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Descrição</p>
                <p className="text-sm text-muted-foreground">{detalhes?.descricao ?? "Sem descrição disponível."}</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Diagnóstico</p>
                <div className="grid gap-4 md:grid-cols-3">
                  {(detalhes?.diagnostico ?? []).map((d, i) => {
                    const color = d.tipo === "Gargalo" ? "destructive" : d.tipo === "Risco" ? "warning" : "info";
                    const border = `border-l-4 border-l-${color}`;
                    const titleClass = `text-sm font-medium text-${color}`;
                    return (
                      <Card key={i} className={border}>
                        <CardContent className="p-4">
                          <p className={titleClass}>{d.tipo}</p>
                          <p className="text-sm text-muted-foreground mt-1">{d.descricao}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Indicadores</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicador</TableHead>
                      <TableHead>Fórmula</TableHead>
                      <TableHead>Meta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detalhes?.indicadores ?? []).map((ind, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{ind.nome}</TableCell>
                        <TableCell>{ind.formula}</TableCell>
                        <TableCell>{ind.meta}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4" /> Plano de Melhoria</p>
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
                    {(detalhes?.melhorias ?? []).map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{m.acao}</TableCell>
                        <TableCell>{m.responsavel}</TableCell>
                        <TableCell>{new Date(m.prazo).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <Badge className={m.status === "Em andamento" ? "bg-warning text-warning-foreground" : m.status === "Concluído" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                            {m.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-8">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Contexto</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Objetivo</p>
                      <p className="text-sm">{formMock?.objetivo ?? "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Cliente do Processo</p>
                      <p className="text-sm">{formMock?.clienteProcesso ?? "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Áreas Envolvidas</p>
                      <p className="text-sm">{formMock?.areasEnvolvidas ?? "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Entradas</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{formMock?.entradas ?? "-"}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Etapas do Processo</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Atividade</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Sistema</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(formMock?.etapas ?? []).map((e, i) => (
                        <TableRow key={i}>
                          <TableCell>{e.ordem}</TableCell>
                          <TableCell className="font-medium">{e.atividade}</TableCell>
                          <TableCell>{e.responsavel}</TableCell>
                          <TableCell>{e.sistema}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Decisões</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{formMock?.decisoes ?? "-"}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Saídas</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{formMock?.saidas ?? "-"}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Problemas Identificados</p>
                  <div className="flex flex-wrap gap-2">
                    {!!formMock?.problemas?.retrabalho && <Badge className="bg-warning/20 text-warning border-warning/30">Retrabalho</Badge>}
                    {!!formMock?.problemas?.atrasos && <Badge className="bg-warning/20 text-warning border-warning/30">Atrasos</Badge>}
                    {!!formMock?.problemas?.erros && <Badge className="bg-warning/20 text-warning border-warning/30">Erros</Badge>}
                    {!!formMock?.problemas?.dependencia && <Badge className="bg-warning/20 text-warning border-warning/30">Dependência de pessoas</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{formMock?.problemasTexto ?? ""}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Riscos</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Risco</TableHead>
                        <TableHead>Impacto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(formMock?.riscos ?? []).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.risco}</TableCell>
                          <TableCell>{r.impacto}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Indicadores (Formulário)</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{formMock?.indicadores ?? "-"}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Melhoria (Formulário)</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{formMock?.sugestoes ?? "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProcessoDetalhe;
