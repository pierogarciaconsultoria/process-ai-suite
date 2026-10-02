import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { moderarEntrada } from "@/lib/peter-moderation";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, Check, Cloud, Loader2, Paperclip, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAiConfig } from "@/hooks/useAiConfig";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import {
  buildProcessInsertPayload,
  buildProcessUpdatePayload,
  mapProcessRowToForm,
  normalizeSavedStatus,
  type ProcessoStatus,
} from "@/lib/processos";
import {
  type ProcessoFormData,
  type Classificacao,
  type EntradaForm,
  type SaidaForm,
  type EtapaForm,
  type RiscoForm,
  type IndicadorForm,
  type PlanoAcao5W2H,
  emptyProcessoForm,
} from "@/data/processo-form-types";
import {
  clampEtapa,
  criarMensagemMetadados,
  normalizarResposta,
  restaurarMetadados,
  type ChatMessage,
  type InterviewResponse,
  type InterviewStage,
  type ModoEntrada,
  type ArquivoProcessado,
  EXTENSOES_ACEITAS,
  LIMITE_TEXTO_CHARS,
  validarArquivo,
  validarLote,
} from "../../supabase/functions/_shared/peter-interview-contract";
import {
  calcularTransicao,
  combinarModo,
  extrairCamposPorEtapa,
  interpretarSelecaoModo,
} from "@/lib/peter-interview-state";
import {
  labelVisualArquivos,
  montarContentParaThread,
  processarArquivo,
} from "@/lib/peter-upload";

class InterviewPageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Erro ao carregar a entrevista:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-6 animate-fade-in">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">
                Ocorreu um erro ao carregar a entrevista. Atualize a página e tente novamente.
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

function isInvalidProcessName(value: string): boolean {
  return !value.trim() || /^(oi|olá|ola|bom dia|boa tarde|boa noite)$/i.test(value.trim());
}

function getOnboardingPrompt(stage: InterviewStage, data: ProcessoFormData): string | null {
  if (stage === "askUserName") return "Antes de continuarmos, como você gostaria que eu te chamasse?";
  if (stage === "askProcessName") return "Para continuar, informe o nome do processo que será mapeado. Por exemplo: Compras, Faturamento ou Atendimento ao Cliente.";
  if (stage === "askArea") return `Qual é a área responsável pelo processo "${data.nomeProcesso}"?`;
  if (stage === "askProcessOwner") return `Quem é o dono ou responsável principal pelo processo na área de ${data.area}?`;
  return null;
}

function getInterviewCompletionIssues(data: ProcessoFormData): string[] {
  const issues: string[] = [];
  if (isInvalidProcessName(data.nomeProcesso)) issues.push("nome do processo");
  if (!data.gatilho.trim()) issues.push("gatilho de início");
  if (!data.saidas.some((item) => item.saida.trim())) issues.push("saída principal");

  const mappedSteps = data.etapas.filter((item) => item.atividade.trim());
  if (mappedSteps.length === 0) {
    issues.push("atividade do processo");
  } else if (mappedSteps.some((item) => !item.responsavel.trim())) {
    issues.push("responsável das atividades");
  }

  return issues;
}

