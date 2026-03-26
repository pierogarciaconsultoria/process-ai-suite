import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ConfigPerfil = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Array<{ id: string; nome: string; perfil: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) return;
        setEmail(user.email ?? "");
        setNome(((user.user_metadata as { full_name?: string } | undefined)?.full_name ?? "") as string);
        setCreatedAt(user.created_at ?? null);
        const { data: mem } = await supabase.from("membros").select("empresa_id, perfil").eq("user_id", user.id);
        const memRows = (mem as { empresa_id: string; perfil: string }[]) || [];
        const ids = Array.from(new Set(memRows.map((m) => m.empresa_id)));
        if (ids.length) {
          const { data: emp } = await supabase.from("empresas").select("id, nome").in("id", ids);
          const empRows = (emp as { id: string; nome: string }[]) || [];
          const map = new Map(empRows.map((e) => [e.id, e.nome]));
          const combined = memRows.map((m) => ({ id: m.empresa_id, nome: map.get(m.empresa_id) ?? m.empresa_id, perfil: m.perfil }));
          setEmpresas(combined);
        } else {
          setEmpresas([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canSave = useMemo(() => nome.trim().length > 0, [nome]);

  const salvar = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { full_name: nome.trim() } });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/configuracoes")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
          <p className="text-muted-foreground">Atualize suas informações pessoais</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações de Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando informações…</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} readOnly />
              </div>
              <div className="space-y-1">
                <Label>Membro em</Label>
                <div className="text-sm text-foreground">
                  {empresas.length === 0 ? "Nenhuma empresa" : empresas.map((e) => `${e.nome} (${e.perfil})`).join(", ")}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Conta criada em</Label>
                <div className="text-sm text-foreground">{createdAt ? new Date(createdAt).toLocaleString() : "—"}</div>
              </div>
              <Button onClick={salvar} disabled={!canSave || saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfigPerfil;
