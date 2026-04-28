import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ArrowRight, Save, Plus, Trash2, Sparkles, Loader2,
  ClipboardList, Search, Map, BarChart3, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  type ProcessoFormData,
  type EtapaForm,
  type EntradaForm,
  type SaidaForm,
  type RiscoForm,
  type NivelRisco,
  type IndicadorForm,
  type PlanoAcao5W2H,
  type Classificacao,
  emptyProcessoForm,
} from "@/data/processo-form-types";
import { Badge } from "@/components/ui/badge";
import BPMNCanvas from "@/components/BPMNCanvas";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

// ── Phase / Tab structure ──

interface PhaseConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  tabs: { id: string; label: string }[];
}

const PHASES: PhaseConfig[] = [
  {
    id: "fase1",
    label: "1. Identificação & Contexto",
    icon: Search,
    tabs: [
      { id: "identificacao", label: "Identificação" },
      { id: "contexto", label: "Contexto" },
    ],
  },
  {
    id: "fase2",
    label: "2. Diagnóstico de Dores",
    icon: ClipboardList,
    tabs: [
      { id: "dores", label: "Dores & Gargalos" },
      { id: "riscos", label: "Riscos" },
    ],
  },
  {
    id: "fase3",
    label: "3. Operação Atual (AS IS)",
    icon: Map,
    tabs: [
      { id: "entradas", label: "Entradas & Gatilhos" },
      { id: "atividades", label: "Atividades" },
      { id: "saidas", label: "Saídas & Clientes" },
      { id: "recursos", label: "Recursos" },
      { id: "decisoes", label: "Decisões" },
      { id: "sipoc", label: "SIPOC" },
      { id: "mapa-as-is", label: "Mapa AS IS" },
    ],
  },
  {
    id: "fase4",
    label: "4. Otimização (TO BE)",
    icon: Sparkles,
    tabs: [
      { id: "melhorias", label: "Melhorias" },
      { id: "plano", label: "Plano de Ação" },
      { id: "indicadores", label: "Indicadores" },
      { id: "mapa-to-be", label: "Mapa TO BE" },
    ],
  },
  {
    id: "fase5",
    label: "5. Análise Final",
    icon: BarChart3,
    tabs: [
      { id: "relatorio", label: "Relatório" },
    ],
  },
];

const ALL_TABS = PHASES.flatMap((p) => p.tabs.map((t) => t.id));

function getPhaseForTab(tabId: string): string {
  return PHASES.find((p) => p.tabs.some((t) => t.id === tabId))?.id ?? "fase1";
}

// ── Helpers ──

const getRiscoNivel = (score: number) => {
  if (score <= 4) return { label: "Baixo", color: "bg-green-100 text-green-800" };
  if (score <= 9) return { label: "Médio", color: "bg-yellow-100 text-yellow-800" };
  if (score <= 15) return { label: "Alto", color: "bg-orange-100 text-orange-800" };
  return { label: "Crítico", color: "bg-red-100 text-red-800" };
};

// ── Component ──

