import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bot, Loader2, MessageSquarePlus, PanelLeft, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TextoMarkdown } from "@/components/peter/TextoMarkdown";
import { emptyProcessoForm } from "@/data/processo-form-types";
import { supabase } from "@/integrations/supabase/client";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { lerExtras, rotaDoAtalho, SUGESTOES, type Conversa, type MensagemChat } from "@/lib/peter-chat";
import { mensagemDaFuncao } from "@/lib/erro-da-funcao";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";

// Erro da chamada à função ai-peter-chat em português.
const mensagemDaFalha = (error: unknown) => mensagemDaFuncao(error, "Não consegui falar com o Peter. Tente de novo.");

function ListaDeConversas({
  conversas,
  atual,
  onAbrir,
  onNova,
  onExcluir,
}: {
  conversas: Conversa[];
  atual: string | null;
  onAbrir: (id: string) => void;
  onNova: () => void;
  onExcluir: (conversa: Conversa) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-2">
      <Button variant="outline" className="justify-start" onClick={onNova}>
        <MessageSquarePlus className="mr-2 h-4 w-4" /> Nova conversa
      </Button>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Conversas anteriores">
        {conversas.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">As conversas com o Peter aparecem aqui.</p>}
        {conversas.map((conversa) => (
          <div key={conversa.id} className={`group flex items-center rounded-md ${conversa.id === atual ? "bg-muted" : "hover:bg-muted/60"}`}>
            <button type="button" className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm" onClick={() => onAbrir(conversa.id)} aria-current={conversa.id === atual ? "true" : undefined}>
              {conversa.titulo}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={`Excluir conversa ${conversa.titulo}`}
              onClick={() => onExcluir(conversa)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </nav>
    </div>
  );
}

const PeterChat = () => {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const rolagemRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const empresa = await resolveAccessibleCompanyId(auth.user?.id ?? null);
      if (!ativo || !empresa) return;
      setCompanyId(empresa);
      const { data, error } = await supabase
        .from("peter_conversas")
        .select("id, titulo, updated_at")
        .eq("company_id", empresa)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) console.warn("Conversas indisponíveis:", error);
      else if (ativo) setConversas(data ?? []);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    document.body.dataset.conversaPeter = "true";
    return () => {
      delete document.body.dataset.conversaPeter;
    };
  }, []);

  useEffect(() => {
    rolagemRef.current?.scrollTo({ top: rolagemRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, pensando]);

  // O campo cresce com o texto, como na entrevista.
  useEffect(() => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.style.height = "auto";
    campo.style.height = `${Math.min(campo.scrollHeight, 168)}px`;
  }, [texto]);

  const abrirConversa = useCallback(async (id: string) => {
    setListaAberta(false);
    setErro(null);
    setConversaId(id);
    setCarregando(true);
    const { data, error } = await supabase
      .from("peter_mensagens")
      .select("id, role, conteudo, extras, created_at")
      .eq("conversa_id", id)
      .order("created_at");
    setCarregando(false);
    if (error) setErro(mensagemDoErroDoProcesso(error, "Não foi possível abrir a conversa."));
    else setMensagens(data ?? []);
  }, []);

  const novaConversa = () => {
    setListaAberta(false);
    setConversaId(null);
    setMensagens([]);
    setErro(null);
    campoRef.current?.focus();
  };

  const excluirConversa = async (conversa: Conversa) => {
    if (!window.confirm(`Excluir a conversa "${conversa.titulo}"?`)) return;
    const { error } = await supabase.from("peter_conversas").delete().eq("id", conversa.id);
    if (error) {
      setErro(mensagemDoErroDoProcesso(error, "Não foi possível excluir a conversa."));
      return;
    }
    setConversas((atuais) => atuais.filter((item) => item.id !== conversa.id));
    if (conversa.id === conversaId) novaConversa();
  };

  const mapear = (nomeProcesso = "") =>
    navigate("/processos/novo/entrevista", {
      state: { guidedExperience: true, ...(nomeProcesso ? { formPrefill: { ...emptyProcessoForm, nomeProcesso } } : {}) },
    });

  const enviar = async (pergunta: string) => {
    const mensagem = pergunta.trim();
    if (!mensagem || pensando || !companyId) return;
    setErro(null);
    setTexto("");
    setPensando(true);
    const provisoria: MensagemChat = { id: "enviando", role: "user", conteudo: mensagem, extras: {}, created_at: new Date().toISOString() };
    setMensagens((atuais) => [...atuais, provisoria]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-peter-chat", {
        body: { company_id: companyId, conversa_id: conversaId, mensagem },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      const novas = (data?.mensagens ?? []) as MensagemChat[];
      setMensagens((atuais) => [...atuais.filter((item) => item.id !== "enviando"), ...novas]);
      const id = String(data?.conversa_id ?? "");
      if (id && id !== conversaId) {
        setConversaId(id);
        setConversas((atuais) => [{ id, titulo: mensagem.length > 60 ? `${mensagem.slice(0, 57)}…` : mensagem, updated_at: new Date().toISOString() }, ...atuais.filter((item) => item.id !== id)]);
      } else {
        setConversas((atuais) => {
          const atual = atuais.find((item) => item.id === id);
          return atual ? [{ ...atual, updated_at: new Date().toISOString() }, ...atuais.filter((item) => item.id !== id)] : atuais;
        });
      }
    } catch (error) {
      setMensagens((atuais) => atuais.filter((item) => item.id !== "enviando"));
      setTexto(mensagem);
      setErro(await mensagemDaFalha(error));
    } finally {
      setPensando(false);
    }
  };

  const lista = (
    <ListaDeConversas
      conversas={conversas}
      atual={conversaId}
      onAbrir={(id) => void abrirConversa(id)}
      onNova={novaConversa}
      onExcluir={(conversa) => void excluirConversa(conversa)}
    />
  );

  return (
    <div className="flex h-full min-h-0 gap-4 animate-fade-in">
      <aside className="hidden w-64 shrink-0 md:block">{lista}</aside>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setListaAberta(true)} aria-label="Conversas anteriores">
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Bot className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold text-foreground">Peter</h1>
          {/* Na conversa vazia, o convite já está no centro da tela. */}
          {mensagens.length > 0 && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => mapear()}>
              Mapear um processo <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </header>

        <div ref={rolagemRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {carregando ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo a conversa...</div>
          ) : mensagens.length === 0 ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Bot className="h-6 w-6 text-primary" /></div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">Olá! Sou o Peter.</h2>
                <p className="text-muted-foreground">
                  Pergunte sobre os processos, documentos, ações e indicadores da sua empresa. Se um processo ainda não foi mapeado, a gente mapeia juntos.
                </p>
              </div>
              <Button size="lg" onClick={() => mapear()}>Mapear um processo <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {SUGESTOES.map((sugestao) => (
                  <button key={sugestao} type="button" className="rounded-lg border px-4 py-3 text-left text-sm hover:bg-muted" onClick={() => void enviar(sugestao)} disabled={pensando || !companyId}>
                    {sugestao}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            mensagens.map((mensagem) => {
              const doPeter = mensagem.role === "assistant";
              const { atalhos, convite } = doPeter ? lerExtras(mensagem.extras) : { atalhos: [], convite: null };
              return (
                <div key={mensagem.id} className={`w-fit max-w-[min(100%,48rem)] rounded-lg px-4 py-3 ${doPeter ? "bg-muted" : "ml-auto border bg-card"}`}>
                  <div className="mb-1 text-xs text-muted-foreground">{doPeter ? "Peter" : "Você"}</div>
                  <div className="text-[15px] leading-relaxed">{doPeter ? <TextoMarkdown texto={mensagem.conteudo} /> : <p className="whitespace-pre-wrap">{mensagem.conteudo}</p>}</div>
                  {(atalhos.length > 0 || convite) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {convite && (
                        <Button size="sm" onClick={() => mapear(convite.nomeProcesso)}>
                          {convite.nomeProcesso ? `Mapear "${convite.nomeProcesso}"` : "Mapear um processo"}
                        </Button>
                      )}
                      {atalhos.map((atalho, indice) => (
                        <Button key={indice} size="sm" variant="outline" onClick={() => navigate(rotaDoAtalho(atalho))}>{atalho.rotulo}</Button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {pensando && (
            <div className="flex w-fit items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> Peter está consultando os dados...
            </div>
          )}
        </div>

        <div className="shrink-0 border-t px-4 py-3">
          {erro && <p className="mb-2 text-sm text-destructive" role="alert">{erro}</p>}
          <div className="flex items-end gap-2">
            <Textarea
              ref={campoRef}
              rows={1}
              className="max-h-[168px] min-h-10 resize-none py-2"
              placeholder="Pergunte ao Peter…"
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              disabled={!companyId}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void enviar(texto);
                }
              }}
            />
            <Button onClick={() => void enviar(texto)} disabled={pensando || !texto.trim() || !companyId} aria-label="Enviar" className="shrink-0">
              <span className="hidden sm:inline">Enviar</span>
              <Send className="h-4 w-4 sm:ml-2" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">O Peter consulta os dados da sua empresa e não altera nada. Confira informações importantes nas telas indicadas.</p>
        </div>
      </section>

      <Sheet open={listaAberta} onOpenChange={setListaAberta}>
        <SheetContent side="left" className="w-80 p-4">
          <SheetHeader className="mb-3"><SheetTitle>Conversas</SheetTitle></SheetHeader>
          <div className="h-[calc(100%-3rem)]">{lista}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PeterChat;
