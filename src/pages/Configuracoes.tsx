import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Users, User, KeyRound, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Configuracoes = () => {
  const navigate = useNavigate();
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Array<{ id: string; nome: string; perfil: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) return;
        setEmail(user.email ?? "");
        setNome((user.user_metadata as { full_name?: string } | undefined)?.full_name ?? null);
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
        setLoadingInfo(false);
      }
    })();
  }, []);
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seu perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingInfo ? (
            <div className="text-sm text-muted-foreground">Carregando informações…</div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input value={email} readOnly />
              </div>
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={nome ?? "—"} readOnly />
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
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/empresas")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gerencie empresas e dados organizacionais</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/chamados")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Chamados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Abra e acompanhe chamados de suporte</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/usuarios")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <Users className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gerencie usuários e perfis de acesso</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/perfil")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <User className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Atualize suas informações pessoais</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/alterar-senha")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Alterar Senha</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Defina uma nova senha de acesso</p>
          </CardContent>
        </Card>
      </div>
 
    </div>
  );
};

export default Configuracoes;
