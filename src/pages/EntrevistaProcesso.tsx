import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileText, Lightbulb, Loader2, Paperclip, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { DiagnosticoView, PlanoView } from "@/components/entrevista/AnaliseRoteiro";
import { emptyProcessoForm, type ProcessoFormData } from "@/data/processo-form-types";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import {
  chamarRoteiro,
  historicoParaPeter,
  mensagensDoTurno,
  mesclarCampos,
  restaurarMensagens,
  type MensagemEntrevista,
} from "@/lib/entrevista-roteiro";
import { statusPelaEntrevista } from "@/lib/ciclo-processo";
import { moderarEntrada } from "@/lib/peter-moderation";
import { labelVisualArquivos, mapaAsIsDosAnexos, montarPartesArquivo, processarArquivo } from "@/lib/peter-upload";
import {
  buildProcessInsertPayload,
  buildProcessUpdatePayload,
  mapProcessRowToForm,
  normalizeSavedStatus,
  type ProcessoStatus,
} from "@/lib/processos";
import {
  EXTENSOES_ACEITAS,
  validarArquivo,
  validarLote,
  type ArquivoProcessado,
} from "../../supabase/functions/_shared/peter-interview-contract";
import { normalizarDiagnostico, normalizarPlano } from "../../supabase/functions/_shared/roteiro-analise";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import { iniciarRoteiroDoProcesso, type EstadoRoteiro } from "../../supabase/functions/_shared/roteiro-engine";
import { descreverPasso, iniciarTurno, sanitizarEstado, type ResultadoTurno } from "../../supabase/functions/_shared/roteiro-peter";

const ABERTURA = `Olá! Sou o **Peter** e vou conduzir a entrevista de mapeamento do seu processo. Você não precisa conhecer BPMN ou gestão de processos: é só me contar como as coisas funcionam que eu estruturo tudo.

Vamos passar por 6 etapas, uma pergunta por vez. No final, você terá o diagnóstico, o plano de melhoria e o mapa do processo.

Como prefere começar?`;

const AVISO_RASCUNHO_ANTIGO = "Este rascunho foi criado na versão anterior da entrevista. Vamos seguir pelo roteiro novo; o que já estava preenchido no processo continua salvo.";

const PEDIR_TEXTO = "Cole abaixo a descrição do processo: pode ser um texto informal, um procedimento antigo ou anotações de reunião. Eu extraio o que der e pergunto só o que faltar.";

const PEDIR_TEXTO_DURANTE = "Pode contar com suas palavras como a rotina funciona, ou colar um procedimento ou anotações. Eu aproveito o que der para as próximas perguntas e sigo de onde paramos.";

const RESPOSTA_FIM_ATIVIDADES = "Não há mais atividades, o processo termina aqui.";

class EntrevistaErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
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
      return <Aviso texto="Ocorreu um erro ao carregar a entrevista. Atualize a página e tente novamente." />;
    }
    return this.props.children;
  }
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">{texto}</CardContent>
      </Card>
    </div>
  );
}

// As mensagens do roteiro usam **negrito**; o restante é texto puro.
function TextoFormatado({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*)/g).map((parte, indice) =>
        parte.startsWith("**") && parte.endsWith("**")
          ? <strong key={indice}>{parte.slice(2, -2)}</strong>
          : <React.Fragment key={indice}>{parte}</React.Fragment>,
      )}
    </>
  );
}

function CartaoAnalise({ mensagem }: { mensagem: MensagemEntrevista }) {
  const conteudo = useMemo(() => {
    try {
      return JSON.parse(mensagem.content) as unknown;
    } catch {
      return null;
    }
  }, [mensagem.content]);
  const diagnostico = mensagem.acao === "diagnostico_as_is" ? normalizarDiagnostico(conteudo) : null;
  const plano = mensagem.acao === "plano_melhoria" ? normalizarPlano(conteudo) : null;
  if (!diagnostico && !plano) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{diagnostico ? "Diagnóstico do processo (AS IS)" : "Plano de melhoria"}</CardTitle>
      </CardHeader>
      <CardContent>{diagnostico ? <DiagnosticoView diagnostico={diagnostico} /> : <PlanoView plano={plano!} />}</CardContent>
    </Card>
  );
}

