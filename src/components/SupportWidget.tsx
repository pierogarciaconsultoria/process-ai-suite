import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle } from "lucide-react";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const SupportWidget = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Olá! Sou o assistente da plataforma. Em que posso ajudar?" },
  ]);

  const pageHint = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return window.location.pathname;
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && !authEventReceived) {
        setIsAuthenticated(Boolean(data.session));
        setAuthResolved(true);
      }
    }).catch(() => {
      if (active && !authEventReceived) setAuthResolved(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        authEventReceived = true;
        setIsAuthenticated(Boolean(session));
        setAuthResolved(true);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-helpcenter", {
        body: { history: [...messages, userMsg], page: pageHint },
      });
      if (error) {
        setMessages((m) => [...m, { role: "assistant", content: "Não consegui responder agora. Tente novamente em instantes." }]);
      } else {
        const answer = (data as { answer?: string })?.answer || "Pronto. Mais alguma dúvida?";
        setMessages((m) => [...m, { role: "assistant", content: answer }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Ocorreu um erro. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!authResolved || !isAuthenticated) return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg" onClick={() => setOpen((v) => !v)}>
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] sm:w-[420px]">
          <Card className="shadow-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ajuda com IA</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={scrollRef} className="h-[340px] overflow-auto rounded-md border p-3 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`p-3 rounded-md ${m.role === "assistant" ? "bg-muted" : "bg-card border"}`}>
                    <div className="text-xs text-muted-foreground mb-1">{m.role === "assistant" ? "Assistente" : "Você"}</div>
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Digite sua dúvida…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button onClick={send} disabled={loading}>{loading ? "Enviando..." : "Enviar"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default SupportWidget;