function EntrevistaProcessoPage() {
  const ASSISTANT_MIN_DELAY_MS = 2000;
  const ASSISTANT_MAX_DELAY_MS = 3000;
  const FRIENDLY_CONNECTION_ERROR = "Ops, tive um problema de conexão. Pode tentar novamente?";
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeProcessId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const processState = location.state as { processId?: string; formPrefill?: ProcessoFormData; guidedExperience?: boolean } | null;
  const guidedExperience = processState?.guidedExperience === true || searchParams.get("guided") === "1";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [form, setForm] = useState<ProcessoFormData>(emptyProcessoForm);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [requestApply, setRequestApply] = useState(false);
  const isApplyCommand = (text: string) => /(^|\s)(sim|aplicar|aplique|apply|yes)(\s|$)/i.test(text);
  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2) + Date.now().toString());
  const processIdRef = useRef<string | null>(routeProcessId ?? processState?.processId ?? null);
  const processStatusRef = useRef<ProcessoStatus>("Rascunho");
  const assistantQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isMountedRef = useRef(true);
  const [stage, setStage] = useState<InterviewStage>("selectMode");
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [modoEntrada, setModoEntrada] = useState<ModoEntrada>("nenhum");
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);
  const [conteudoPendente, setConteudoPendente] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [arquivosAnexados, setArquivosAnexados] = useState<ArquivoProcessado[]>([]);
  const [statusUpload, setStatusUpload] = useState<"idle" | "validando" | "lendo" | "processando" | "erro">("idle");
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("");
  const routeScriptConfig = useAiConfig("route_script");
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [hasInitializedConversation, setHasInitializedConversation] = useState(false);
  const [isRestoringDraft, setIsRestoringDraft] = useState(Boolean(routeProcessId ?? processState?.processId));
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const saveSequenceRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSavedSignatureRef = useRef("");
  const allowNavigationRef = useRef(false);

  const completionIssues = useMemo(() => getInterviewCompletionIssues(form), [form]);
  const canConcludeInterview = completionIssues.length === 0;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreDraft = async () => {
      try {
        if (processState?.formPrefill) {
          setForm(processState.formPrefill);
          setParticipantName(processState.formPrefill.entrevistados?.trim() || "");
        }
        const processId = routeProcessId ?? processState?.processId;
        if (!processId) return;
        setIsRestoringDraft(true);
        const { data, error } = await supabase.from("processos").select("*").eq("id", processId).single();
        if (error || !data) throw error || new Error("Rascunho não encontrado.");
        if (cancelled) return;
        const row = data as Tables<"processos">;
        const restoredForm = mapProcessRowToForm(row);
        const restoredMessages = Array.isArray(row.interview_messages)
          ? row.interview_messages as unknown as ChatMessage[]
          : [];
        const metadata = restaurarMetadados(restoredMessages);
        const visibleMessages = restoredMessages.filter((message) => message.role !== "system");
        processIdRef.current = row.id;
        processStatusRef.current = normalizeSavedStatus(row.status, "Rascunho");
        sessionIdRef.current = row.interview_session_id || sessionIdRef.current;
        setForm(restoredForm);
        setMessages(visibleMessages);
        setParticipantName(restoredForm.entrevistados?.trim() || "");
        if (restoredMessages.length > 0) {
          if (metadata) {
            const restoredStage: InterviewStage = metadata.stage === "selectMode"
              ? "selectMode"
              : !restoredForm.entrevistados.trim()
                ? "askUserName"
                : isInvalidProcessName(restoredForm.nomeProcesso)
                  ? "askProcessName"
                  : !restoredForm.area.trim()
                    ? "askArea"
                    : !restoredForm.donoProcesso.trim()
                      ? "askProcessOwner"
                      : (["awaitContent", "aiFlow"].includes(metadata.stage) ? metadata.stage : "aiFlow");
            setStage(restoredStage);
            if (restoredStage !== metadata.stage) {
              const recoveryPrompt = getOnboardingPrompt(restoredStage, restoredForm);
              if (recoveryPrompt) setMessages([...visibleMessages, { role: "assistant", content: recoveryPrompt }]);
            }
            setEtapaAtual(metadata.etapa_atual);
            setModoEntrada(metadata.modo_entrada);
            setAguardandoConfirmacao(metadata.aguardando_confirmacao);
          } else if (!restoredForm.entrevistados.trim()) setStage("askUserName");
          else if (isInvalidProcessName(restoredForm.nomeProcesso)) setStage("askProcessName");
          else if (!restoredForm.area.trim()) setStage("askArea");
          else if (!restoredForm.donoProcesso.trim()) setStage("askProcessOwner");
          else setStage("aiFlow");
          setHasInitializedConversation(true);
        }
        lastSavedSignatureRef.current = JSON.stringify({ form: restoredForm, messages: visibleMessages });
        setSaveStatus("saved");
      } catch (error) {
        console.error("Erro ao restaurar entrevista:", error);
        if (!cancelled) setInitializationError("Não foi possível retomar este rascunho.");
      } finally {
        if (!cancelled) setIsRestoringDraft(false);
      }
    };
    void restoreDraft();
    return () => { cancelled = true; };
  }, [processState?.formPrefill, processState?.processId, routeProcessId]);

  const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  const getAssistantDelay = () =>
    Math.floor(Math.random() * (ASSISTANT_MAX_DELAY_MS - ASSISTANT_MIN_DELAY_MS + 1)) + ASSISTANT_MIN_DELAY_MS;
  const enqueueAssistantMessage = useCallback((content: string, delayMs?: number) => {
    const ms = delayMs ?? getAssistantDelay();
    assistantQueueRef.current = assistantQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!isMountedRef.current) return;
        setIsAssistantTyping(true);
        await wait(ms);
        if (!isMountedRef.current) return;
        setMessages((m) => [...m, { role: "assistant", content }]);
        setIsAssistantTyping(false);
      });
    return assistantQueueRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initializeConversation = async () => {
      try {
        if (cancelled || isRestoringDraft || routeScriptConfig.isLoading || hasInitializedConversation) {
          return;
        }

        if (!routeScriptConfig.companyId) {
          return;
        }

        const greeting =
          "Oi, eu sou o Peter. Vou conduzir esta conversa com você para mapear o processo com clareza, leveza e sem complicação.";
        const reassurance =
          "Pode ficar à vontade para responder no seu ritmo. Meu papel aqui é entender bem o contexto, organizar as informações e transformar tudo em um mapeamento claro e útil para você.";
        const askUserName = "Como você prefere começar: entrevista guiada, colar um texto livre ou anexar um arquivo?";

        setHasInitializedConversation(true);
        setMessages([{ role: "assistant", content: greeting }]);
        await enqueueAssistantMessage(reassurance);
        await enqueueAssistantMessage(askUserName);
      } catch (error) {
        console.error("Erro ao inicializar a entrevista:", error);
        if (!cancelled) {
          setInitializationError("Não foi possível inicializar a entrevista.");
        }
      }
    };

    void initializeConversation();

    return () => {
      cancelled = true;
    };
  }, [enqueueAssistantMessage, hasInitializedConversation, isRestoringDraft, routeScriptConfig.companyId, routeScriptConfig.isLoading]);
  const persistProcessDraft = useCallback(async (
    snapshotForm: ProcessoFormData,
    snapshotMessages: ChatMessage[],
    status: ProcessoStatus = "Rascunho",
  ) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;
    const empresaId = routeScriptConfig.companyId ?? await resolveAccessibleCompanyId(userId);

    if (!userId || !empresaId) return null;

    if (processIdRef.current) {
      const payload = buildProcessUpdatePayload({
        form: snapshotForm,
        userId,
        status: normalizeSavedStatus(processStatusRef.current, status),
        interviewMessages: snapshotMessages,
        interviewSessionId: sessionIdRef.current,
      });

      const { data, error } = await supabase
        .from("processos")
        .update(payload)
        .eq("id", processIdRef.current)
        .eq("company_id", empresaId)
        .select("*")
        .single();

      if (error) throw error;
      const row = data as Tables<"processos">;
      processIdRef.current = row.id;
      processStatusRef.current = normalizeSavedStatus(row.status, status);
      return row;
    }

    const payload = buildProcessInsertPayload({
      form: snapshotForm,
      companyId: empresaId,
      userId,
      status,
      interviewMessages: snapshotMessages,
      interviewSessionId: sessionIdRef.current,
    });

    const { data, error } = await supabase.from("processos").insert(payload).select("*").single();
    if (error) throw error;

    const row = data as Tables<"processos">;
    processIdRef.current = row.id;
    processStatusRef.current = normalizeSavedStatus(row.status, status);
    return row;
  }, [routeScriptConfig.companyId]);

  const withInterviewMetadata = useCallback((snapshotMessages: ChatMessage[]) => [
    ...snapshotMessages.filter((message) => !message._eh_metadado),
    criarMensagemMetadados({
      _tipo: "metadados_peter_v5",
      etapa_atual: clampEtapa(etapaAtual, 1),
      modo_entrada: modoEntrada,
      aguardando_confirmacao: aguardandoConfirmacao,
      stage,
      conteudo_pendente: conteudoPendente ?? "",
      atualizado_em: new Date().toISOString(),
    }),
  ], [aguardandoConfirmacao, conteudoPendente, etapaAtual, modoEntrada, stage]);

  useEffect(() => {
    if (isRestoringDraft || !hasInitializedConversation || !routeScriptConfig.companyId) return;
    if (!messages.some((message) => message.role === "user")) return;
    const signature = JSON.stringify({ form, messages });
    if (signature === lastSavedSignatureRef.current) return;

    const sequence = ++saveSequenceRef.current;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      const snapshotForm = form;
      const snapshotMessages = withInterviewMetadata(messages);
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const row = await persistProcessDraft(snapshotForm, snapshotMessages, "Rascunho");
          if (!row) throw new Error("Usuário ou empresa não identificados para o salvamento automático.");
          lastSavedSignatureRef.current = signature;
          if (!routeProcessId) {
            navigate(`/processos/${row.id}/entrevista${guidedExperience ? "?guided=1" : ""}`, {
              replace: true,
              state: { guidedExperience },
            });
          }
          if (sequence === saveSequenceRef.current) setSaveStatus("saved");
        })
        .catch((error) => {
          console.error("Falha no salvamento automático da entrevista:", error);
          if (sequence === saveSequenceRef.current) setSaveStatus("error");
        });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [form, guidedExperience, hasInitializedConversation, isRestoringDraft, messages, navigate, persistProcessDraft, routeProcessId, routeScriptConfig.companyId, withInterviewMetadata]);

  useEffect(() => {
    const hasUnsyncedChanges = saveStatus !== "saved" || input.trim().length > 0;
    if (!hasUnsyncedChanges) return;
    const message = "Há respostas que ainda não foram sincronizadas. Deseja sair mesmo assim?";
    const protectedUrl = window.location.href;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    const captureLink = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target || allowNavigationRef.current) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handlePopState = () => {
      if (allowNavigationRef.current || window.confirm(message)) return;
      window.history.pushState(null, "", protectedUrl);
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", captureLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", captureLink, true);
    };
  }, [input, saveStatus]);

  const confirmNavigation = () => {
    if (saveStatus === "saved" && !input.trim()) return true;
    return window.confirm("Há respostas que ainda não foram sincronizadas. Deseja sair mesmo assim?");
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAssistantTyping]);

  const assistantBusy = loading || isAssistantTyping;

  const isInitializingPage = isRestoringDraft || (routeScriptConfig.isLoading && !hasInitializedConversation);
  const shouldBlockForCompany = !isInitializingPage && !routeScriptConfig.companyId;

  useEffect(() => {
    if (!assistantBusy) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [assistantBusy]);

  const inferClassification = (source: Partial<ProcessoFormData>): Classificacao => {
    const text = [
      source.nomeProcesso,
      source.area,
      source.objetivo,
      source.clienteProcesso,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .toLowerCase();

    if (/(governan|compliance|auditor|estrateg|estrat[ée]g|planej|diretoria|gest[aã]o|indicador|controladoria)/i.test(text)) {
      return "Gestão";
    }

    if (/(rh|recursos humanos|financeir|compras|jur[ií]dic|ti|tecnologia|infra|suprimentos|faturamento|backoffice|administrativ)/i.test(text)) {
      return "Apoio";
    }

    return "Negócio";
  };

  const mergeFormUpdate = (base: ProcessoFormData, partial?: Partial<ProcessoFormData>) => {
    const merged = { ...base, ...(partial ?? {}) };
    if (participantName.trim()) {
      merged.entrevistados = participantName.trim();
    }
    merged.classificacao = partial?.classificacao ?? inferClassification(merged);
    return merged;
  };

  const hasMeaningfulArrayData = (key: keyof ProcessoFormData, arr: unknown[]) => {
    switch (key) {
      case "entradas":
        return (arr as EntradaForm[]).some((e) => e.fornecedor.trim() || e.entrada.trim());
      case "etapas":
        return (arr as EtapaForm[]).some((e) => e.atividade.trim() || e.responsavel.trim() || (e.ferramentaDocumento ?? "").trim());
      case "saidas":
        return (arr as SaidaForm[]).some((s) => s.saida.trim() || s.cliente.trim());
      case "riscos":
        return (arr as RiscoForm[]).some((r) => r.risco.trim() || r.consequencia.trim());
      case "indicadores":
        return (arr as IndicadorForm[]).some((i) => i.nome.trim() || i.meta.trim() || i.objetivo.trim() || i.formulaCalculo.trim());
      case "planoAcao":
        return (arr as PlanoAcao5W2H[]).some((p) => p.oque.trim() || p.porque.trim() || p.quem.trim() || p.quando.trim() || p.onde.trim() || p.como.trim() || p.custo.trim());
      default:
        return arr.length > 0;
    }
  };

  const suggestsNoExistingItem = (text: string) =>
    /(não temos|nao temos|não tem|nao tem|não existe|nao existe|não há|nao ha|nenhum|nenhuma|não usamos|nao usamos|não acompanhamos|nao acompanhamos|sem isso|ainda não|ainda nao)/i.test(text);

  const suggestRisks = (currentForm: ProcessoFormData): RiscoForm[] => {
    const context = [currentForm.objetivo, currentForm.recursos, currentForm.decisoes, currentForm.gatilho]
      .join(" ")
      .toLowerCase();

    const risks: RiscoForm[] = [
      {
        risco: "Atraso na execução das etapas do processo",
        consequencia: "Comprometimento de prazo, acúmulo de demanda e impacto na entrega final",
        probabilidade: 3,
        impacto: 4,
        _hipotese: true,
      },
      {
        risco: "Retrabalho por falha ou ausência de informação",
        consequencia: "Correções recorrentes, perda de produtividade e aumento do tempo total do processo",
        probabilidade: 3,
        impacto: 4,
        _hipotese: true,
      },
    ];

    if (/(planilha|excel|manual|e-mail|email|whatsapp)/i.test(context)) {
      risks.push({
        risco: "Dependência de controles manuais e registros dispersos",
        consequencia: "Erros de atualização, perda de rastreabilidade e falhas no acompanhamento",
        probabilidade: 4,
        impacto: 4,
        _hipotese: true,
      });
    } else {
      risks.push({
        risco: "Dependência de pessoas-chave para executar ou destravar o fluxo",
        consequencia: "Paradas no processo, baixa previsibilidade e risco operacional",
        probabilidade: 3,
        impacto: 4,
        _hipotese: true,
      });
    }

    return risks;
  };

  const suggestIndicators = (currentForm: ProcessoFormData): IndicadorForm[] => [
    {
      nome: `Tempo total do processo ${currentForm.nomeProcesso ? `- ${currentForm.nomeProcesso}` : ""}`.trim(),
      objetivo: "Reduzir o tempo médio do processo",
      formulaCalculo: "Soma do tempo total dos casos concluídos / quantidade de casos concluídos",
      meta: "Reduzir o tempo médio de execução",
      periodicidade: "Mensal",
      responsavel: currentForm.donoProcesso || currentForm.area || "Responsável pelo processo",
      _hipotese: true,
    },
    {
      nome: "Cumprimento de prazo",
      objetivo: "Aumentar a previsibilidade das entregas",
      formulaCalculo: "(Quantidade de entregas no prazo / quantidade total de entregas) x 100",
      meta: "Manter pelo menos 95% das entregas dentro do prazo",
      periodicidade: "Mensal",
      responsavel: currentForm.donoProcesso || currentForm.area || "Responsável pelo processo",
      _hipotese: true,
    },
    {
      nome: "Taxa de retrabalho",
      objetivo: "Reduzir correções e reincidências",
      formulaCalculo: "(Quantidade de casos com retrabalho / quantidade total de casos) x 100",
      meta: "Reduzir reincidências e correções ao mínimo necessário",
      periodicidade: "Mensal",
      responsavel: currentForm.donoProcesso || currentForm.area || "Responsável pelo processo",
      _hipotese: true,
    },
  ];

  const suggestPlanActions = (currentForm: ProcessoFormData): PlanoAcao5W2H[] => [
    {
      oque: `Padronizar o fluxo do processo${currentForm.nomeProcesso ? ` ${currentForm.nomeProcesso}` : ""}`.trim(),
      porque: "Reduzir variações, retrabalho e dúvidas operacionais",
      quem: currentForm.donoProcesso || currentForm.area || "Responsável pelo processo",
      quando: "Curto prazo",
      onde: currentForm.area || "Área responsável",
      como: "Documentar etapas, responsáveis, critérios e pontos de controle",
      custo: "Baixo",
      _hipotese: true,
    },
    {
      oque: "Implantar rotina de acompanhamento com indicadores",
      porque: "Dar visibilidade ao desempenho e apoiar decisões de melhoria",
      quem: currentForm.donoProcesso || currentForm.area || "Responsável pelo processo",
      quando: "Curto prazo",
      onde: currentForm.area || "Área responsável",
      como: "Definir indicadores, frequência de análise e responsável pelo monitoramento",
      custo: "Baixo",
      _hipotese: true,
    },
  ];

  const requestInterview = async (
    userContent: string,
    currentForm: ProcessoFormData,
    historyBefore: ChatMessage[],
    contentAlreadyInHistory = false,
  ) => {
    const userMsg: ChatMessage = { role: "user", content: userContent };
    const requestHistory = contentAlreadyInHistory
      ? historyBefore.filter((message) => !message._eh_metadado)
      : [...historyBefore.filter((message) => !message._eh_metadado), userMsg];
    // Moderação client-side
    if (!contentAlreadyInHistory) {
      const _mod = moderarEntrada(userContent);
      if (_mod.blocked) {
        setMessages((prev) => [...prev, { role: "assistant" as const, content: _mod.reason ?? "Por favor, use linguagem profissional." }]);
        setLoading(false);
        return;
      }
    }
    setMessages(requestHistory);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-interview", {
        body: {
          history: requestHistory,
          current: currentForm,
          etapa_atual: etapaAtual,
          modo_entrada: modoEntrada,
          aguardando_confirmacao: aguardandoConfirmacao,
          company_id: routeScriptConfig.companyId,
          process_id: processIdRef.current,
        },
      });
      const hasErrorField = (value: unknown): value is { error: string } =>
        typeof value === "object" && value !== null && "error" in value;
      if (error || hasErrorField(data)) {
        handleInterviewRequestError(historyBefore, userContent);
        return;
      }
      const response = normalizarResposta(data, etapaAtual, aguardandoConfirmacao);
      if (response.isValid === false) {
        if (response.alerta) setAlertas((items) => [...items, response.alerta!]);
        await enqueueAssistantMessage(
          response.nextQuestion || "Não consegui validar essa resposta. Pode reformulá-la com um pouco mais de detalhe?",
        );
        return;
      }
      const nextForm = response.partialUpdate
        ? mergeFormUpdate(currentForm, response.partialUpdate as Partial<ProcessoFormData>)
        : currentForm;
      setForm(nextForm);
      if (response.alerta) setAlertas((items) => [...items, response.alerta!]);
      if (response.oportunidade) setAlertas((items) => [...items, response.oportunidade!]);
      const transition = calcularTransicao(response, etapaAtual, aguardandoConfirmacao);
      setEtapaAtual(clampEtapa(response.etapa_atual, etapaAtual));
      setAguardandoConfirmacao(transition.deveAguardar);
      if (transition.podeConcluir) {
        await concludeInterview(nextForm);
      } else if (response.nextQuestion) {
        await enqueueAssistantMessage(response.nextQuestion);
      } else {
        await handleFallback(userContent, "Resposta incompleta da IA");
      }
    } catch {
      handleInterviewRequestError(historyBefore, userContent);
    } finally {
      setLoading(false);
    }
  };

  const selectMode = async (rawSelection: string) => {
    const selection = interpretarSelecaoModo(rawSelection);
    if (!selection) {
      await enqueueAssistantMessage("Escolha entrevista guiada, texto livre ou anexo para continuarmos.");
      return;
    }
    setModoEntrada(selection.modo);
    if (selection.conteudo) setConteudoPendente(selection.conteudo);
    setInput("");
    setStage("askUserName");
    await enqueueAssistantMessage("Antes de começarmos, como você gostaria que eu te chamasse?");
  };

  const continueAfterProcessOwner = async (nextForm: ProcessoFormData, history: ChatMessage[]) => {
    if (conteudoPendente) {
      const pending = conteudoPendente;
      const pendingHistory = [...history, { role: "user", content: pending } satisfies ChatMessage];
      setMessages(pendingHistory);
      setConteudoPendente(null);
      setStage("aiFlow");
      await requestInterview(pending, nextForm, pendingHistory, true);
    } else if (modoEntrada === "entrevista") {
      setStage("aiFlow");
      await enqueueAssistantMessage(
        `${participantName ? `${participantName}, ` : ""}qual é o objetivo principal do processo "${nextForm.nomeProcesso}" e qual resultado ele deve entregar?`,
      );
    } else {
      setStage("awaitContent");
      await enqueueAssistantMessage(
        modoEntrada === "anexo"
          ? "Perfeito. Anexe o arquivo do processo para eu analisá-lo."
          : "Perfeito. Cole agora a descrição do processo em um único texto.",
      );
      if (modoEntrada === "anexo") inputArquivoRef.current?.click();
    }
  };

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (stage === "selectMode") {
      await selectMode(trimmed);
      return;
    }

    if (stage === "askUserName") {
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setParticipantName(trimmed);
      setForm((prev) => mergeFormUpdate(prev, { entrevistados: trimmed }));
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setStage("askProcessName");
      await enqueueAssistantMessage(`Prazer, ${trimmed}. Obrigado por estar aqui comigo. Qual é o processo que vamos mapear juntos hoje?`);
      return;
    }

    if (stage === "askProcessName") {
      if (isInvalidProcessName(trimmed)) {
        setInput("");
        await enqueueAssistantMessage("Preciso do nome do processo que será mapeado. Por exemplo: Compras, Faturamento ou Atendimento ao Cliente.");
        return;
      }
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const nextForm = mergeFormUpdate(form, { nomeProcesso: trimmed });
      const historyAfterName = [...messages, userMsg];
      setForm(nextForm);
      setMessages(historyAfterName);
      setInput("");
      setStage("askArea");
      await enqueueAssistantMessage(`Qual é a área responsável pelo processo "${trimmed}"?`);
      return;
    }

    if (stage === "askArea") {
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const nextForm = mergeFormUpdate(form, { area: trimmed });
      setForm(nextForm);
      setMessages((current) => [...current, userMsg]);
      setInput("");
      setStage("askProcessOwner");
      await enqueueAssistantMessage(`Quem é o dono ou responsável principal pelo processo na área de ${trimmed}?`);
      return;
    }

    if (stage === "askProcessOwner") {
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const nextForm = mergeFormUpdate(form, {
        donoProcesso: trimmed,
        classificacao: inferClassification({ ...form, donoProcesso: trimmed }),
      });
      const historyAfterOwner = [...messages, userMsg];
      setForm(nextForm);
      setMessages(historyAfterOwner);
      setInput("");
      await continueAfterProcessOwner(nextForm, historyAfterOwner);
      return;
    }

    if (stage === "awaitContent") {
      setInput("");
      setStage("aiFlow");
      setModoEntrada((current) => combinarModo(current, "texto_livre"));
      await requestInterview(trimmed, form, messages);
      return;
    }

    if (requestApply && isApplyCommand(input.trim())) {
      setRequestApply(false);
      void concludeInterview();
      return;
    }
    setInput("");
    await requestInterview(trimmed, form, messages);
  };

  const handleFallback = async (lastAnswer: string, detail: string) => {
    const fallback = computeFallback(form, lastAnswer);
    if (fallback.partialUpdate) {
      setForm((prev) => mergeFormUpdate(prev, fallback.partialUpdate));
    }
    if (fallback.done) {
      const completedForm = fallback.partialUpdate ? mergeFormUpdate(form, fallback.partialUpdate) : form;
      concludeInterview(completedForm);
      return;
    }
    await enqueueAssistantMessage(
      `Ocorreu um erro técnico (${detail}). Vou continuar a entrevista de forma local.\n\n${fallback.nextQuestion ?? "Entrevista concluída. Deseja aplicar no formulário?"}`,
    );
  };

  const handleInterviewRequestError = (
    previousMessages: ChatMessage[],
    previousInput: string,
  ) => {
    setMessages([
      ...previousMessages,
      { role: "assistant", content: FRIENDLY_CONNECTION_ERROR },
    ]);
    setInput(previousInput);
    setIsAssistantTyping(false);
  };

  const computeFallback = (currentForm: ProcessoFormData, answer: string): InterviewResponse => {
    const parsedUpdate = extrairCamposPorEtapa(answer, etapaAtual, currentForm);
    if (Object.keys(parsedUpdate).length > 0) {
      const nextQuestions: Record<number, string> = {
        1: "Há mais algum participante, área envolvida ou detalhe do objetivo que devemos registrar nesta etapa?",
        2: "Quais são as entradas, saídas e o evento que inicia o processo?",
        3: "Descreva as atividades, responsáveis, decisões, sistemas e documentos usados.",
        4: "Quais indicadores, metas e frequências de acompanhamento existem hoje?",
        5: "Quais problemas, causas, impactos e riscos aparecem no processo atual?",
        6: "Quais oportunidades e ações de melhoria devem ser priorizadas?",
      };
      return {
        raciocinio: "Fallback local por etapa",
        avaliacao_comportamento: "Resposta recebida",
        avaliacao_conteudo: "Conteúdo parcialmente estruturado",
        isValid: true,
        partialUpdate: parsedUpdate,
        nextQuestion: nextQuestions[etapaAtual] ?? nextQuestions[6],
        done: false,
        etapa_atual: etapaAtual,
        etapa_confirmada: false,
        avancar_etapa: false,
        alerta: null,
        oportunidade: null,
      };
    }
    const isFilled = (key: keyof ProcessoFormData) => {
      const value = currentForm[key] as unknown;
      if (Array.isArray(value)) return hasMeaningfulArrayData(key, value);
      if (typeof value === "string") return value.trim().length > 0;
      return !!value;
    };
    const nextText = (key: keyof ProcessoFormData) => {
      const map: Partial<Record<keyof ProcessoFormData, string>> = {
        nomeProcesso: "Qual é o nome do processo?",
        area: "Qual é a área responsável pelo processo?",
        donoProcesso: "Quem é o dono do processo?",
        objetivo: "Qual é o objetivo principal do processo?",
        clienteProcesso: "Só para eu fechar esse ponto com precisão: quem recebe o resultado final desse processo? Pode ser uma área interna, um cliente externo ou outro time.",
        areasEnvolvidas: "Quais áreas estão envolvidas?",
        gatilho: "Só para eu confirmar: o que dá início a esse processo na prática? O processo começa quando acontece qual evento, solicitação ou necessidade?",
        entradas: "Quais são as principais entradas que esse processo recebe para começar ou seguir adiante? Se fizer sentido, me diga também de quem ou de onde essas entradas vêm.",
        saidas: "E no final, quais são as principais saídas ou entregas geradas por esse processo? Quem recebe essas entregas?",
        etapas: "Liste atividades e responsáveis (uma por linha: Atividade - Responsável).",
        decisoes: "Existe algum ponto em que alguém precisa aprovar, reprovar, validar ou escolher um caminho dentro do processo? Se sim, em que momento isso acontece?",
        recursos: "Só para eu não deixar lacuna: quais recursos, sistemas e documentos são necessários para esse processo funcionar bem? Pode incluir pessoas, planilhas, equipamentos ou acessos.",
        problemasTexto: "Quais são as principais dores, rupturas ou problemas operacionais que acontecem nesse processo no dia a dia?",
        oportunidadesMelhoria: "Quais melhorias, automações ou otimizações fariam mais sentido para esse processo?",
        indicadores: "Hoje vocês acompanham algum indicador desse processo, como prazo, volume, retrabalho, SLA, qualidade ou produtividade?",
        planoAcao: "Existe hoje algum plano de ação, melhoria priorizada ou iniciativa em andamento para esse processo?",
      };
      return map[key] ?? "Deseja finalizar e aplicar ao formulário?";
    };
    const parseList = (txt: string) => txt.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    const parsePairs = (txt: string) => parseList(txt).map(line => {
      const [a, b] = line.split(/[-–—;:]/).map(s => s.trim());
      return [a ?? line, b ?? ""];
    });
    if (!isFilled("nomeProcesso")) {
      return { partialUpdate: { nomeProcesso: answer }, nextQuestion: nextText("area"), done: false };
    }
    if (!isFilled("area")) {
      return { partialUpdate: { area: answer }, nextQuestion: nextText("donoProcesso"), done: false };
    }
    if (!isFilled("donoProcesso")) {
      return { partialUpdate: { donoProcesso: answer, classificacao: inferClassification({ ...currentForm, donoProcesso: answer }) }, nextQuestion: nextText("objetivo"), done: false };
    }
    if (!isFilled("objetivo")) {
      return { partialUpdate: { objetivo: answer }, nextQuestion: nextText("clienteProcesso"), done: false };
    }
    if (!isFilled("clienteProcesso")) {
      return { partialUpdate: { clienteProcesso: answer }, nextQuestion: nextText("areasEnvolvidas"), done: false };
    }
    if (!isFilled("areasEnvolvidas")) {
      return { partialUpdate: { areasEnvolvidas: answer }, nextQuestion: nextText("gatilho"), done: false };
    }
    if (!isFilled("gatilho")) {
      return { partialUpdate: { gatilho: answer }, nextQuestion: nextText("entradas"), done: false };
    }
    if (!isFilled("entradas")) {
      const entradas: EntradaForm[] = parsePairs(answer).map(([fornecedor, entrada]) => ({ fornecedor, entrada }));
      return { partialUpdate: { entradas: entradas.length ? entradas : [{ fornecedor: answer, entrada: "" }] }, nextQuestion: nextText("saidas"), done: false };
    }
    if (!isFilled("saidas")) {
      const saidas: SaidaForm[] = parsePairs(answer).map(([saida, cliente]) => ({ saida, cliente }));
      return { partialUpdate: { saidas: saidas.length ? saidas : [{ saida: answer, cliente: "" }] }, nextQuestion: nextText("etapas"), done: false };
    }
    if (!isFilled("etapas")) {
      const etapas: EtapaForm[] = parsePairs(answer).map(([atividade, responsavel], idx) => ({
        ordem: idx + 1,
        atividade,
        responsavel,
        ferramentaDocumento: "",
      }));
      return { partialUpdate: { etapas: etapas.length ? etapas : [{ ordem: 1, atividade: answer, responsavel: "", ferramentaDocumento: "" }] }, nextQuestion: nextText("decisoes"), done: false };
    }
    if (!isFilled("decisoes")) {
      return { partialUpdate: { decisoes: answer }, nextQuestion: nextText("recursos"), done: false };
    }
    if (!isFilled("recursos")) {
      return {
        partialUpdate: {
          recursos: parseList(answer).join("\n"),
        },
        nextQuestion: nextText("problemasTexto"),
        done: false,
      };
    }
    if (!isFilled("problemasTexto")) {
      return {
        partialUpdate: { problemasTexto: answer },
        nextQuestion: hasMeaningfulArrayData("riscos", currentForm.riscos) ? nextText("oportunidadesMelhoria") : "Com base no que você me explicou, já consigo sugerir alguns riscos prováveis desse processo. Depois disso, quero te ouvir sobre quais melhorias, automações ou otimizações fariam mais sentido.",
        done: false,
      };
    }
    if (!isFilled("riscos")) {
      return {
        partialUpdate: { riscos: suggestRisks(currentForm) },
        nextQuestion: nextText("oportunidadesMelhoria"),
        done: false,
      };
    }
    if (!isFilled("oportunidadesMelhoria")) {
      return {
        partialUpdate: { oportunidadesMelhoria: answer },
        nextQuestion: nextText("indicadores"),
        done: false,
      };
    }
    if (!isFilled("indicadores")) {
      if (suggestsNoExistingItem(answer)) {
        return {
          partialUpdate: { indicadores: suggestIndicators(currentForm) },
          nextQuestion: "Sem problema. Se ainda não existir um plano de ação definido, eu posso sugerir algumas ações iniciais com base no que você me explicou. Hoje existe algum plano de ação, melhoria priorizada ou iniciativa em andamento para esse processo?",
          done: false,
        };
      }
      const indicadores: IndicadorForm[] = parsePairs(answer).map(([nome, meta]) => ({
        nome,
        objetivo: "Acompanhar o desempenho do processo",
        formulaCalculo: "",
        meta,
        periodicidade: "",
        responsavel: currentForm.donoProcesso || "",
      }));
      return { partialUpdate: { indicadores: indicadores.length ? indicadores : [{ nome: answer, objetivo: "Acompanhar o desempenho do processo", formulaCalculo: "", meta: "", periodicidade: "", responsavel: currentForm.donoProcesso || "" }] }, nextQuestion: nextText("planoAcao"), done: false };
    }
    if (!isFilled("planoAcao")) {
      if (suggestsNoExistingItem(answer)) {
        return {
          partialUpdate: { planoAcao: suggestPlanActions(currentForm) },
          done: true,
        };
      }
      const linhas = answer.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const planoAcao: PlanoAcao5W2H[] = linhas.map(line => {
        const parts = line.split(";").map(s => s.trim());
        const [oque, porque, quem, quando, onde, como, custo] = parts;
        return { oque: oque ?? answer, porque: porque ?? "", quem: quem ?? "", quando: quando ?? "", onde: onde ?? "", como: como ?? "", custo: custo ?? "" };
      });
      return { partialUpdate: { planoAcao: planoAcao.length ? planoAcao : [{ oque: answer, porque: "", quem: "", quando: "", onde: "", como: "", custo: "" }] }, done: true };
    }
    return { done: true };
  };
  const concludeInterview = async (completedForm: ProcessoFormData = form) => {
    const issues = getInterviewCompletionIssues(completedForm);
    if (issues.length > 0) {
      await enqueueAssistantMessage(
        `Antes de concluir, ainda precisamos registrar: ${issues.join(", ")}. Vamos completar essas informações pela conversa.`,
      );
      return;
    }

    setLoading(true);
    try {
      const row = await persistProcessDraft(completedForm, withInterviewMetadata(messages), "Em revisão");
      if (!row) throw new Error("Não foi possível identificar usuário e empresa para salvar o processo.");
      localStorage.setItem("process:lastInterviewSessionId", sessionIdRef.current);
      allowNavigationRef.current = true;
      navigate(`/processos/${row.id}/resultado-guiado`, {
        state: { processo: completedForm, autoGenerate: true },
      });
    } catch (error) {
      console.error("Erro ao concluir entrevista:", error);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Não consegui salvar o processo com segurança. Revise sua conexão e tente concluir novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Tesseract removido: imagens só serão habilitadas após teste real no Assistant.
  // Quando habilitadas, seguem como image_url para preservar fluxogramas, setas e formas.
  const enviarArquivosParaPeter = async (
    arquivos: ArquivoProcessado[],
    modoAtual: ModoEntrada,
    historySnapshot: ChatMessage[],
  ) => {
    const { data, error } = await supabase.functions.invoke("ai-interview", {
      body: {
        history: historySnapshot,
        arquivo_content: montarContentParaThread(arquivos, etapaAtual),
        current: form,
        etapa_atual: etapaAtual,
        modo_entrada: modoAtual,
        aguardando_confirmacao: aguardandoConfirmacao,
        company_id: routeScriptConfig.companyId,
        process_id: processIdRef.current,
      },
    });
    const hasErrorField = (value: unknown): value is { error: string } =>
      typeof value === "object" && value !== null && "error" in value;
    if (error || hasErrorField(data)) throw error || new Error(data.error);

    const response = normalizarResposta(data, etapaAtual, aguardandoConfirmacao);
    if (response.isValid === false) {
      if (response.alerta) setAlertas((items) => [...items, response.alerta!]);
      setStage("aiFlow");
      await enqueueAssistantMessage(
        response.nextQuestion || "Não consegui validar as informações do arquivo. Envie outro arquivo ou detalhe o ponto no chat.",
      );
      return;
    }
    const nextForm = response.partialUpdate
      ? mergeFormUpdate(form, response.partialUpdate as Partial<ProcessoFormData>)
      : form;
    setForm(nextForm);
    if (response.alerta) setAlertas((items) => [...items, response.alerta!]);
    if (response.oportunidade) setAlertas((items) => [...items, response.oportunidade!]);
    const transition = calcularTransicao(response, etapaAtual, aguardandoConfirmacao);
    setEtapaAtual(clampEtapa(response.etapa_atual, etapaAtual));
    setAguardandoConfirmacao(transition.deveAguardar);
    setStage("aiFlow");
    if (transition.podeConcluir) await concludeInterview(nextForm);
    else if (response.nextQuestion) await enqueueAssistantMessage(response.nextQuestion);
  };

  const handleUploadArquivos = async (files: FileList | File[]) => {
    const list = Array.from(files);
    setErroUpload(null);
    setStatusUpload("validando");

    for (const file of list) {
      const validation = validarArquivo(file);
      if (!validation.valido) {
        setStatusUpload("erro");
        setErroUpload(validation.erro || "Arquivo inválido.");
        return;
      }
    }
    const batchValidation = validarLote(list);
    if (!batchValidation.valido) {
      setStatusUpload("erro");
      setErroUpload(batchValidation.erro || "Lote inválido.");
      return;
    }

    setStatusUpload("lendo");
    const processed: ArquivoProcessado[] = [];
    const warnings: ChatMessage[] = [];
    try {
      for (const file of list) {
        const result = await processarArquivo(file);
        processed.push(result.arquivo);
        if (result.avisoTruncamento) {
          warnings.push({
            role: "assistant",
            content: `⚠️ "${file.name}" foi truncado em ${LIMITE_TEXTO_CHARS.toLocaleString()} caracteres. Descreva no chat as partes mais relevantes que ficaram de fora.`,
          });
        }
      }
    } catch (error) {
      setStatusUpload("erro");
      setErroUpload(error instanceof Error ? error.message : "Não foi possível processar os arquivos.");
      return;
    }

    const newMode = combinarModo(modoEntrada, "anexo");
    const labelMessage: ChatMessage = { role: "user", content: labelVisualArquivos(processed) };
    const historySnapshot = [
      ...messages.filter((message) => !message._eh_metadado),
      ...warnings,
      labelMessage,
    ];
    setModoEntrada(newMode);
    setMessages(historySnapshot);
    setStatusUpload("processando");
    setLoading(true);
    try {
      await enviarArquivosParaPeter(processed, newMode, historySnapshot);
      setArquivosAnexados((current) => [...current, ...processed]);
      setStatusUpload("idle");
    } catch (error) {
      console.error("Falha ao analisar arquivos:", error);
      setStatusUpload("erro");
      setErroUpload("Não foi possível analisar os arquivos. Tente novamente.");
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Não consegui analisar o arquivo enviado. Verifique sua conexão e tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (initializationError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{initializationError}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isInitializingPage) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Carregando entrevista...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (shouldBlockForCompany) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              Selecione uma empresa antes de iniciar a entrevista
            </div>
            {routeScriptConfig.error ? (
              <div className="mt-2 text-xs text-muted-foreground">
                A configuracao de IA nao foi carregada e os valores padrao serao usados quando a empresa for selecionada.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden animate-fade-in">
      <nav className="flex h-8 shrink-0 items-center gap-2 text-sm" aria-label="Navegação estrutural">
        <button
          type="button"
          className="text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            if (!confirmNavigation()) return;
            allowNavigationRef.current = true;
            navigate("/processos");
          }}
        >
          Processos
        </button>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-foreground" aria-current="page">Entrevista</span>
      </nav>

      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entrevista com IA</h1>
          <p className="text-muted-foreground">Condução guiada para mapear seu processo sem preenchimento manual.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={saveStatus === "error" ? "destructive" : "secondary"}
            className="flex items-center gap-2"
            aria-live="polite"
          >
            {saveStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : saveStatus === "error" ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {saveStatus === "saving" ? "Salvando…" : saveStatus === "error" ? "Falha ao salvar" : "Salvo"}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" /> Etapa {etapaAtual} de 6
          </Badge>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Chat</CardTitle>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!confirmNavigation()) return;
                  allowNavigationRef.current = true;
                  navigate("/processos");
                }}
              >
                Cancelar
              </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pb-4">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md border p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`p-3 rounded-md ${m.role === "assistant" ? "bg-muted" : "bg-card border"}`}>
                <div className="text-xs text-muted-foreground mb-1">{m.role === "assistant" ? "Peter" : "Você"}</div>
                <div className="text-sm whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            {isAssistantTyping && (
              <div className="p-3 rounded-md bg-muted">
                <div className="text-xs text-muted-foreground mb-1">Peter</div>
                <div className="text-sm text-muted-foreground">Peter está digitando...</div>
              </div>
            )}
          </div>

          <div className="shrink-0">
          {stage === "selectMode" && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <Button className="shrink-0" variant="outline" onClick={() => void selectMode("entrevista")}>Entrevista guiada</Button>
              <Button className="shrink-0" variant="outline" onClick={() => void selectMode("texto")}>Colar texto</Button>
              <Button className="shrink-0" variant="outline" onClick={() => void selectMode("anexo")}>Anexar arquivo</Button>
            </div>
          )}

          {alertas.map((alerta, index) => (
            <div key={`${alerta}-${index}`} className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {alerta}
            </div>
          ))}

          <div className="mt-3 flex gap-2">
            <Input
              ref={inputArquivoRef}
              type="file"
              accept={EXTENSOES_ACEITAS}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleUploadArquivos(e.target.files);
                e.currentTarget.value = "";
              }}
              disabled={assistantBusy}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => inputArquivoRef.current?.click()}
              disabled={assistantBusy || stage === "selectMode" || stage === "askUserName" || stage === "askProcessName" || stage === "askArea" || stage === "askProcessOwner"}
              aria-label="Anexar arquivo"
              title="Anexar arquivo"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              ref={inputRef}
              placeholder="Digite sua resposta…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={assistantBusy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !assistantBusy) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} disabled={assistantBusy}>
              <span>{assistantBusy ? "Aguarde..." : "Enviar"}</span>
              <Send className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {(statusUpload !== "idle" || arquivosAnexados.length > 0) && (
          <div className="mt-2 space-y-2">
            {statusUpload !== "idle" && (
              <div className={`text-sm ${statusUpload === "erro" ? "text-destructive" : "text-muted-foreground"}`} role="status">
                {statusUpload === "erro" && `⚠️ ${erroUpload}`}
                {statusUpload === "validando" && "Verificando arquivos..."}
                {statusUpload === "lendo" && "Lendo arquivos..."}
                {statusUpload === "processando" && "Peter está analisando..."}
              </div>
            )}
            {arquivosAnexados.length > 0 && (
              <div className="flex flex-wrap gap-2" role="list" aria-label="Arquivos processados">
                {arquivosAnexados.map((arquivo, index) => (
                  <Badge key={`${arquivo.nome}-${index}`} variant="secondary" role="listitem" className="gap-2 py-1">
                    📎 {arquivo.nome} ({arquivo.tipoLabel}){arquivo.truncado ? " ⚠️" : ""}
                    <button
                      type="button"
                      className="rounded px-1 hover:bg-muted"
                      onClick={() => setArquivosAnexados((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      aria-label={`Ocultar ${arquivo.nome} da lista`}
                      title="Ocultar da lista (o arquivo já foi analisado)"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          )}

          <div className="mt-2 flex min-h-9 items-center justify-between gap-3">
            {!canConcludeInterview ? (
              <p
                className="truncate text-xs text-muted-foreground"
                title={`Para concluir, informe: ${completionIssues.join(", ")}.`}
              >
                Faltam {completionIssues.length} {completionIssues.length === 1 ? "informação" : "informações"} para concluir
              </p>
            ) : <span />}
            <Button size="sm" onClick={() => void concludeInterview()} disabled={assistantBusy || !canConcludeInterview}>
              Concluir entrevista <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EntrevistaProcesso() {
  return (
    <InterviewPageErrorBoundary>
      <EntrevistaProcessoPage />
    </InterviewPageErrorBoundary>
  );
}