function Mensagem({ mensagem }: { mensagem: MensagemEntrevista }) {
  if (mensagem.tipo === "analise") return <CartaoAnalise mensagem={mensagem} />;
  if (mensagem.tipo === "alerta" || mensagem.tipo === "oportunidade") {
    const alerta = mensagem.tipo === "alerta";
    return (
      <div className={`flex gap-2 rounded-md border p-3 text-sm ${alerta ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}>
        {alerta ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />}
        <div>
          <div className="font-medium">{alerta ? "Ponto de atenção" : "Oportunidade de melhoria"}</div>
          <div>{mensagem.content}</div>
        </div>
      </div>
    );
  }
  // Largura de leitura (~75 caracteres por linha): Peter à esquerda, você à direita.
  const doPeter = mensagem.role === "assistant";
  return (
    <div className={`w-fit max-w-[min(100%,48rem)] rounded-lg px-4 py-3 ${doPeter ? "bg-muted" : "ml-auto border bg-card"}`}>
      <div className="mb-1 text-xs text-muted-foreground">{doPeter ? "Peter" : "Você"}</div>
      <div className="whitespace-pre-wrap text-[15px] leading-relaxed"><TextoFormatado texto={mensagem.content} /></div>
    </div>
  );
}

type Carregamento = "carregando" | "sem_empresa" | "erro" | "pronto";

function EntrevistaProcessoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeProcessId } = useParams<{ id: string }>();
  const routeState = location.state as { processId?: string; formPrefill?: ProcessoFormData } | null;

  const [carregamento, setCarregamento] = useState<Carregamento>("carregando");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcessoFormData>(emptyProcessoForm);
  const [estado, setEstado] = useState<EstadoRoteiro | null>(null);
  const [mensagens, setMensagens] = useState<MensagemEntrevista[]>([]);
  const [modoTexto, setModoTexto] = useState(false);
  const [input, setInput] = useState("");
  const [pendente, setPendente] = useState<string | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; repetir?: () => void } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const processIdRef = useRef<string | null>(routeProcessId ?? routeState?.processId ?? null);
  const statusRef = useRef<ProcessoStatus>("Em entrevista");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const passo = useMemo(() => (estado ? descreverPasso(ROTEIRO_PADRAO, estado) : null), [estado]);
  const ocupado = pendente !== null;

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const empresa = await resolveAccessibleCompanyId(auth.user?.id ?? null);
        if (cancelado) return;
        if (!empresa) {
          setCarregamento("sem_empresa");
          return;
        }
        setCompanyId(empresa);

        if (!processIdRef.current) {
          if (routeState?.formPrefill) setForm(routeState.formPrefill);
          setMensagens([{ role: "assistant", content: ABERTURA }]);
          setCarregamento("pronto");
          return;
        }

        const { data, error } = await supabase.from("processos").select("*").eq("id", processIdRef.current).single();
        if (error || !data) throw error ?? new Error("Processo não encontrado.");
        if (cancelado) return;
        const row = data as Tables<"processos">;
        statusRef.current = normalizeSavedStatus(row.status);
        setForm(mapProcessRowToForm(row));

        let restaurado: EstadoRoteiro | null = null;
        try {
          restaurado = row.entrevista_roteiro ? sanitizarEstado(ROTEIRO_PADRAO, row.entrevista_roteiro) : null;
        } catch (erroEstado) {
          console.warn("Estado da entrevista incompatível com o roteiro atual:", erroEstado);
        }
        if (restaurado) {
          setEstado(restaurado);
          setMensagens(restaurarMensagens(row.interview_messages));
        } else {
          setMensagens([{ role: "assistant", content: AVISO_RASCUNHO_ANTIGO }, { role: "assistant", content: ABERTURA }]);
        }
        setCarregamento("pronto");
      } catch (error) {
        console.error("Erro ao carregar a entrevista:", error);
        if (!cancelado) setCarregamento("erro");
      }
    };
    void carregar();
    return () => {
      cancelado = true;
    };
    // Carrega uma vez: depois do primeiro salvamento a URL muda sem remontar a página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, pendente]);

  useEffect(() => {
    if (!ocupado) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [ocupado]);

  // O campo de resposta cresce com o texto (até ~6 linhas) para dar para reler o passo a passo.
  useEffect(() => {
    const campo = inputRef.current;
    if (!campo) return;
    campo.style.height = "auto";
    const alturaAntes = campo.offsetHeight;
    campo.style.height = `${Math.min(campo.scrollHeight, 168)}px`;
    // A conversa encolhe quando o campo cresce: mantém a última pergunta à vista.
    if (campo.offsetHeight !== alturaAntes) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [input, passo?.tipo, modoTexto]);

  useEffect(() => {
    if (saveStatus === "saved" && !ocupado) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [ocupado, saveStatus]);

  const persistir = useCallback((
    formAtual: ProcessoFormData,
    mensagensAtuais: MensagemEntrevista[],
    estadoAtual: EstadoRoteiro,
    status?: ProcessoStatus,
  ) => {
    setSaveStatus("saving");
    const tarefa = saveQueueRef.current.catch(() => undefined).then(async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId || !companyId) throw new Error("Usuário ou empresa não identificados para salvar.");
      const statusFinal = status ?? statusPelaEntrevista(estadoAtual, statusRef.current);
      const comum = { form: formAtual, userId, status: statusFinal, interviewMessages: mensagensAtuais, entrevistaRoteiro: estadoAtual };

      if (processIdRef.current) {
        const { error } = await supabase
          .from("processos")
          .update(buildProcessUpdatePayload(comum))
          .eq("id", processIdRef.current)
          .eq("company_id", companyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("processos")
          .insert(buildProcessInsertPayload({ ...comum, companyId }))
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("Não foi possível criar o processo.");
        processIdRef.current = data.id;
        // Troca a URL sem remontar a página, para um recarregamento retomar a entrevista.
        window.history.replaceState(window.history.state, "", `/processos/${data.id}/entrevista`);
      }
      statusRef.current = statusFinal;
    });
    saveQueueRef.current = tarefa.then(
      () => setSaveStatus("saved"),
      (error) => {
        console.error("Falha ao salvar a entrevista:", error);
        setSaveStatus("error");
      },
    );
    return tarefa;
  }, [companyId]);

  const aplicarTurno = useCallback((turno: ResultadoTurno, base: MensagemEntrevista[], formBase: ProcessoFormData) => {
    const proximoForm = mesclarCampos(formBase, turno.campos);
    const proximasMensagens = [...base, ...mensagensDoTurno(turno)];
    setForm(proximoForm);
    setEstado(turno.estado);
    setMensagens(proximasMensagens);
    void persistir(proximoForm, proximasMensagens, turno.estado);
  }, [persistir]);

  const executar = useCallback(async (
    chamada: () => Promise<ResultadoTurno>,
    base: MensagemEntrevista[],
    status: string,
    opcoes: { desfazer?: () => void; repetir?: () => void; formBase?: ProcessoFormData } = {},
  ) => {
    setPendente(status);
    setErro(null);
    try {
      aplicarTurno(await chamada(), base, opcoes.formBase ?? form);
      return true;
    } catch (error) {
      opcoes.desfazer?.();
      setErro({ mensagem: error instanceof Error ? error.message : "Não consegui falar com o Peter.", repetir: opcoes.repetir });
      return false;
    } finally {
      setPendente(null);
    }
  }, [aplicarTurno, form]);

  const contexto = { company_id: companyId ?? "", process_id: processIdRef.current };

  const analisar = useCallback(() => {
    if (!estado || passo?.tipo !== "acao_ia") return;
    const status = passo.acao === "diagnostico_as_is" ? "Peter está montando o diagnóstico…" : "Peter está montando o plano de melhoria…";
    void executar(
      () => chamarRoteiro({ operacao: "analisar", company_id: companyId ?? "", process_id: processIdRef.current, estado }),
      mensagens,
      status,
      { repetir: analisar },
    );
  }, [companyId, estado, executar, mensagens, passo]);

  // A análise roda sozinha quando vira o passo atual (também ao retomar um rascunho).
  useEffect(() => {
    if (carregamento === "pronto" && passo?.tipo === "acao_ia" && !ocupado && !erro) analisar();
  }, [analisar, carregamento, erro, ocupado, passo]);

  const enviarResposta = async (texto: string) => {
    if (!estado || ocupado || !texto.trim()) return;
    const moderacao = moderarEntrada(texto);
    if (moderacao.blocked) {
      setErro({ mensagem: moderacao.reason ?? "Use linguagem profissional." });
      return;
    }
    const anteriores = mensagens;
    const base: MensagemEntrevista[] = [...anteriores, { role: "user", content: texto }];
    setMensagens(base);
    setInput("");
    await executar(
      () => chamarRoteiro({ operacao: "responder", ...contexto, estado, resposta: texto, current: form, history: historicoParaPeter(anteriores) }),
      base,
      "Peter está lendo sua resposta…",
      {
        desfazer: () => {
          setMensagens(anteriores);
          setInput(texto);
        },
      },
    );
  };

  const comecarGuiada = () => {
    const base: MensagemEntrevista[] = [...mensagens, { role: "user", content: "Entrevista guiada" }];
    aplicarTurno(iniciarTurno(ROTEIRO_PADRAO, iniciarRoteiroDoProcesso(ROTEIRO_PADRAO, form.nomeProcesso)), base, form);
  };

  const comecarTexto = () => {
    setModoTexto(true);
    setMensagens((atuais) => [...atuais, { role: "user", content: "Colar um texto" }, { role: "assistant", content: estado ? PEDIR_TEXTO_DURANTE : PEDIR_TEXTO }]);
  };

  const cancelarTexto = () => {
    setModoTexto(false);
    setInput("");
    // Retira o pedido de texto que não chegou a ser usado.
    setMensagens((atuais) => atuais.slice(0, -2));
  };

  const enviarTextoLivre = async (texto: string) => {
    if (ocupado || !texto.trim()) return;
    const moderacao = moderarEntrada(texto);
    if (moderacao.blocked) {
      setErro({ mensagem: moderacao.reason ?? "Use linguagem profissional." });
      return;
    }
    const anteriores = mensagens;
    const exibido = texto.length > 800 ? `${texto.slice(0, 800)}…` : texto;
    const base: MensagemEntrevista[] = [...anteriores, { role: "user", content: exibido }];
    setMensagens(base);
    setInput("");
    const ok = await executar(
      () => chamarRoteiro({
        operacao: "extrair",
        ...contexto,
        estado: estado ?? iniciarRoteiroDoProcesso(ROTEIRO_PADRAO, form.nomeProcesso),
        origem: "texto_livre",
        arquivo_content: [{ type: "text", text: texto }],
        current: form,
      }),
      base,
      "Peter está lendo o seu texto…",
      {
        desfazer: () => {
          setMensagens(anteriores);
          setInput(texto);
        },
      },
    );
    if (ok) setModoTexto(false);
  };

  const anexar = async (lista: FileList) => {
    if (ocupado) return;
    const arquivos = Array.from(lista);
    const invalido = arquivos.map(validarArquivo).find((validacao) => !validacao.valido) ?? validarLote(arquivos);
    if (!invalido.valido) {
      setErro({ mensagem: invalido.erro ?? "Arquivo inválido." });
      return;
    }

    setPendente("Lendo os arquivos…");
    setErro(null);
    const processados: ArquivoProcessado[] = [];
    let mapa: string | null = null;
    try {
      for (const arquivo of arquivos) processados.push((await processarArquivo(arquivo)).arquivo);
      mapa = await mapaAsIsDosAnexos(arquivos);
    } catch (error) {
      setPendente(null);
      setErro({ mensagem: error instanceof Error ? error.message : "Não foi possível ler os arquivos." });
      return;
    }
    setPendente(null);

    const base: MensagemEntrevista[] = [
      ...mensagens,
      { role: "user", content: labelVisualArquivos(processados), ...(mapa ? { mapaAnexado: true } : {}) },
    ];
    setMensagens(base);
    const ok = await executar(
      () => chamarRoteiro({
        operacao: "extrair",
        ...contexto,
        estado: estado ?? iniciarRoteiroDoProcesso(ROTEIRO_PADRAO, form.nomeProcesso),
        origem: "anexo",
        arquivo_content: montarPartesArquivo(processados),
        current: form,
      }),
      base,
      "Peter está analisando os arquivos…",
      { desfazer: () => setMensagens(mensagens), ...(mapa ? { formBase: { ...form, bpmnAsIs: mapa } } : {}) },
    );
    if (ok) setModoTexto(false);
  };

  const verResultado = async () => {
    if (!estado) return;
    setPendente("Salvando o processo…");
    try {
      await persistir(form, mensagens, estado);
      navigate(`/processos/${processIdRef.current}/resultado-guiado`, { state: { processo: form, autoGenerate: true } });
    } catch {
      setErro({ mensagem: "Não consegui salvar o processo. Verifique sua conexão e tente novamente." });
    } finally {
      setPendente(null);
    }
  };

  const sair = () => {
    if ((saveStatus !== "saved" || ocupado) && !window.confirm("Há informações que ainda não foram salvas. Deseja sair mesmo assim?")) return;
    navigate("/processos");
  };

  if (carregamento === "carregando") return <Aviso texto="Carregando entrevista..." />;
  if (carregamento === "sem_empresa") return <Aviso texto="Selecione uma empresa antes de iniciar a entrevista." />;
  if (carregamento === "erro") return <Aviso texto="Não foi possível abrir esta entrevista. Atualize a página e tente novamente." />;

  const progressoPercentual = passo
    ? passo.tipo === "concluido"
      ? 100
      : Math.round(((passo.progresso.etapa - 1 + (passo.progresso.perguntasAplicaveis ? passo.progresso.perguntasRespondidas / passo.progresso.perguntasAplicaveis : 0)) / passo.progresso.totalEtapas) * 100)
    : 0;
  const pergunta = passo?.tipo === "pergunta" ? passo.pergunta : undefined;
  const aguardandoTexto = passo?.tipo === "pergunta" || passo?.tipo === "confirmar_etapa";
  const opcoesRapidas = pergunta?.tipo === "opcao"
    ? pergunta.opcoes ?? []
    : pergunta?.tipo === "sim_nao"
      ? ["Sim", "Não"]
      : passo?.tipo === "confirmar_etapa"
        ? ["Está correto"]
        : [];
  const podeEncerrarAtividades = pergunta?.id === "e3.atividades" && estado?.respostas["e3.atividades"] !== undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden animate-fade-in">
      {/* Cabeçalho em uma linha só, para sobrar altura para a conversa. */}
      <div className="flex shrink-0 items-center gap-3">
        <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={sair} aria-label="Voltar para Processos" title="Voltar para Processos">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-foreground">Entrevista com o Peter</h1>
          <p className="truncate text-sm text-muted-foreground">{form.nomeProcesso || "Mapeamento guiado do processo"}</p>
        </div>
        <Badge variant={saveStatus === "error" ? "destructive" : "secondary"} className="flex w-fit shrink-0 items-center gap-2" aria-live="polite">
          {saveStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : saveStatus === "error" ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {saveStatus === "saving" ? "Salvando…" : saveStatus === "error" ? "Falha ao salvar" : "Salvo"}
        </Badge>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {passo && (
          <div className="shrink-0 space-y-1.5 border-b px-4 py-3">
            <div className="text-sm font-medium">{passo.progresso.rotulo}</div>
            <Progress value={progressoPercentual} className="h-1.5" aria-label="Progresso da entrevista" />
          </div>
        )}
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
            {mensagens.map((mensagem, indice) => <Mensagem key={indice} mensagem={mensagem} />)}
            {pendente && (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" /> {pendente}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t px-4 pb-4">
            {erro && (
              <div className="mt-3 flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert">
                <span>{erro.mensagem}</span>
                {erro.repetir && (
                  <Button size="sm" variant="outline" className="w-fit" onClick={() => { const repetir = erro.repetir; setErro(null); repetir?.(); }}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
                  </Button>
                )}
              </div>
            )}

            <Input
              ref={inputArquivoRef}
              type="file"
              accept={EXTENSOES_ACEITAS}
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) void anexar(event.target.files);
                event.currentTarget.value = "";
              }}
            />

            {!estado && !modoTexto && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={comecarGuiada} disabled={ocupado}>Entrevista guiada</Button>
                <Button variant="outline" onClick={comecarTexto} disabled={ocupado}>Colar um texto</Button>
                <Button variant="outline" onClick={() => inputArquivoRef.current?.click()} disabled={ocupado}>
                  <Paperclip className="mr-2 h-4 w-4" /> Anexar arquivo
                </Button>
              </div>
            )}

            {modoTexto && (
              <div className="mt-3 space-y-2">
                <Textarea
                  placeholder="Cole aqui a descrição do processo…"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={ocupado}
                  rows={6}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={cancelarTexto} disabled={ocupado}>Cancelar</Button>
                  <Button onClick={() => void enviarTextoLivre(input)} disabled={ocupado || !input.trim()}>
                    Enviar texto <Send className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {estado && aguardandoTexto && !modoTexto && (
              <>
                {(opcoesRapidas.length > 0 || podeEncerrarAtividades) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opcoesRapidas.map((opcao) => (
                      <Button key={opcao} size="sm" variant="outline" onClick={() => void enviarResposta(opcao)} disabled={ocupado}>
                        {opcao}
                      </Button>
                    ))}
                    {podeEncerrarAtividades && (
                      <Button size="sm" variant="outline" onClick={() => void enviarResposta(RESPOSTA_FIM_ATIVIDADES)} disabled={ocupado}>
                        O processo termina aqui
                      </Button>
                    )}
                  </div>
                )}
                {pergunta?.ajuda && <p className="mt-2 text-xs text-muted-foreground">Dica: {pergunta.ajuda}</p>}
                <div className="mt-3 flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => inputArquivoRef.current?.click()}
                    disabled={ocupado}
                    aria-label="Anexar arquivo"
                    title="Anexar arquivo"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={comecarTexto}
                    disabled={ocupado}
                    aria-label="Colar um texto"
                    title="Colar um texto ou contar a rotina livremente"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Textarea
                    ref={inputRef}
                    rows={1}
                    className="max-h-[168px] min-h-10 resize-none py-2"
                    placeholder={passo?.tipo === "confirmar_etapa" ? "Confirme ou diga o que ajustar…" : "Digite sua resposta…"}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={ocupado}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void enviarResposta(input);
                      }
                    }}
                  />
                  <Button onClick={() => void enviarResposta(input)} disabled={ocupado || !input.trim()} aria-label="Enviar" className="shrink-0">
                    <span className="hidden sm:inline">Enviar</span>
                    <Send className="h-4 w-4 sm:ml-2" />
                  </Button>
                </div>
              </>
            )}

            {passo?.tipo === "concluido" && (
              <div className="mt-3 flex justify-end">
                <Button onClick={() => void verResultado()} disabled={ocupado}>
                  Ver relatório e mapa AS IS <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EntrevistaProcesso() {
  return (
    <EntrevistaErrorBoundary>
      <EntrevistaProcessoPage />
    </EntrevistaErrorBoundary>
  );
}
