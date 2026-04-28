import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Send, ArrowRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
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

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type InterviewResponse = {
  nextQuestion?: string;
  partialUpdate?: Partial<ProcessoFormData>;
  done?: boolean;
};
type InterviewStage = "askUserName" | "askProcessName" | "askDescription" | "aiFlow";

export default function EntrevistaProcesso() {
  const ASSISTANT_MIN_DELAY_MS = 2000;
  const ASSISTANT_MAX_DELAY_MS = 3000;
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [form, setForm] = useState<ProcessoFormData>(emptyProcessoForm);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [requestApply, setRequestApply] = useState(false);
  const isApplyCommand = (text: string) => /(^|\s)(sim|aplicar|aplique|apply|yes)(\s|$)/i.test(text);
  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2) + Date.now().toString());
  const assistantQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isMountedRef = useRef(true);
  const [stage, setStage] = useState<InterviewStage>("askUserName");
  const [participantName, setParticipantName] = useState("");

  const steps = [
    "Novo processo",
    "Entrevista",
    "Diagnóstico AS IS",
    "Processo TO BE",
    "Relatório",
  ];
  const currentStep = 1;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  const getAssistantDelay = () =>
    Math.floor(Math.random() * (ASSISTANT_MAX_DELAY_MS - ASSISTANT_MIN_DELAY_MS + 1)) + ASSISTANT_MIN_DELAY_MS;
  const enqueueAssistantMessage = (content: string, delayMs = getAssistantDelay()) => {
    assistantQueueRef.current = assistantQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!isMountedRef.current) return;
        setIsAssistantTyping(true);
        await wait(delayMs);
        if (!isMountedRef.current) return;
        setMessages((m) => [...m, { role: "assistant", content }]);
        setIsAssistantTyping(false);
      });
    return assistantQueueRef.current;
  };

  useEffect(() => {
    const greeting =
      "Oi, eu sou o Peter. Vou conduzir esta conversa com você para mapear o processo com clareza, leveza e sem complicação.";
    const reassurance =
      "Pode ficar à vontade para responder no seu ritmo. Meu papel aqui é entender bem o contexto, organizar as informações e transformar tudo em um mapeamento claro e útil para você.";
    const askUserName =
      "Antes de começarmos, como você gostaria que eu te chamasse?";
    setMessages([{ role: "assistant", content: greeting }]);
    void (async () => {
      await enqueueAssistantMessage(reassurance);
      await enqueueAssistantMessage(askUserName);
    })();
  }, []);
  const saveSession = (reason: "auto" | "manual") => {
    try {
      const key = "process:interviewSessions";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      const item = { id: sessionIdRef.current, reason, at: new Date().toISOString(), messages, form, progress };
      const next = Array.isArray(prev) ? [...prev, item] : [item];
      localStorage.setItem(key, JSON.stringify(next));
    } catch (e) { void e; }
    persistSession(reason);
  };
  const persistSession = async (reason: "auto" | "manual") => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;
      let empresaId: string | null = null;
      const { data: membros } = await supabase.from("membros").select("empresa_id").limit(1);
      const memRows = membros as { empresa_id: string }[] | null;
      if (Array.isArray(memRows) && memRows.length > 0) {
        empresaId = memRows[0].empresa_id ?? null;
      }
      const row = {
        user_id: userId,
        empresa_id: empresaId,
        reason,
        messages: messages as unknown as Json,
        form_snapshot: form as unknown as Json,
        progress,
        applied: reason === "manual",
      } as unknown;
      const sb = supabase as unknown as { from: (table: string) => { insert: (values: unknown) => Promise<unknown> } };
      await sb.from("interview_sessions").insert(row);
    } catch (e) { void e; }
  };

  const progress = useMemo(() => {
    const keys: (keyof ProcessoFormData)[] = [
      "nomeProcesso",
      "area",
      "donoProcesso",
      "classificacao",
      "entrevistados",
      "objetivo",
      "porqueExiste",
      "clienteProcesso",
      "areasEnvolvidas",
      "gatilho",
      "entradas",
      "etapas",
      "decisoes",
      "saidas",
      "recursos",
      "documentacao",
      "problemasTexto",
      "controles",
      "riscos",
      "indicadores",
      "planoAcao",
    ];
    const arrayHasData = (key: keyof ProcessoFormData, arr: unknown[]): boolean => {
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
          return (arr as IndicadorForm[]).some((i) => i.indicador.trim() || i.meta.trim());
        case "planoAcao":
          return (arr as PlanoAcao5W2H[]).some((p) => p.oque.trim() || p.porque.trim() || p.quem.trim() || p.quando.trim() || p.onde.trim() || p.como.trim() || p.custo.trim());
        default:
          return arr.length > 0;
      }
    };
    const isFilled = (key: keyof ProcessoFormData) => {
      const value = form[key] as unknown;
      if (Array.isArray(value)) return arrayHasData(key, value);
      if (typeof value === "string") return value.trim().length > 0;
      return !!value;
    };
    const total = keys.length;
    const done = keys.reduce((acc, k) => acc + (isFilled(k) ? 1 : 0), 0);
    return Math.round((done / total) * 100);
  }, [form]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAssistantTyping]);

  const assistantBusy = loading || isAssistantTyping;

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
      source.porqueExiste,
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
        return (arr as IndicadorForm[]).some((i) => i.indicador.trim() || i.meta.trim());
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
      },
      {
        risco: "Retrabalho por falha ou ausência de informação",
        consequencia: "Correções recorrentes, perda de produtividade e aumento do tempo total do processo",
        probabilidade: 3,
        impacto: 4,
      },
    ];

    if (/(planilha|excel|manual|e-mail|email|whatsapp)/i.test(context)) {
      risks.push({
        risco: "Dependência de controles manuais e registros dispersos",
        consequencia: "Erros de atualização, perda de rastreabilidade e falhas no acompanhamento",
        probabilidade: 4,
        impacto: 4,
      });
    } else {
      risks.push({
        risco: "Dependência de pessoas-chave para executar ou destravar o fluxo",
        consequencia: "Paradas no processo, baixa previsibilidade e risco operacional",
        probabilidade: 3,
        impacto: 4,
      });
    }

    return risks;
  };

  const suggestIndicators = (currentForm: ProcessoFormData): IndicadorForm[] => [
    { indicador: `Tempo total do processo ${currentForm.nomeProcesso ? `- ${currentForm.nomeProcesso}` : ""}`.trim(), meta: "Reduzir o tempo médio de execução" },
    { indicador: "Cumprimento de prazo", meta: "Manter pelo menos 95% das entregas dentro do prazo" },
    { indicador: "Taxa de retrabalho", meta: "Reduzir reincidências e correções ao mínimo necessário" },
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
    },
    {
      oque: "Implantar rotina de acompanhamento com indicadores",
      porque: "Dar visibilidade ao desempenho e apoiar decisões de melhoria",
      quem: currentForm.donoProcesso || currentForm.area || "Responsável pelo processo",
      quando: "Curto prazo",
      onde: currentForm.area || "Área responsável",
      como: "Definir indicadores, frequência de análise e responsável pelo monitoramento",
      custo: "Baixo",
    },
  ];

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

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
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setForm((prev) => mergeFormUpdate(prev, { nomeProcesso: trimmed }));
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setStage("askDescription");
      await enqueueAssistantMessage(
        `${participantName ? `${participantName}, ` : ""}perfeito. Vamos trabalhar então o processo "${trimmed}". ` +
          "Agora me conte, em um único texto, como esse processo acontece hoje na prática. Se puder, inclua as etapas, quem faz o quê, quais sistemas, ferramentas e documentos são usados, quais dores ou problemas operacionais aparecem no dia a dia, se existem regras de negócio importantes e se há exceções ou variações no caminho. Pode escrever do seu jeito. Depois eu leio com atenção e faço apenas as perguntas que realmente faltarem, combinado?",
      );
      return;
    }

    if (stage === "askDescription") {
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setStage("aiFlow");
      setLoading(true);
      try {
        const customScript = localStorage.getItem("process:routeScript");
        const aiSkin = localStorage.getItem("process:aiSkin");
        const { data, error } = await supabase.functions.invoke("ai-interview", {
          body: {
            history: [...messages, userMsg],
            current: form,
            customScript: customScript || null,
            aiSkin: aiSkin ? JSON.parse(aiSkin) : null,
          },
        });
        const hasErrorField = (d: unknown): d is { error: string } =>
          typeof d === "object" && d !== null && "error" in d;
        if (error || hasErrorField(data)) {
          const detail = error instanceof Error ? error.message : hasErrorField(data) ? data.error : "Falha desconhecida";
          await handleFallback(userMsg.content, detail);
          return;
        }
        const resp = data as InterviewResponse;
        if (resp.partialUpdate) {
          setForm((prev) => mergeFormUpdate(prev, resp.partialUpdate));
        }
        if (resp.done) {
          applyToForm("manual");
        } else if (resp.nextQuestion) {
          await enqueueAssistantMessage(resp.nextQuestion);
        } else {
          await handleFallback(userMsg.content, "Resposta incompleta da IA");
        }
      } catch (e) {
        const detail = e instanceof Error ? e.message : "Erro desconhecido";
        await handleFallback(userMsg.content, detail);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (requestApply && isApplyCommand(input.trim())) {
      setRequestApply(false);
      applyToForm("manual");
      return;
    }
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const customScript = localStorage.getItem("process:routeScript");
      const aiSkin = localStorage.getItem("process:aiSkin");
      const { data, error } = await supabase.functions.invoke("ai-interview", {
        body: {
          history: [...messages, userMsg],
          current: form,
          customScript: customScript || null,
          aiSkin: aiSkin ? JSON.parse(aiSkin) : null,
        },
      });
      const hasErrorField = (d: unknown): d is { error: string } =>
        typeof d === "object" && d !== null && "error" in d;
      if (error || hasErrorField(data)) {
        const detail = error instanceof Error ? error.message : hasErrorField(data) ? data.error : "Falha desconhecida";
        await handleFallback(userMsg.content, detail);
        return;
      }
      const resp = data as InterviewResponse;
      if (resp.partialUpdate) {
        setForm((prev) => mergeFormUpdate(prev, resp.partialUpdate));
      }
      if (resp.done) {
        applyToForm("manual");
      } else if (resp.nextQuestion) {
        await enqueueAssistantMessage(resp.nextQuestion);
      } else {
        await handleFallback(userMsg.content, "Resposta incompleta da IA");
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Erro desconhecido";
      await handleFallback(userMsg.content, detail);
    } finally {
      setLoading(false);
    }
  };

  const handleFallback = async (lastAnswer: string, detail: string) => {
    const fallback = computeFallback(form, lastAnswer);
    if (fallback.partialUpdate) {
      setForm((prev) => mergeFormUpdate(prev, fallback.partialUpdate));
    }
    if (fallback.done) {
      applyToForm("auto");
      return;
    }
    await enqueueAssistantMessage(
      `Ocorreu um erro técnico (${detail}). Vou continuar a entrevista de forma local.\n\n${fallback.nextQuestion ?? "Entrevista concluída. Deseja aplicar no formulário?"}`,
    );
  };

  const computeFallback = (currentForm: ProcessoFormData, answer: string): InterviewResponse => {
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
        porqueExiste: "Por que este processo existe?",
        clienteProcesso: "Só para eu fechar esse ponto com precisão: quem recebe o resultado final desse processo? Pode ser uma área interna, um cliente externo ou outro time.",
        areasEnvolvidas: "Quais áreas estão envolvidas?",
        gatilho: "Só para eu confirmar: o que dá início a esse processo na prática? O processo começa quando acontece qual evento, solicitação ou necessidade?",
        entradas: "Quais são as principais entradas que esse processo recebe para começar ou seguir adiante? Se fizer sentido, me diga também de quem ou de onde essas entradas vêm.",
        saidas: "E no final, quais são as principais saídas ou entregas geradas por esse processo? Quem recebe essas entregas?",
        etapas: "Liste atividades e responsáveis (uma por linha: Atividade - Responsável).",
        decisoes: "Existe algum ponto em que alguém precisa aprovar, reprovar, validar ou escolher um caminho dentro do processo? Se sim, em que momento isso acontece?",
        recursos: "Só para eu não deixar lacuna: quais recursos são necessários para esse processo funcionar bem? Pode incluir pessoas, sistemas, planilhas, documentos, equipamentos ou acessos.",
        documentacao: "Quais documentos são necessários ou usados ao longo desse processo? Pode incluir POP, instrução de trabalho, formulários, planilhas, políticas, checklists ou modelos.",
        problemasTexto: "Quais são as principais dores, rupturas ou problemas operacionais que acontecem nesse processo no dia a dia?",
        controles: "Há alguma regra de negócio aplicada nesse processo? Se sim, qual? Pode ser critério de aprovação, prazo, limite, validação obrigatória ou alguma condição específica.",
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
      return { partialUpdate: { objetivo: answer }, nextQuestion: nextText("porqueExiste"), done: false };
    }
    if (!isFilled("porqueExiste")) {
      return { partialUpdate: { porqueExiste: answer }, nextQuestion: nextText("clienteProcesso"), done: false };
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
        nextQuestion: nextText("documentacao"),
        done: false,
      };
    }
    if (!isFilled("documentacao")) {
      return {
        partialUpdate: { documentacao: answer },
        nextQuestion: nextText("problemasTexto"),
        done: false,
      };
    }
    if (!isFilled("problemasTexto")) {
      return {
        partialUpdate: { problemasTexto: answer },
        nextQuestion: nextText("controles"),
        done: false,
      };
    }
    if (!isFilled("controles")) {
      return {
        partialUpdate: { controles: answer },
        nextQuestion: hasMeaningfulArrayData("riscos", currentForm.riscos) ? nextText("indicadores") : "Com base no que você me explicou, já consigo sugerir alguns riscos prováveis desse processo. Depois disso, quero só confirmar se vocês acompanham algum indicador, como prazo, volume, retrabalho, SLA, qualidade ou produtividade.",
        done: false,
      };
    }
    if (!isFilled("riscos")) {
      return {
        partialUpdate: { riscos: suggestRisks(currentForm) },
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
      const indicadores: IndicadorForm[] = parsePairs(answer).map(([indicador, meta]) => ({ indicador, meta }));
      return { partialUpdate: { indicadores: indicadores.length ? indicadores : [{ indicador: answer, meta: "" }] }, nextQuestion: nextText("planoAcao"), done: false };
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
  const applyToForm = (reason: "auto" | "manual" = "manual") => {
    try {
      localStorage.setItem("process:formPrefill", JSON.stringify(form));
      saveSession(reason);
      localStorage.setItem("process:lastInterviewSessionId", sessionIdRef.current);
    } catch (e) { void e; }
    navigate("/processos/diagnostico", { state: {} });
  };

  const extractFromPdf = async (file: File): Promise<string> => {
    const mod = await import("pdfjs-dist");
    mod.GlobalWorkerOptions.workerSrc = pdfjsWorker as string;
    const buf = await file.arrayBuffer();
    const loadingTask = mod.getDocument({ data: buf });
    const pdf = await loadingTask.promise;
    let full = "";
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
      full += "\n" + pageText;
    }
    return full.trim();
  };

  const extractFromDocx = async (file: File): Promise<string> => {
    const mammoth = await import("mammoth/mammoth.browser");
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    return String(res.value || "").trim();
  };

  const extractFromImage = async (file: File): Promise<string> => {
    const Tesseract = await import("tesseract.js");
    const result = await Tesseract.recognize(file, "por+eng");
    return String(result.data?.text || "").trim();
  };

  const analyzeFile = async (file: File) => {
    setLoading(true);
    try {
      let text = "";
      const name = file.name.toLowerCase();
      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        text = await extractFromPdf(file);
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) {
        text = await extractFromDocx(file);
      } else if ((file.type.startsWith("image/")) || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
        text = await extractFromImage(file);
      } else {
        return;
      }
      const snippet = text.length > 16000 ? text.slice(0, 16000) : text;
      const userMsg: ChatMessage = {
        role: "user",
        content: `Extraí o seguinte conteúdo do arquivo anexado. Analise e use para preencher o formulário do processo, propondo objetivo, entradas, etapas, decisões e saídas quando possível:\n\n${snippet}`,
      };
      setMessages((m) => [...m, userMsg]);
      const customScript = localStorage.getItem("process:routeScript");
      const aiSkin = localStorage.getItem("process:aiSkin");
      const { data, error } = await supabase.functions.invoke("ai-interview", {
        body: {
          history: [...messages, userMsg],
          current: form,
          customScript: customScript || null,
          aiSkin: aiSkin ? JSON.parse(aiSkin) : null,
        },
      });
      const hasErrorField = (d: unknown): d is { error: string } =>
        typeof d === "object" && d !== null && "error" in d;
      if (error || hasErrorField(data)) {
        const detail = error instanceof Error ? error.message : hasErrorField(data) ? data.error : "Falha desconhecida";
        await handleFallback(userMsg.content, detail);
        return;
      }
      const resp = data as InterviewResponse;
      if (resp.partialUpdate) setForm((prev) => mergeFormUpdate(prev, resp.partialUpdate));
      if (resp.done) {
        applyToForm("manual");
      } else if (resp.nextQuestion) {
        await enqueueAssistantMessage(resp.nextQuestion);
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Erro desconhecido";
      await handleFallback("Arquivo anexado", detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isDone = index < currentStep;
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
                  {index < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Entrevista com IA</h1>
          <p className="text-muted-foreground">Condução guiada para mapear seu processo sem preenchimento manual.</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Progresso {progress}%
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Chat</CardTitle>
            <Progress value={progress} className="w-48" />
          </div>
        </CardHeader>
        <CardContent>
          <div ref={scrollRef} className="h-[420px] overflow-auto rounded-md border p-3 space-y-3">
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

          <div className="mt-4 flex gap-2">
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
              {assistantBusy ? "Aguarde..." : <>
                Enviar <Send className="h-4 w-4 ml-2" />
              </>}
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <Label>Anexo para análise (PDF, DOCX, JPG/PNG)</Label>
            <Input
              type="file"
              accept=".pdf,.docx,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                if (f) void analyzeFile(f);
                e.currentTarget.value = "";
              }}
              disabled={assistantBusy}
            />
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => navigate("/processos")}>Cancelar</Button>
            <Button onClick={() => applyToForm("manual")}>
              Aplicar no Formulário <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
