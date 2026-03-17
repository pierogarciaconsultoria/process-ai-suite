import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, ArrowRight, Save, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  type ProcessoFormData,
  type EntradaForm,
  type EtapaForm,
  type RiscoForm,
  type NivelRisco,
  type IndicadorForm,
  type PlanoAcao5W2H,
  type Classificacao,
  type Frequencia,
  emptyProcessoForm,
} from "@/data/processo-form-types";

const TABS = [
  "identificacao",
  "contexto",
  "entradas",
  "atividades",
  "decisoes",
  "saidas",
  "recursos",
  "dores",
  "riscos",
  "controles",
  "melhorias",
  "plano",
] as const;

const TAB_LABELS: Record<string, string> = {
  identificacao: "1. Identificação",
  contexto: "2. Contexto",
  entradas: "3. Entradas",
  atividades: "4. Atividades",
  decisoes: "5. Decisões",
  saidas: "6. Saídas",
  recursos: "7. Recursos",
  dores: "8. Dores & Gargalos",
  riscos: "9. Riscos",
  controles: "10. Controles",
  melhorias: "11. Melhorias",
  plano: "12. Plano de Ação",
};

const ProcessoFormulario = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState<string>("identificacao");
  const [form, setForm] = useState<ProcessoFormData>(emptyProcessoForm);

  const tabIndex = TABS.indexOf(activeTab as typeof TABS[number]);

  const updateField = <K extends keyof ProcessoFormData>(key: K, value: ProcessoFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const goNext = () => {
    if (tabIndex < TABS.length - 1) setActiveTab(TABS[tabIndex + 1]);
  };
  const goPrev = () => {
    if (tabIndex > 0) setActiveTab(TABS[tabIndex - 1]);
  };

  // Dynamic row helpers
  const addEtapa = () => {
    updateField("etapas", [...form.etapas, { ordem: form.etapas.length + 1, atividade: "", responsavel: "", ferramentaDocumento: "" }]);
  };
  const removeEtapa = (i: number) => {
    updateField("etapas", form.etapas.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, ordem: idx + 1 })));
  };
  const updateEtapa = (i: number, field: keyof EtapaForm, value: string) => {
    const updated = [...form.etapas];
    (updated[i] as any)[field] = value;
    updateField("etapas", updated);
  };

  const addRisco = () => updateField("riscos", [...form.riscos, { risco: "", consequencia: "", probabilidade: 1 as NivelRisco, impacto: 1 as NivelRisco }]);
  const removeRisco = (i: number) => updateField("riscos", form.riscos.filter((_, idx) => idx !== i));
  const updateRisco = (i: number, field: keyof RiscoForm, value: string | NivelRisco) => {
    const updated = [...form.riscos];
    updated[i] = { ...updated[i], [field]: value };
    updateField("riscos", updated);
  };

  const getRiscoNivel = (score: number): { label: string; className: string } => {
    if (score <= 4) return { label: "Baixo", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
    if (score <= 9) return { label: "Médio", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" };
    if (score <= 15) return { label: "Alto", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" };
    return { label: "Crítico", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
  };

  const addIndicador = () => updateField("indicadores", [...form.indicadores, { indicador: "", meta: "" }]);
  const removeIndicador = (i: number) => updateField("indicadores", form.indicadores.filter((_, idx) => idx !== i));
  const updateIndicador = (i: number, field: keyof IndicadorForm, value: string) => {
    const updated = [...form.indicadores];
    updated[i] = { ...updated[i], [field]: value };
    updateField("indicadores", updated);
  };

  const addPlano = () => updateField("planoAcao", [...form.planoAcao, { oque: "", porque: "", quem: "", quando: "", onde: "", como: "", custo: "" }]);
  const removePlano = (i: number) => updateField("planoAcao", form.planoAcao.filter((_, idx) => idx !== i));
  const updatePlano = (i: number, field: keyof PlanoAcao5W2H, value: string) => {
    const updated = [...form.planoAcao];
    updated[i] = { ...updated[i], [field]: value };
    updateField("planoAcao", updated);
  };

  const handleSave = () => {
    toast({ title: "Processo salvo", description: "O mapeamento foi salvo com sucesso." });
    navigate("/processos");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? "Editar Processo" : "Novo Mapeamento de Processo"}
          </h1>
          <p className="text-muted-foreground">Preencha todas as seções do formulário de mapeamento</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/processos")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
              {TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="text-xs">
                  {TAB_LABELS[tab]}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Tab 1: Identificação */}
            <TabsContent value="identificacao">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={form.data} onChange={(e) => updateField("data", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Analista</Label>
                  <Input value={form.analista} onChange={(e) => updateField("analista", e.target.value)} placeholder="Nome do analista" />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input value={form.empresa} onChange={(e) => updateField("empresa", e.target.value)} placeholder="Nome da empresa" />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Processo</Label>
                  <Input value={form.nomeProcesso} onChange={(e) => updateField("nomeProcesso", e.target.value)} placeholder="Ex: Gestão de Vendas" />
                </div>
                <div className="space-y-2">
                  <Label>Classificação</Label>
                  <Select value={form.classificacao} onValueChange={(v) => updateField("classificacao", v as Classificacao)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Negócio">Negócio</SelectItem>
                      <SelectItem value="Apoio">Apoio</SelectItem>
                      <SelectItem value="Gestão">Gestão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Área</Label>
                  <Input value={form.area} onChange={(e) => updateField("area", e.target.value)} placeholder="Área responsável" />
                </div>
                <div className="space-y-2">
                  <Label>Dono do Processo</Label>
                  <Input value={form.donoProcesso} onChange={(e) => updateField("donoProcesso", e.target.value)} placeholder="Responsável principal" />
                </div>
                <div className="space-y-2">
                  <Label>Entrevistados</Label>
                  <Input value={form.entrevistados} onChange={(e) => updateField("entrevistados", e.target.value)} placeholder="Pessoas entrevistadas" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Informações Adicionais</Label>
                  <Textarea value={form.infoAdicionais} onChange={(e) => updateField("infoAdicionais", e.target.value)} placeholder="Observações relevantes" />
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Contexto & Gatilho */}
            <TabsContent value="contexto">
              <div className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-lg">Contexto do Processo</CardTitle></CardHeader>
                <div className="space-y-2">
                  <Label>Objetivo do Processo</Label>
                  <Textarea value={form.objetivo} onChange={(e) => updateField("objetivo", e.target.value)} placeholder="Qual o objetivo deste processo?" />
                </div>
                <div className="space-y-2">
                  <Label>Por que este processo existe?</Label>
                  <Textarea value={form.porqueExiste} onChange={(e) => updateField("porqueExiste", e.target.value)} placeholder="Justificativa da existência" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente do Processo</Label>
                    <Input value={form.clienteProcesso} onChange={(e) => updateField("clienteProcesso", e.target.value)} placeholder="Quem recebe o resultado" />
                  </div>
                  <div className="space-y-2">
                    <Label>Áreas Envolvidas</Label>
                    <Input value={form.areasEnvolvidas} onChange={(e) => updateField("areasEnvolvidas", e.target.value)} placeholder="Comercial, Financeiro..." />
                  </div>
                </div>
                <CardHeader className="p-0 pt-6 pb-4"><CardTitle className="text-lg">Gatilho do Processo</CardTitle></CardHeader>
                <div className="space-y-2">
                  <Label>O que inicia o processo?</Label>
                  <Textarea value={form.gatilho} onChange={(e) => updateField("gatilho", e.target.value)} placeholder="Ex: Chamado, solicitação, pedido, documento recebido..." />
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Entradas (SIPOC: Supplier + Input) */}
            <TabsContent value="entradas">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Defina as entradas do processo e seus fornecedores, seguindo a metodologia SIPOC (Supplier → Input).
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Fornecedor (Supplier)</TableHead>
                      <TableHead>Entrada (Input)</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.entradas.map((entrada, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>
                          <Input
                            value={entrada.fornecedor}
                            onChange={(e) => {
                              const updated = [...form.entradas];
                              updated[idx] = { ...updated[idx], fornecedor: e.target.value };
                              updateField("entradas", updated);
                            }}
                            placeholder="Quem fornece esta entrada"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={entrada.entrada}
                            onChange={(e) => {
                              const updated = [...form.entradas];
                              updated[idx] = { ...updated[idx], entrada: e.target.value };
                              updateField("entradas", updated);
                            }}
                            placeholder="Informação, documento ou dado"
                          />
                        </TableCell>
                        <TableCell>
                          {form.entradas.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const updated = form.entradas.filter((_, i) => i !== idx);
                                updateField("entradas", updated);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateField("entradas", [...form.entradas, { fornecedor: "", entrada: "" }])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Adicionar Entrada
                </Button>
              </div>
            </TabsContent>

            {/* Tab 4: Atividades */}
            <TabsContent value="atividades">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Descrição das Atividades</CardTitle>
                  <Button size="sm" variant="outline" onClick={addEtapa}><Plus className="h-4 w-4 mr-1" /> Etapa</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Ferramenta/Documento</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.etapas.map((etapa, i) => (
                      <TableRow key={i}>
                        <TableCell>{etapa.ordem}</TableCell>
                        <TableCell><Input value={etapa.atividade} onChange={(e) => updateEtapa(i, "atividade", e.target.value)} placeholder="Descreva a atividade" /></TableCell>
                        <TableCell><Input value={etapa.responsavel} onChange={(e) => updateEtapa(i, "responsavel", e.target.value)} placeholder="Responsável" /></TableCell>
                        <TableCell><Input value={etapa.ferramentaDocumento} onChange={(e) => updateEtapa(i, "ferramentaDocumento", e.target.value)} placeholder="Sistema/Doc" /></TableCell>
                        <TableCell>
                          {form.etapas.length > 1 && (
                            <Button size="icon" variant="ghost" onClick={() => removeEtapa(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab 5: Decisões */}
            <TabsContent value="decisoes">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Decisões do Processo</Label>
                  <Textarea value={form.decisoes} onChange={(e) => updateField("decisoes", e.target.value)} placeholder="Aprovações, verificações, análises necessárias" rows={4} />
                </div>
              </div>
            </TabsContent>

            {/* Tab 6: Saídas (SIPOC: Output → Customer) */}
            <TabsContent value="saidas">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Saídas do Processo (Output → Customer)</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Saída (Output)</TableHead>
                        <TableHead>Cliente (Customer)</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.saidas.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input value={s.saida} onChange={(e) => { const arr = [...form.saidas]; arr[i] = { ...arr[i], saida: e.target.value }; updateField("saidas", arr); }} placeholder="Resultado / entrega" />
                          </TableCell>
                          <TableCell>
                            <Input value={s.cliente} onChange={(e) => { const arr = [...form.saidas]; arr[i] = { ...arr[i], cliente: e.target.value }; updateField("saidas", arr); }} placeholder="Quem recebe a saída" />
                          </TableCell>
                          <TableCell>
                            {form.saidas.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => { const arr = form.saidas.filter((_, idx) => idx !== i); updateField("saidas", arr); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button type="button" variant="outline" size="sm" onClick={() => updateField("saidas", [...form.saidas, { saida: "", cliente: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Saída
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Tab 6: Recursos & Frequência */}
            <TabsContent value="recursos">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Recursos Utilizados</Label>
                  <Textarea value={form.recursos} onChange={(e) => updateField("recursos", e.target.value)} placeholder="Sistemas, ferramentas, máquinas, documentos..." rows={4} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequência do Processo</Label>
                    <Select value={form.frequencia} onValueChange={(v) => updateField("frequencia", v as Frequencia)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Diária", "Semanal", "Quinzenal", "Mensal", "Trimestral", "Semestral", "Anual", "Sob demanda"].map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo de Execução</Label>
                    <Input value={form.tempoExecucao} onChange={(e) => updateField("tempoExecucao", e.target.value)} placeholder="Ex: 2 horas, 3 dias..." />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 7: Dores & Gargalos */}
            <TabsContent value="dores">
              <div className="space-y-6">
                <div className="space-y-3">
                  <CardTitle className="text-lg">Dores e Problemas</CardTitle>
                  <div className="flex flex-wrap gap-4">
                    {([
                      ["retrabalho", "Retrabalho"],
                      ["atrasos", "Atrasos"],
                      ["erros", "Erros manuais"],
                      ["dependencia", "Dependência de pessoas"],
                      ["faltaPadrao", "Falta de padrão"],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <Checkbox
                          checked={form.problemas[key]}
                          onCheckedChange={(checked) =>
                            updateField("problemas", { ...form.problemas, [key]: !!checked })
                          }
                        />
                        <Label className="font-normal">{label}</Label>
                      </div>
                    ))}
                  </div>
                  <Textarea value={form.problemasTexto} onChange={(e) => updateField("problemasTexto", e.target.value)} placeholder="Descreva os problemas em detalhes" rows={3} />
                </div>

                <div className="space-y-2">
                  <CardTitle className="text-lg">Gargalos do Processo</CardTitle>
                  <Textarea value={form.gargalos} onChange={(e) => updateField("gargalos", e.target.value)} placeholder="Onde o processo trava ou atrasa?" rows={3} />
                </div>
              </div>
            </TabsContent>

            {/* Tab 8: Riscos */}
            <TabsContent value="riscos">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Riscos do Processo</CardTitle>
                  <Button size="sm" variant="outline" onClick={addRisco}><Plus className="h-4 w-4 mr-1" /> Risco</Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Avalie cada risco com a probabilidade de ocorrência (1-5) e o impacto no processo/negócio (1-5). O grau de risco é calculado automaticamente (P × I).
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Risco</TableHead>
                      <TableHead>Consequência</TableHead>
                      <TableHead className="w-[130px]">Probabilidade</TableHead>
                      <TableHead className="w-[130px]">Impacto</TableHead>
                      <TableHead className="w-[120px]">Grau de Risco</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.riscos.map((r, i) => {
                      const grau = r.probabilidade * r.impacto;
                      const nivel = getRiscoNivel(grau);
                      return (
                        <TableRow key={i}>
                          <TableCell><Input value={r.risco} onChange={(e) => updateRisco(i, "risco", e.target.value)} placeholder="Descreva o risco" /></TableCell>
                          <TableCell><Input value={r.consequencia} onChange={(e) => updateRisco(i, "consequencia", e.target.value)} placeholder="Consequência" /></TableCell>
                          <TableCell>
                            <Select value={String(r.probabilidade)} onValueChange={(v) => updateRisco(i, "probabilidade", Number(v) as NivelRisco)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 - Raro</SelectItem>
                                <SelectItem value="2">2 - Improvável</SelectItem>
                                <SelectItem value="3">3 - Possível</SelectItem>
                                <SelectItem value="4">4 - Provável</SelectItem>
                                <SelectItem value="5">5 - Quase certo</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={String(r.impacto)} onValueChange={(v) => updateRisco(i, "impacto", Number(v) as NivelRisco)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 - Insignificante</SelectItem>
                                <SelectItem value="2">2 - Menor</SelectItem>
                                <SelectItem value="3">3 - Moderado</SelectItem>
                                <SelectItem value="4">4 - Maior</SelectItem>
                                <SelectItem value="5">5 - Catastrófico</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${nivel.className}`}>
                              {grau} — {nivel.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            {form.riscos.length > 1 && (
                              <Button size="icon" variant="ghost" onClick={() => removeRisco(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab 8: Controles & Indicadores */}
            <TabsContent value="controles">
              <div className="space-y-6">
                <div className="space-y-2">
                  <CardTitle className="text-lg">Controles Existentes</CardTitle>
                  <Textarea value={form.controles} onChange={(e) => updateField("controles", e.target.value)} placeholder="Conferências, aprovações, checklists, validações..." rows={4} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Indicadores Existentes</CardTitle>
                    <Button size="sm" variant="outline" onClick={addIndicador}><Plus className="h-4 w-4 mr-1" /> Indicador</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        <TableHead>Meta</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.indicadores.map((ind, i) => (
                        <TableRow key={i}>
                          <TableCell><Input value={ind.indicador} onChange={(e) => updateIndicador(i, "indicador", e.target.value)} placeholder="Nome do indicador" /></TableCell>
                          <TableCell><Input value={ind.meta} onChange={(e) => updateIndicador(i, "meta", e.target.value)} placeholder="Meta" /></TableCell>
                          <TableCell>
                            {form.indicadores.length > 1 && (
                              <Button size="icon" variant="ghost" onClick={() => removeIndicador(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Tab 9: Melhorias, Automação, Documentação & Criticidade */}
            <TabsContent value="melhorias">
              <div className="space-y-6">
                <div className="space-y-2">
                  <CardTitle className="text-lg">Sugestões de Melhoria</CardTitle>
                  <Textarea value={form.sugestoes} onChange={(e) => updateField("sugestoes", e.target.value)} placeholder="O que mudaria neste processo?" rows={3} />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-lg">Oportunidade de Automação</CardTitle>
                  <Textarea value={form.automacao} onChange={(e) => updateField("automacao", e.target.value)} placeholder="Quais atividades poderiam ser automatizadas?" rows={3} />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-lg">Documentação Existente</CardTitle>
                  <Textarea value={form.documentacao} onChange={(e) => updateField("documentacao", e.target.value)} placeholder="POP, instrução de trabalho, manual, fluxograma..." rows={3} />
                </div>

                <div className="space-y-3">
                  <CardTitle className="text-lg">Criticidade do Processo</CardTitle>
                  <p className="text-sm text-muted-foreground">Avalie de 1 (baixo) a 5 (alto)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {([
                      ["impactoNegocio", "Impacto no Negócio"],
                      ["impactoCliente", "Impacto no Cliente"],
                      ["riscoOperacional", "Risco Operacional"],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <RadioGroup
                          value={String(form.criticidadeDetalhada[key])}
                          onValueChange={(v) =>
                            updateField("criticidadeDetalhada", { ...form.criticidadeDetalhada, [key]: Number(v) as 1 | 3 | 5 })
                          }
                          className="flex gap-4"
                        >
                          {[1, 3, 5].map((val) => (
                            <div key={val} className="flex items-center gap-1">
                              <RadioGroupItem value={String(val)} />
                              <Label className="font-normal">{val}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 10: Plano de Ação & Conclusão */}
            <TabsContent value="plano">
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Plano de Ação (5W2H)</CardTitle>
                    <Button size="sm" variant="outline" onClick={addPlano}><Plus className="h-4 w-4 mr-1" /> Ação</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>O quê</TableHead>
                          <TableHead>Por quê</TableHead>
                          <TableHead>Quem</TableHead>
                          <TableHead>Quando</TableHead>
                          <TableHead>Onde</TableHead>
                          <TableHead>Como</TableHead>
                          <TableHead>Custo</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {form.planoAcao.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell><Input value={p.oque} onChange={(e) => updatePlano(i, "oque", e.target.value)} placeholder="O quê" /></TableCell>
                            <TableCell><Input value={p.porque} onChange={(e) => updatePlano(i, "porque", e.target.value)} placeholder="Por quê" /></TableCell>
                            <TableCell><Input value={p.quem} onChange={(e) => updatePlano(i, "quem", e.target.value)} placeholder="Quem" /></TableCell>
                            <TableCell><Input value={p.quando} onChange={(e) => updatePlano(i, "quando", e.target.value)} placeholder="Quando" /></TableCell>
                            <TableCell><Input value={p.onde} onChange={(e) => updatePlano(i, "onde", e.target.value)} placeholder="Onde" /></TableCell>
                            <TableCell><Input value={p.como} onChange={(e) => updatePlano(i, "como", e.target.value)} placeholder="Como" /></TableCell>
                            <TableCell><Input value={p.custo} onChange={(e) => updatePlano(i, "custo", e.target.value)} placeholder="R$" /></TableCell>
                            <TableCell>
                              {form.planoAcao.length > 1 && (
                                <Button size="icon" variant="ghost" onClick={() => removePlano(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-2">
                  <CardTitle className="text-lg">Conclusão</CardTitle>
                  <Textarea value={form.conclusao} onChange={(e) => updateField("conclusao", e.target.value)} placeholder="Conclusão final do mapeamento" rows={4} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t">
            <Button variant="outline" onClick={goPrev} disabled={tabIndex === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              {tabIndex + 1} de {TABS.length}
            </span>
            {tabIndex === TABS.length - 1 ? (
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" /> Salvar
              </Button>
            ) : (
              <Button onClick={goNext}>
                Próximo <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessoFormulario;
