import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Chamado = Tables<"chamados">;
type Mensagem = Tables<"chamado_mensagens">;

const tipoLabel: Record<NonNullable<Chamado["tipo"]>, string> = {
  duvida: "Dúvida",
  incidente: "Incidente",
  requisicao: "Requisição",
  melhoria: "Melhoria",
};

const ChamadoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const podeEnviar = useMemo(() => texto.trim().length > 0 || arquivo, [texto, arquivo]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) return;
      const { data: m } = await supabase.from("membros").select("empresa_id").eq("user_id", user.id).limit(1);
      const mRows = (m as { empresa_id: string }[]) || [];
      if (mRows[0]?.empresa_id) setEmpresaId(mRows[0].empresa_id);
      const { data: c } = await supabase.from("chamados").select("*").eq("id", id).single();
      setChamado((c as Chamado) || null);
      const { data: msgs } = await supabase
        .from("chamado_mensagens")
        .select("*")
        .eq("chamado_id", id)
        .order("created_at", { ascending: true });
      setMensagens(((msgs as Mensagem[]) || []).slice(-500));
    })();
  }, [id]);

  const baixarAnexo = async (path: string) => {
    const { data } = await supabase.storage.from("chamados").createSignedUrl(path, 60);
    const url = data?.signedUrl;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const enviar = async () => {
    if (!id || (!texto.trim() && !arquivo) || enviando || !empresaId) return;
    setEnviando(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) throw new Error("Não autenticado");
      let anexo_url: string | null = null;
      if (arquivo) {
        const path = `${empresaId}/${id}/${encodeURIComponent(arquivo.name)}`;
        const { error: upErr } = await supabase.storage.from("chamados").upload(path, arquivo, { upsert: true });
        if (!upErr) anexo_url = path;
      }
      const msg: Partial<Mensagem> = {
        chamado_id: id,
        user_id: user.id,
        empresa_id: empresaId,
        conteudo: texto.trim(),
        anexo_url,
      };
      const sb = supabase as unknown as { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } };
      await sb.from("chamado_mensagens").insert(msg);
      setMensagens((prev) => [...prev, { ...(msg as Mensagem), id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
      setTexto("");
      setArquivo(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally {
      setEnviando(false);
    }
  };

  if (!chamado) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate("/configuracoes/chamados")}>Voltar</Button>
        <Card><CardContent className="p-6">Carregando chamado…</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{chamado.titulo}</h1>
            <Badge variant="secondary">{chamado.tipo ? tipoLabel[chamado.tipo] : "—"}</Badge>
          </div>
          <p className="text-muted-foreground">Aberto em {new Date(chamado.created_at).toLocaleString()}</p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/configuracoes/chamados")}>Voltar</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Troca de mensagens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[380px] overflow-auto border rounded-md p-3 space-y-3">
            {mensagens.map((m) => (
              <div key={m.id} className="p-3 rounded-md bg-muted">
                <div className="text-xs text-muted-foreground mb-1">{new Date(m.created_at).toLocaleString()}</div>
                <div className="text-sm whitespace-pre-wrap">{m.conteudo}</div>
                {m.anexo_url ? (
                  <div className="pt-2">
                    <Button variant="outline" size="sm" onClick={() => baixarAnexo(m.anexo_url!)}>Abrir anexo</Button>
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="mt-3 space-y-2">
            <Label>Mensagem</Label>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva sua mensagem..." />
          </div>
          <div className="mt-3 space-y-2">
            <Label>Anexo (opcional)</Label>
            <Input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={enviar} disabled={!podeEnviar || enviando}>{enviando ? "Enviando..." : "Enviar"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChamadoDetalhe;
