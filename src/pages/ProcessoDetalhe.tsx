import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, FileText, GitCompare, BarChart3, ListChecks, Pencil, Download } from "lucide-react";
import { processos, processosDetalhados, processosFormMock } from "@/data/mock-processos";
import BPMNCanvas from "@/components/BPMNCanvas";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  const [asIsDesc, setAsIsDesc] = useState("");
  const [toBeDesc, setToBeDesc] = useState("");
  const [xmlAsIs, setXmlAsIs] = useState<string | null>(null);
  const [xmlToBe, setXmlToBe] = useState<string | null>(null);
  const [genKeyAsIs, setGenKeyAsIs] = useState(0);
  const [genKeyToBe, setGenKeyToBe] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingAsIs, setGeneratingAsIs] = useState(false);
  const [generatingToBe, setGeneratingToBe] = useState(false);
  const [executoresOverride, setExecutoresOverride] = useState("");

  const handlePersist = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const payload = {
        id,
        bpmn_as_is: xmlAsIs ?? null,
        bpmn_to_be: xmlToBe ?? null,
        description_as_is: asIsDesc || null,
        description_to_be: toBeDesc || null,
        updated_at: new Date().toISOString(),
        nome: processo?.nome ?? null,
        area: processo?.area ?? null,
        responsavel: processo?.responsavel ?? null,
      };
      const { error } = await supabase.from("processes").upsert(payload, { onConflict: "id" });
      if (error) {
        toast({ title: "Erro ao salvar BPMN", description: error.message });
      } else {
        toast({ title: "BPMN salvo", description: "XMLs e descrições foram persistidos." });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao salvar", description: msg });
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    if (!id) return;
    const desc = localStorage.getItem(`bpmn_as_is_description_${id}`);
    const exec = localStorage.getItem(`bpmn_executors_${id}`);
    if (desc && desc.length > 0) {
      setAsIsDesc(desc);
      setGenKeyAsIs((k) => k + 1);
      localStorage.removeItem(`bpmn_as_is_description_${id}`);
    }
    if (exec && exec.length > 0) {
      setExecutoresOverride(exec);
      localStorage.removeItem(`bpmn_executors_${id}`);
    }
  }, [id]);

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
          <Button variant="default" size="sm" onClick={handlePersist} disabled={saving || (!xmlAsIs && !xmlToBe)}>
            {saving ? "Salvando..." : "Salvar BPMN no Banco"}
          </Button>
          {processo?.status && <Badge className={statusColor}>{processo.status}</Badge>}
          {processo?.criticidade && (
            <Badge variant="outline" className={criticidadeColor}>
              {processo.criticidade}
            </Badge>
          )}
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
          <div className="space-y-2">
            <div className="text-lg font-semibold">Mapa AS IS</div>
            <div className="rounded-md border p-2 md:p-3">
              <BPMNCanvas
                processName={processo?.nome}
                processCode={id ?? ""}
                executors={executoresOverride || executores}
                description={asIsDesc}
                generateKey={genKeyAsIs}
                onSave={(xml) => setXmlAsIs(xml)}
                onGenerated={() => setGeneratingAsIs(false)}
                hideGenerateButton
              />
            </div>
          </div>
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
                    <Button
                      className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      onClick={() => { setGeneratingToBe(true); setGenKeyToBe((k) => k + 1); }}
                      disabled={generatingToBe}
                    >
                      {generatingToBe ? "Gerando..." : "✨ Gerar Diagrama BPMN Automaticamente"}
                    </Button>
                  </div>
                </div>
                <div className="lg:col-span-3 min-h-[600px] rounded-lg border">
                  <div className="h-full p-2">
                    <BPMNCanvas
                      processName={processo?.nome ? `${processo.nome} • TO BE` : "Processo • TO BE"}
                      processCode={(id ?? "") + "-to-be"}
                      executors={executores}
                      description={toBeDesc}
                      generateKey={genKeyToBe}
                      onSave={(xml) => setXmlToBe(xml)}
                      onGenerated={() => setGeneratingToBe(false)}
                    />
                  </div>
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
                  {(detalhes?.indicadores ?? []).map((ind, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{ind.nome}</TableCell>
                      <TableCell>{ind.formula}</TableCell>
                      <TableCell>{ind.meta}</TableCell>
                    </TableRow>
                  ))}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProcessoDetalhe;