const ProcessoFormulario = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState("identificacao");
  const [form, setForm] = useState<ProcessoFormData>(emptyProcessoForm);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [descricaoIA, setDescricaoIA] = useState("");
  const [isFillingAI, setIsFillingAI] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const globalSteps = [
    "Novo processo",
    "Entrevista",
    "Diagnóstico AS IS",
    "Processo TO BE",
    "Relatório",
  ];
  const getCurrentGlobalStep = () => {
    if (["melhorias", "planoAcao", "indicadores", "mapa-to-be"].includes(activeTab)) return 3;
    if (activeTab === "relatorio") return 4;
    if (["identificacao", "contexto", "dores", "riscos", "entradas", "atividades", "saidas", "recursos", "decisoes", "sipoc", "mapa-as-is"].includes(activeTab)) {
      return 2;
    }
    return 2;
  };

  useEffect(() => {
    type PrefillState = { formPrefill?: ProcessoFormData; fromInterview?: boolean; focusTab?: string } | null;
    const state = location.state as PrefillState;
    const pre = state?.formPrefill;

    const resolveInitialTab = () => {
      if (state?.focusTab && ALL_TABS.includes(state.focusTab)) return state.focusTab;
      if (!isEditing && state?.fromInterview) return "contexto";
      return "identificacao";
    };

    if (pre) {
      setForm(pre);
      const initialTab = resolveInitialTab();
      setActiveTab(initialTab);
    } else {
      try {
        const raw = localStorage.getItem("process:formPrefill");
        if (raw) {
          const parsed = JSON.parse(raw) as ProcessoFormData;
          setForm(parsed);
          localStorage.removeItem("process:formPrefill");
          const initialTab = resolveInitialTab();
          setActiveTab(initialTab);
        }
      } catch (e) { void e; }
    }
  }, [location.state, isEditing]);

  useEffect(() => {
    (async () => {
      try {
        const sb = supabase as unknown as { from: (table: string) => { select: (...a: unknown[]) => { order: (...a: unknown[]) => { limit: (n: number) => Promise<{ data?: unknown[] }> } } } };
        const { data } = await sb.from("interview_sessions").select("messages").order("created_at", { ascending: false }).limit(1);
        if (Array.isArray(data)) {
          const rows = data as unknown as { messages: ChatMessage[] }[];
          if (rows[0]?.messages?.length) {
            setChatHistory(rows[0].messages);
            return;
          }
        }
      } catch (e) { void e; }
      try {
        const sid = localStorage.getItem("process:lastInterviewSessionId") || "";
        const sessionsRaw = localStorage.getItem("process:interviewSessions") || "[]";
        const sessions = JSON.parse(sessionsRaw) as Array<{ id: string; messages: ChatMessage[]; at: string }>;
        const found = sessions.find((s) => s.id === sid) || sessions[sessions.length - 1];
        if (found?.messages?.length) setChatHistory(found.messages);
      } catch (e) { void e; }
    })();
  }, []);

  const tabIndex = ALL_TABS.indexOf(activeTab);
  const activePhase = getPhaseForTab(activeTab);

  // ── Field helpers ──
  const updateField = <K extends keyof ProcessoFormData>(key: K, value: ProcessoFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const goNext = () => { if (tabIndex < ALL_TABS.length - 1) setActiveTab(ALL_TABS[tabIndex + 1]); };
  const goPrev = () => { if (tabIndex > 0) setActiveTab(ALL_TABS[tabIndex - 1]); };

  // Dynamic row helpers
  const addEtapa = () => updateField("etapas", [...form.etapas, { ordem: form.etapas.length + 1, atividade: "", responsavel: "", ferramentaDocumento: "", comoHoje: "", nivelMaturidade: 0, nivelDesejado: 1, problemaIdentificado: "", oportunidadeMelhoria: "", tipoSolucao: "Workflow", tecnologiaRecomendada: "", acaoRecomendada: "", gravidade: 1, urgencia: 1, tendencia: 1, nota: 3 }]);
  const removeEtapa = (i: number) => updateField("etapas", form.etapas.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, ordem: idx + 1 })));
  const updateEtapa = <K extends keyof EtapaForm>(i: number, field: K, value: EtapaForm[K]) => {
    const updated = [...form.etapas];
    updated[i] = { ...updated[i], [field]: value };
    updateField("etapas", updated);
  };

  const addEntrada = () => updateField("entradas", [...form.entradas, { fornecedor: "", entrada: "" }]);
  const removeEntrada = (i: number) => updateField("entradas", form.entradas.filter((_, idx) => idx !== i));
  const updateEntrada = (i: number, field: keyof EntradaForm, value: string) => {
    const updated = [...form.entradas]; updated[i] = { ...updated[i], [field]: value }; updateField("entradas", updated);
  };

  const addSaida = () => updateField("saidas", [...form.saidas, { saida: "", cliente: "" }]);
  const removeSaida = (i: number) => updateField("saidas", form.saidas.filter((_, idx) => idx !== i));
  const updateSaida = (i: number, field: keyof SaidaForm, value: string) => {
    const updated = [...form.saidas]; updated[i] = { ...updated[i], [field]: value }; updateField("saidas", updated);
  };

  const addRisco = () => updateField("riscos", [...form.riscos, { risco: "", consequencia: "", probabilidade: 1 as NivelRisco, impacto: 1 as NivelRisco }]);
  const removeRisco = (i: number) => updateField("riscos", form.riscos.filter((_, idx) => idx !== i));
  const updateRisco = (i: number, field: keyof RiscoForm, value: string | number) => {
    const updated = [...form.riscos]; updated[i] = { ...updated[i], [field]: value }; updateField("riscos", updated);
  };

  const addIndicador = () => updateField("indicadores", [...form.indicadores, { indicador: "", meta: "" }]);
  const removeIndicador = (i: number) => updateField("indicadores", form.indicadores.filter((_, idx) => idx !== i));
  const updateIndicador = (i: number, field: keyof IndicadorForm, value: string) => {
    const updated = [...form.indicadores]; updated[i] = { ...updated[i], [field]: value }; updateField("indicadores", updated);
  };

  const addPlano = () => updateField("planoAcao", [...form.planoAcao, { oque: "", porque: "", quem: "", quando: "", onde: "", como: "", custo: "" }]);
  const removePlano = (i: number) => updateField("planoAcao", form.planoAcao.filter((_, idx) => idx !== i));
  const updatePlano = (i: number, field: keyof PlanoAcao5W2H, value: string) => {
    const updated = [...form.planoAcao]; updated[i] = { ...updated[i], [field]: value }; updateField("planoAcao", updated);
  };

  const recursosList = (form.recursos || "").split(/\n|,/).map((s) => s.trim()).filter(Boolean);

  // ── AI Fill ──
  const handleAIFill = async () => {
    if (descricaoIA.trim().length < 10) {
      toast({ title: "Descrição muito curta", description: "Mínimo 10 caracteres.", variant: "destructive" });
      return;
    }
    setIsFillingAI(true);
    try {
      const customScript = localStorage.getItem("process:routeScript");
      const aiSkin = localStorage.getItem("process:aiSkin");
      const { data, error } = await supabase.functions.invoke("ai-fill-process", { 
        body: { 
          descricao: descricaoIA,
          customScript: customScript || null,
          aiSkin: aiSkin ? JSON.parse(aiSkin) : null,
        } 
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm((prev) => ({
        ...prev,
        objetivo: data.objetivo || prev.objetivo,
        porqueExiste: data.porqueExiste || prev.porqueExiste,
        clienteProcesso: data.clienteProcesso || prev.clienteProcesso,
        areasEnvolvidas: data.areasEnvolvidas || prev.areasEnvolvidas,
        gatilho: data.gatilho || prev.gatilho,
        entradas: data.entradas?.length ? data.entradas : prev.entradas,
        etapas: data.etapas?.length ? data.etapas : prev.etapas,
        decisoes: data.decisoes || prev.decisoes,
        saidas: data.saidas?.length ? data.saidas : prev.saidas,
        recursos: data.recursos || prev.recursos,
        problemas: data.problemas || prev.problemas,
        problemasTexto: data.problemasTexto || prev.problemasTexto,
        riscos: data.riscos?.length ? data.riscos : prev.riscos,
        controles: data.controles || prev.controles,
        indicadores: data.indicadores?.length ? data.indicadores : prev.indicadores,
        sugestoes: data.sugestoes || prev.sugestoes,
        automacao: data.automacao || prev.automacao,
        documentacao: data.documentacao || prev.documentacao,
        planoAcao: data.planoAcao?.length ? data.planoAcao : prev.planoAcao,
        conclusao: data.conclusao || prev.conclusao,
      }));
      toast({ title: "Preenchimento concluído!", description: "Revise os dados gerados pela IA." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      console.error("AI fill error:", err);
      toast({ title: "Erro ao preencher com IA", description: message, variant: "destructive" });
    } finally {
      setIsFillingAI(false);
    }
  };

  // ── Diagnose ──
  const handleDiagnose = useCallback(async () => {
    if (isDiagnosing) return;
    setIsDiagnosing(true);
    try {
      const customScript = localStorage.getItem("process:routeScript");
      const aiSkin = localStorage.getItem("process:aiSkin");
      const { data, error } = await supabase.functions.invoke("ai-diagnose-process", { 
        body: { 
          processoData: form,
          customScript: customScript || null,
          aiSkin: aiSkin ? JSON.parse(aiSkin) : null,
        } 
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      navigate("/processos/diagnostico", { state: { diagnostico: data, processo: form } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      console.error("Diagnose error:", err);
      toast({ title: "Erro ao gerar diagnóstico", description: message, variant: "destructive" });
    } finally {
      setIsDiagnosing(false);
    }
  }, [form, navigate, toast]);

  const handleSave = () => {
    toast({ title: "Mapeamento concluido", description: "Escolha o proximo passo para continuar o trabalho com este processo." });
    navigate("/processos/diagnostico", { state: { processo: form } });
  };

  // ── Tab content renderers ──

  const renderContent = () => {
    switch (activeTab) {
      case "identificacao":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => updateField("data", e.target.value)} /></div>
            <div className="space-y-2"><Label>Analista</Label><Input value={form.analista} onChange={(e) => updateField("analista", e.target.value)} placeholder="Nome do analista" /></div>
            <div className="space-y-2"><Label>Empresa</Label><Input value={form.empresa} onChange={(e) => updateField("empresa", e.target.value)} placeholder="Nome da empresa" /></div>
            <div className="space-y-2"><Label>Nome do Processo</Label><Input value={form.nomeProcesso} onChange={(e) => updateField("nomeProcesso", e.target.value)} placeholder="Ex: Gestão de Vendas" /></div>
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
            <div className="space-y-2"><Label>Área</Label><Input value={form.area} onChange={(e) => updateField("area", e.target.value)} placeholder="Área responsável" /></div>
            <div className="space-y-2"><Label>Dono do Processo</Label><Input value={form.donoProcesso} onChange={(e) => updateField("donoProcesso", e.target.value)} placeholder="Responsável principal" /></div>
            <div className="space-y-2"><Label>Entrevistados</Label><Input value={form.entrevistados} onChange={(e) => updateField("entrevistados", e.target.value)} placeholder="Pessoas entrevistadas" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Informações Adicionais</Label><Textarea value={form.infoAdicionais} onChange={(e) => updateField("infoAdicionais", e.target.value)} placeholder="Observações relevantes" /></div>
          </div>
        );

      case "contexto":
        return (
          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Preenchimento com IA</CardTitle></div>
                <p className="text-sm text-muted-foreground">Descreva o processo e a IA preencherá automaticamente todas as seções.</p>
                <Textarea value={descricaoIA} onChange={(e) => setDescricaoIA(e.target.value)} placeholder="Ex: Processo de contratação de novos colaboradores..." rows={5} disabled={isFillingAI} />
                <Button onClick={handleAIFill} disabled={isFillingAI || descricaoIA.trim().length < 10}>
                  {isFillingAI ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preenchendo...</> : <><Sparkles className="h-4 w-4 mr-2" /> Preencher com IA</>}
                </Button>
              </CardContent>
            </Card>
            <CardHeader className="p-0 pb-4"><CardTitle className="text-lg">Contexto do Processo</CardTitle></CardHeader>
            <div className="space-y-2"><Label>Objetivo do Processo</Label><Textarea value={form.objetivo} onChange={(e) => updateField("objetivo", e.target.value)} placeholder="Qual o objetivo?" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Cliente do Processo</Label><Input value={form.clienteProcesso} onChange={(e) => updateField("clienteProcesso", e.target.value)} placeholder="Quem recebe o resultado" /></div>
              <div className="space-y-2"><Label>Áreas Envolvidas</Label><Input value={form.areasEnvolvidas} onChange={(e) => updateField("areasEnvolvidas", e.target.value)} placeholder="Comercial, Financeiro..." /></div>
            </div>
          </div>
        );

      case "dores":
        return (
          <div className="space-y-3">
            <div className="space-y-3">
              <CardTitle className="text-lg">Dores e Problemas</CardTitle>
              <div className="flex flex-wrap gap-4">
                {([["retrabalho", "Retrabalho"], ["atrasos", "Atrasos"], ["erros", "Erros manuais"], ["dependencia", "Dependência de pessoas"], ["faltaPadrao", "Falta de padrão"]] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox checked={form.problemas[key]} onCheckedChange={(checked) => updateField("problemas", { ...form.problemas, [key]: !!checked })} />
                    <Label className="font-normal">{label}</Label>
                  </div>
                ))}
              </div>
              <Textarea value={form.problemasTexto} onChange={(e) => updateField("problemasTexto", e.target.value)} placeholder="Descreva os problemas em detalhes" rows={3} />
            </div>
          </div>
        );

      case "riscos":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Riscos do Processo</CardTitle>
              <Button size="sm" variant="outline" onClick={addRisco}><Plus className="h-4 w-4 mr-1" /> Risco</Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Risco</TableHead><TableHead>Consequência</TableHead>
                <TableHead className="w-40">Probabilidade</TableHead><TableHead className="w-40">Impacto</TableHead>
                <TableHead className="w-28">Grau</TableHead><TableHead className="w-12"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {form.riscos.map((r, i) => {
                  const score = r.probabilidade * r.impacto;
                  const nivel = getRiscoNivel(score);
                  return (
                    <TableRow key={i}>
                      <TableCell><Input value={r.risco} onChange={(e) => updateRisco(i, "risco", e.target.value)} placeholder="Descreva" /></TableCell>
                      <TableCell><Input value={r.consequencia} onChange={(e) => updateRisco(i, "consequencia", e.target.value)} placeholder="Consequência" /></TableCell>
                      <TableCell>
                        <Select value={String(r.probabilidade)} onValueChange={(v) => updateRisco(i, "probabilidade", Number(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={String(r.impacto)} onValueChange={(v) => updateRisco(i, "impacto", Number(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Badge className={nivel.color}>{score} - {nivel.label}</Badge></TableCell>
                      <TableCell>{form.riscos.length > 1 && <Button size="icon" variant="ghost" onClick={() => removeRisco(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );

      case "recursos":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recursos necessários</Label>
              <Textarea
                value={form.recursos}
                onChange={(e) => updateField("recursos", e.target.value)}
                placeholder="Digite um recurso por linha (ex.: ERP, CRM, Máquina X)"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">Um por linha. Ex.: ERP, CRM, Máquina X.</p>
            </div>
            {recursosList.length > 0 && (
              <div className="space-y-2">
                <Label>Lista</Label>
                <ul className="list-disc pl-6">
                  {recursosList.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case "decisoes":
        return (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Decisões do Processo</Label><Textarea value={form.decisoes} onChange={(e) => updateField("decisoes", e.target.value)} placeholder="Aprovações, verificações, análises necessárias" rows={6} /></div>
          </div>
        );

      case "entradas":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Fornecedor e Entradas (SIPOC)</CardTitle>
              <Button size="sm" variant="outline" onClick={addEntrada}><Plus className="h-4 w-4 mr-1" /> Entrada</Button>
            </div>
            <div className="space-y-2"><Label>Gatilho do Processo</Label><Textarea value={form.gatilho} onChange={(e) => updateField("gatilho", e.target.value)} placeholder="O que inicia este processo?" rows={2} /></div>
            <Table>
              <TableHeader><TableRow><TableHead>Fornecedor (Supplier)</TableHead><TableHead>Entrada (Input)</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {form.entradas.map((ent, i) => (
                  <TableRow key={i}>
                    <TableCell><Input value={ent.fornecedor} onChange={(e) => updateEntrada(i, "fornecedor", e.target.value)} placeholder="Quem fornece" /></TableCell>
                    <TableCell><Input value={ent.entrada} onChange={(e) => updateEntrada(i, "entrada", e.target.value)} placeholder="O que entra" /></TableCell>
                    <TableCell>{form.entradas.length > 1 && <Button size="icon" variant="ghost" onClick={() => removeEntrada(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case "atividades":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Descrição das Atividades</CardTitle>
              <Button size="sm" variant="outline" onClick={addEtapa}><Plus className="h-4 w-4 mr-1" /> Etapa</Button>
            </div>
            <Table>
                <TableHeader><TableRow><TableHead className="w-16">#</TableHead><TableHead>Atividade</TableHead><TableHead>Responsável</TableHead><TableHead>Como é executada hoje</TableHead><TableHead>Ferramenta/Doc</TableHead><TableHead>Nível (0–4)</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {form.etapas.map((etapa, i) => (
                    <TableRow key={i}>
                      <TableCell>{etapa.ordem}</TableCell>
                      <TableCell><Input value={etapa.atividade} onChange={(e) => updateEtapa(i, "atividade", e.target.value)} placeholder="Descreva" /></TableCell>
                      <TableCell><Input value={etapa.responsavel} onChange={(e) => updateEtapa(i, "responsavel", e.target.value)} placeholder="Responsável" /></TableCell>
                      <TableCell><Textarea value={etapa.comoHoje ?? ""} onChange={(e) => updateEtapa(i, "comoHoje", e.target.value)} placeholder="Ex.: manual, planilha, verbal..." rows={2} /></TableCell>
                      <TableCell><Input value={etapa.ferramentaDocumento} onChange={(e) => updateEtapa(i, "ferramentaDocumento", e.target.value)} placeholder="Sistema/Doc" /></TableCell>
                      <TableCell>
                        <Select value={String(etapa.nivelMaturidade ?? 0)} onValueChange={(v) => updateEtapa(i, "nivelMaturidade", Number(v) as 0 | 1 | 2 | 3 | 4)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{form.etapas.length > 1 && <Button size="icon" variant="ghost" onClick={() => removeEtapa(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>
        );

      case "saidas":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Saídas e Cliente (SIPOC)</CardTitle>
              <Button size="sm" variant="outline" onClick={addSaida}><Plus className="h-4 w-4 mr-1" /> Saída</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Saída (Output)</TableHead><TableHead>Cliente (Customer)</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {form.saidas.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell><Input value={s.saida} onChange={(e) => updateSaida(i, "saida", e.target.value)} placeholder="O que sai" /></TableCell>
                    <TableCell><Input value={s.cliente} onChange={(e) => updateSaida(i, "cliente", e.target.value)} placeholder="Quem recebe" /></TableCell>
                    <TableCell>{form.saidas.length > 1 && <Button size="icon" variant="ghost" onClick={() => removeSaida(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case "sipoc":
        return (
          <div className="space-y-4">
            <CardTitle className="text-lg">Visão SIPOC Consolidada</CardTitle>
            <p className="text-sm text-muted-foreground">Gerada automaticamente a partir dos dados preenchidos nas abas anteriores.</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-muted/50 font-semibold">Fornecedor (S)</TableHead>
                  <TableHead className="bg-muted/50 font-semibold">Entrada (I)</TableHead>
                  <TableHead className="bg-muted/50 font-semibold">Processo (P)</TableHead>
                  <TableHead className="bg-muted/50 font-semibold">Saída (O)</TableHead>
                  <TableHead className="bg-muted/50 font-semibold">Cliente (C)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const maxRows = Math.max(form.entradas.length, form.saidas.length, form.etapas.length, 1);
                  return Array.from({ length: maxRows }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell>{form.entradas[i]?.fornecedor || "—"}</TableCell>
                      <TableCell>{form.entradas[i]?.entrada || "—"}</TableCell>
                      <TableCell>{form.etapas[i]?.atividade || "—"}</TableCell>
                      <TableCell>{form.saidas[i]?.saida || "—"}</TableCell>
                      <TableCell>{form.saidas[i]?.cliente || "—"}</TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </div>
        );

      case "mapa-as-is":
        return (
          <div className="space-y-4">
            <CardTitle className="text-lg">Mapa AS IS (BPMN)</CardTitle>
            <p className="text-sm text-muted-foreground">Visualize o fluxo atual do processo. Clique em "Gerar Mapa com IA" para criar o diagrama automaticamente.</p>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  if (!file) return;
                  try {
                    const pdfjs = await import("pdfjs-dist");
                    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker as string;
                    const buf = await file.arrayBuffer();
                    const loadingTask = pdfjs.getDocument({ data: buf });
                    const pdf = await loadingTask.promise;
                    let fullText = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                      const page = await pdf.getPage(i);
                      const content = await page.getTextContent();
                      const pageText = content.items
                        .map((it: unknown) => {
                          const rec = it as { str?: unknown };
                          return typeof rec.str === "string" ? rec.str : "";
                        })
                        .filter((s) => s && s.trim().length > 0)
                        .join(" ");
                      fullText += "\n" + pageText;
                    }
                    const lines = fullText
                      .split(/\n|\. |\r/)
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0);
                    const stepCandidates = lines.filter((s) =>
                      /^[0-9]+\s*[).\-\u2013]|^[•\-\u2013]\s+|^\w.{20,}$/.test(s)
                    );
                    const uniqueSteps: string[] = [];
                    for (const s of stepCandidates) {
                      const cleaned = s.replace(/^[0-9]+\s*[).\-\u2013]\s*/, "").replace(/^[•\-\u2013]\s+/, "").trim();
                      if (cleaned.length < 4) continue;
                      if (!uniqueSteps.some((u) => u.toLowerCase() === cleaned.toLowerCase())) {
                        uniqueSteps.push(cleaned);
                      }
                    }
                    const etapasFromPdf = uniqueSteps.slice(0, 40).map((txt, idx) => ({
                      ordem: idx + 1,
                      atividade: txt,
                      responsavel: "",
                      ferramentaDocumento: "",
                    }));
                    if (etapasFromPdf.length > 0) {
                      updateField("etapas", etapasFromPdf);
                      toast({ title: "PDF importado", description: `Etapas extraídas: ${etapasFromPdf.length}. Gerando o mapa automaticamente...` });
                      try {
                        const { data, error } = await supabase.functions.invoke("ai-generate-bpmn", {
                          body: {
                            etapas: etapasFromPdf,
                            decisoes: form.decisoes,
                            gatilho: form.gatilho,
                            entradas: form.entradas,
                            saidas: form.saidas,
                            nomeProcesso: form.nomeProcesso,
                            mode: "as-is",
                          },
                        });
                        if (error) throw error;
                        if ((data as unknown as { error?: string })?.error) throw new Error((data as { error: string }).error);
                        const generatedXml = (data as unknown as { xml?: string }).xml || data;
                        updateField("bpmnAsIs", generatedXml as string);
                        toast({ title: "Mapa AS-IS gerado", description: "O diagrama foi atualizado com base no PDF." });
                      } catch (genErr) {
                        const msg = genErr instanceof Error ? genErr.message : String(genErr);
                        toast({ title: "Falha ao gerar BPMN", description: msg, variant: "destructive" });
                      }
                    } else {
                      toast({
                        title: "Nenhuma etapa encontrada",
                        description: "Não foi possível identificar etapas no PDF. Edite manualmente ou tente outro arquivo.",
                        variant: "destructive",
                      });
                    }
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast({ title: "Falha ao importar PDF", description: msg, variant: "destructive" });
                  } finally {
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
            <BPMNCanvas
              xml={form.bpmnAsIs}
              onChange={(xml) => updateField("bpmnAsIs", xml)}
              formData={form}
              mode="as-is"
            />
          </div>
        );

      case "melhorias":
        return (
          <div className="space-y-6">
            <div className="space-y-2"><CardTitle className="text-lg">Sugestões de Melhoria</CardTitle><Textarea value={form.sugestoes} onChange={(e) => updateField("sugestoes", e.target.value)} placeholder="O que mudaria?" rows={3} /></div>
            <div className="space-y-2"><CardTitle className="text-lg">Oportunidade de Automação</CardTitle><Textarea value={form.automacao} onChange={(e) => updateField("automacao", e.target.value)} placeholder="Atividades automatizáveis?" rows={3} /></div>
          </div>
        );

      case "plano":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between"><CardTitle className="text-lg">Plano de Ação (5W2H)</CardTitle><Button size="sm" variant="outline" onClick={addPlano}><Plus className="h-4 w-4 mr-1" /> Ação</Button></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>O quê</TableHead><TableHead>Por quê</TableHead><TableHead>Quem</TableHead><TableHead>Quando</TableHead><TableHead>Onde</TableHead><TableHead>Como</TableHead><TableHead>Custo</TableHead><TableHead className="w-12"></TableHead>
                </TableRow></TableHeader>
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
                      <TableCell>{form.planoAcao.length > 1 && <Button size="icon" variant="ghost" onClick={() => removePlano(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2"><CardTitle className="text-lg">Conclusão</CardTitle><Textarea value={form.conclusao} onChange={(e) => updateField("conclusao", e.target.value)} placeholder="Conclusão final do mapeamento" rows={4} /></div>
          </div>
        );

      case "mapa-to-be":
        return (
          <div className="space-y-4">
            <CardTitle className="text-lg">Mapa TO BE (BPMN)</CardTitle>
            <p className="text-sm text-muted-foreground">Gere o fluxo futuro otimizado com base nas melhorias e automações sugeridas.</p>
            <BPMNCanvas
              xml={form.bpmnToBe}
              onChange={(xml) => updateField("bpmnToBe", xml)}
              formData={form}
              mode="to-be"
            />
          </div>
        );

      case "indicadores":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Indicadores</CardTitle>
              <Button size="sm" variant="outline" onClick={addIndicador}><Plus className="h-4 w-4 mr-1" /> Indicador</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Indicador</TableHead><TableHead>Meta</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {form.indicadores.map((ind, i) => (
                  <TableRow key={i}>
                    <TableCell><Input value={ind.indicador} onChange={(e) => updateIndicador(i, "indicador", e.target.value)} placeholder="Nome do indicador" /></TableCell>
                    <TableCell><Input value={ind.meta} onChange={(e) => updateIndicador(i, "meta", e.target.value)} placeholder="Meta" /></TableCell>
                    <TableCell>{form.indicadores.length > 1 && <Button size="icon" variant="ghost" onClick={() => removeIndicador(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case "relatorio": {
        return (
          <div className="space-y-6">
            <CardTitle className="text-lg">Relatório de Diagnóstico por IA</CardTitle>
            <p className="text-sm text-muted-foreground">
              Conclua o mapeamento para seguir para a tela de proximas acoes, ou gere o diagnostico agora se ja quiser partir para a analise.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleSave}>
                Concluir mapeamento
              </Button>
              <Button variant="outline" onClick={handleDiagnose} disabled={isDiagnosing}>
                {isDiagnosing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando diagnostico...
                  </>
                ) : (
                  "Gerar diagnostico agora"
                )}
              </Button>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // ── Render ──

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {globalSteps.map((step, index) => {
              const current = getCurrentGlobalStep();
              const isActive = index === current;
              const isDone = index < current;
              return (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isDone
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="font-semibold">{index + 1}</span>
                    <span>{step}</span>
                  </div>
                  {index < globalSteps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isEditing ? "Editar Processo" : "Novo Mapeamento de Processo"}</h1>
          <p className="text-muted-foreground">Preencha todas as seções do formulário de mapeamento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/processos")}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
          <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
        </div>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 shrink-0">
          <Card className="sticky top-6">
            <CardContent className="p-3">
              {/* Progress */}
              <div className="mb-4 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso</span>
                  <span>{tabIndex + 1} / {ALL_TABS.length}</span>
                </div>
                <Progress value={((tabIndex + 1) / ALL_TABS.length) * 100} className="h-2" />
              </div>

              <Accordion type="multiple" defaultValue={PHASES.map(p => p.id)} className="space-y-1">
                {PHASES.map((phase) => (
                  <AccordionItem key={phase.id} value={phase.id} className="border-none">
                    <AccordionTrigger className={`py-2 px-2 rounded-md text-sm font-semibold hover:no-underline ${activePhase === phase.id ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                      <div className="flex items-center gap-2">
                        <phase.icon className="h-4 w-4 shrink-0" />
                        <span className="text-left text-xs leading-tight">{phase.label}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-1 pt-0">
                      <div className="ml-2 space-y-0.5">
                        {phase.tabs.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5 ${
                              activeTab === tab.id
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="pt-6">
              {chatHistory.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="chat-history">
                    <AccordionTrigger>Histórico da Entrevista</AccordionTrigger>
                    <AccordionContent>
                      <div className="h-[280px] overflow-auto rounded-md border p-3 space-y-3">
                        {chatHistory.map((m, i) => (
                          <div key={i} className={`p-3 rounded-md ${m.role === "assistant" ? "bg-muted" : "bg-card border"}`}>
                            <div className="text-xs text-muted-foreground mb-1">{m.role === "assistant" ? "IA" : m.role === "user" ? "Você" : "Sistema"}</div>
                            <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              {renderContent()}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-4 border-t">
                <Button variant="outline" onClick={goPrev} disabled={tabIndex === 0}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {tabIndex + 1} de {ALL_TABS.length}
                </span>
                <Button onClick={goNext} disabled={tabIndex === ALL_TABS.length - 1}>
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProcessoFormulario;
