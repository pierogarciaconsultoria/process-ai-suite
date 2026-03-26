import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Send, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  type ProcessoFormData,
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

export default function EntrevistaProcesso() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Olá! Vou conduzir uma entrevista para mapear seu processo. Vamos começar pelo objetivo: em poucas palavras, qual é o objetivo principal do processo?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ProcessoFormData>(emptyProcessoForm);
  const scrollRef = useRef<HTMLDivElement>(null);

  const progress = useMemo(() => {
    const keys: (keyof ProcessoFormData)[] = [
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
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-interview", {
        body: {
          history: [...messages, userMsg],
          current: form,
        },
      });
      const hasErrorField = (d: unknown): d is { error: string } =>
        typeof d === "object" && d !== null && "error" in d;
      if (error || hasErrorField(data)) {
        const detail = error instanceof Error ? error.message : hasErrorField(data) ? data.error : "Falha desconhecida";
        handleFallback(userMsg.content, detail);
        return;
      }
      const resp = data as InterviewResponse;
      if (resp.partialUpdate) {
        setForm((prev) => ({ ...prev, ...resp.partialUpdate }));
      }
      if (resp.done) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Entrevista concluída. Deseja aplicar os dados no formulário para revisão e geração de diagnóstico?" },
        ]);
      } else if (resp.nextQuestion) {
        setMessages((m) => [...m, { role: "assistant", content: resp.nextQuestion! }]);
      } else {
        handleFallback(userMsg.content, "Resposta incompleta da IA");
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Erro desconhecido";
      handleFallback(userMsg.content, detail);
    } finally {
      setLoading(false);
    }
  };

  const handleFallback = (lastAnswer: string, detail: string) => {
    const fallback = computeFallback(form, lastAnswer);
    if (fallback.partialUpdate) {
      setForm((prev) => ({ ...prev, ...fallback.partialUpdate! }));
    }
    setMessages((m) => [
      ...m,
      { role: "assistant", content: `Ocorreu um erro técnico (${detail}). Vou continuar a entrevista de forma local.\n\n${fallback.nextQuestion ?? "Entrevista concluída. Deseja aplicar no formulário?"}` },
    ]);
  };

  const computeFallback = (currentForm: ProcessoFormData, answer: string): InterviewResponse => {
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
      const value = currentForm[key] as unknown;
      if (Array.isArray(value)) return arrayHasData(key, value);
      if (typeof value === "string") return value.trim().length > 0;
      return !!value;
    };
    const nextText = (key: keyof ProcessoFormData) => {
      const map: Partial<Record<keyof ProcessoFormData, string>> = {
        objetivo: "Qual é o objetivo principal do processo?",
        porqueExiste: "Por que este processo existe?",
        clienteProcesso: "Quem é o cliente do processo (quem recebe o resultado)?",
        areasEnvolvidas: "Quais áreas estão envolvidas?",
        gatilho: "Qual é o gatilho que inicia o processo?",
        entradas: "Liste fornecedores e entradas (uma por linha: Fornecedor - Entrada).",
        saidas: "Liste saídas e clientes (uma por linha: Saída - Cliente).",
        etapas: "Liste atividades e responsáveis (uma por linha: Atividade - Responsável).",
        decisoes: "Quais decisões ocorrem ao longo do processo?",
        recursos: "Quais recursos são necessários? (um por linha)",
        riscos: "Principais riscos (uma por linha: Risco - Consequência).",
        indicadores: "Quais indicadores você acompanha? (uma por linha: Indicador - Meta).",
        planoAcao: "Plano de ação 5W2H (uma por linha: O que; Porque; Quem; Quando; Onde; Como; Custo).",
      };
      return map[key] ?? "Deseja finalizar e aplicar ao formulário?";
    };
    const parseList = (txt: string) => txt.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    const parsePairs = (txt: string) => parseList(txt).map(line => {
      const [a, b] = line.split(/[-–—;:]/).map(s => s.trim());
      return [a ?? line, b ?? ""];
    });

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
      return { partialUpdate: { recursos: parseList(answer).join("\n") }, nextQuestion: nextText("riscos"), done: false };
    }
    if (!isFilled("riscos")) {
      const riscos: RiscoForm[] = parsePairs(answer).map(([risco, consequencia]) => ({ risco, consequencia, probabilidade: 3, impacto: 3 }));
      return { partialUpdate: { riscos: riscos.length ? riscos : [{ risco: answer, consequencia: "", probabilidade: 3, impacto: 3 }] }, nextQuestion: nextText("indicadores"), done: false };
    }
    if (!isFilled("indicadores")) {
      const indicadores: IndicadorForm[] = parsePairs(answer).map(([indicador, meta]) => ({ indicador, meta }));
      return { partialUpdate: { indicadores: indicadores.length ? indicadores : [{ indicador: answer, meta: "" }] }, nextQuestion: nextText("planoAcao"), done: false };
    }
    if (!isFilled("planoAcao")) {
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
  const applyToForm = () => {
    navigate("/processos/novo", { state: { formPrefill: form } });
  };

  return (
    <div className="space-y-6 animate-fade-in">
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
                <div className="text-xs text-muted-foreground mb-1">{m.role === "assistant" ? "IA" : "Você"}</div>
                <div className="text-sm whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              placeholder="Digite sua resposta…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} disabled={loading}>
              {loading ? "Aguarde..." : <>
                Enviar <Send className="h-4 w-4 ml-2" />
              </>}
            </Button>
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => navigate("/processos")}>Cancelar</Button>
            <Button onClick={applyToForm}>
              Aplicar no Formulário <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
