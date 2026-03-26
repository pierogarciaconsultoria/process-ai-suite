import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Chamado = Tables<"chamados">;

const statusLabel: Record<Chamado["status"], string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const ConfigChamados = () => {
  const navigate = useNavigate();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [carregando, setCarregando] = useState(true);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const canCreate = useMemo(() => titulo.trim().length > 3 && descricao.trim().length > 5, [titulo, descricao]);

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) throw new Error("Não autenticado");
        const { data: m } = await supabase.from("membros").select("empresa_id").eq("user_id", user.id).limit(1);
        const mRows = (m as { empresa_id: string }[]) || [];
        if (mRows[0]?.empresa_id) setEmpresaId(mRows[0].empresa_id);
        const { data: rows } = await supabase
          .from("chamados")
          .select("id, titulo, descricao, anexo_url, status, created_at, updated_at, user_id, empresa_id")
          .order("created_at", { ascending: false });
        setChamados(((rows as Chamado[]) || []).slice(0, 100));
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const criarChamado = async () => {
    if (!canCreate || !empresaId) return;
    setCriando(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) throw new Error("Não autenticado");
      const sb = supabase as unknown as {
        from: (t: string) => {
          insert: (v: unknown) => { select: () => { single: () => Promise<{ data?: unknown; error?: { message: string } }> } }
          update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> }
        }
      };
      const { data: inserted, error } = await sb
        .from("chamados")
        .insert({
          user_id: user.id,
          empresa_id: empresaId,
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          status: "aberto",
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const novo = inserted as Chamado;
      let anexo_url: string | null = null;
      if (arquivo) {
        const path = `${empresaId}/${novo.id}/${encodeURIComponent(arquivo.name)}`;
        const { error: upErr } = await supabase.storage.from("chamados").upload(path, arquivo, { upsert: true });
        if (upErr) throw upErr;
        anexo_url = path;
        await sb.from("chamados").update({ anexo_url }).eq("id", novo.id);
      }
      setChamados((prev) => [{ ...novo, anexo_url: anexo_url ?? novo.anexo_url }, ...prev]);
      setTitulo("");
      setDescricao("");
      setArquivo(null);
    } finally {
      setCriando(false);
    }
  };

  const alterarStatus = async (id: string, status: Chamado["status"]) => {
    setChamados((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    const sb = supabase as unknown as { from: (t: string) => { update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> } } };
    await sb.from("chamados").update({ status }).eq("id", id);
  };

  const abrirChamado = (id: string) => {
    navigate(`/configuracoes/chamados/${id}`);
  };

  const baixarAnexo = async (path: string) => {
    const { data } = await supabase.storage.from("chamados").createSignedUrl(path, 60);
    const url = data?.signedUrl;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chamados</h1>
          <p className="text-muted-foreground">Abertura, controle e acompanhamento</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo chamado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Assunto do chamado" />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o problema ou dúvida" />
          </div>
          <div className="space-y-2">
            <Label>Anexo (opcional)</Label>
            <Input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex justify-end">
            <Button onClick={criarChamado} disabled={!canCreate || criando || !empresaId}>
              {criando ? "Enviando..." : "Abrir chamado"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {carregando ? (
          [1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 text-sm text-muted-foreground">Carregando…</CardContent>
            </Card>
          ))
        ) : chamados.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Nenhum chamado encontrado.</CardContent>
          </Card>
        ) : (
          chamados.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">{c.titulo}</CardTitle>
                <select
                  className="text-sm border rounded-md px-2 py-1"
                  value={c.status}
                  onChange={(e) => alterarStatus(c.id, e.target.value as Chamado["status"])}
                >
                  <option value="aberto">{statusLabel["aberto"]}</option>
                  <option value="em_andamento">{statusLabel["em_andamento"]}</option>
                  <option value="resolvido">{statusLabel["resolvido"]}</option>
                  <option value="fechado">{statusLabel["fechado"]}</option>
                </select>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
                <div className="text-sm">{c.descricao}</div>
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" onClick={() => abrirChamado(c.id)}>Abrir</Button>
                  {c.anexo_url ? (
                    <Button variant="outline" onClick={() => baixarAnexo(c.anexo_url!)}>Baixar anexo</Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ConfigChamados;
