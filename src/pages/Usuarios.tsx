import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2 } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DESCRICAO_PERFIL, ROTULO_PERFIL, usePodeGerenciar } from "@/lib/perfil";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";
import { supabase } from "@/integrations/supabase/client";
import { listarEmpresasDoUsuario } from "@/lib/empresas-do-usuario";
import { useToast } from "@/hooks/use-toast";

type Empresa = { id: string; nome: string };
type Membro = { id: string; user_id: string; perfil: "admin" | "gestor" | "analista"; created_at: string };
type Invite = {
  id: string;
  email: string;
  perfil: "admin" | "gestor" | "analista";
  status: "pending" | "accepted" | "revoked";
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  revoked_reason?: "expired" | "cancelled" | "replaced" | "delivery_failed" | null;
};

const perfilColors: Record<string, string> = {
  admin: "bg-info text-info-foreground",
  gestor: "bg-primary text-primary-foreground",
  analista: "bg-muted text-muted-foreground",
};

const perfilLabels: Record<Membro["perfil"], string> = { admin: ROTULO_PERFIL.admin, gestor: ROTULO_PERFIL.gestor, analista: ROTULO_PERFIL.analista };

const inviteStatusLabel = (invite: Invite) => {
  if (invite.status === "accepted") return "Aceito";
  if (invite.status === "revoked" && invite.revoked_reason === "expired") return "Expirado";
  if (invite.status === "revoked" && invite.revoked_reason === "cancelled") return "Cancelado";
  if (invite.status === "revoked") return "Revogado";
  return "Pendente";
};

const Usuarios = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [membros, setMembros] = useState<Membro[]>([]);
  const [users, setUsers] = useState<Record<string, { id: string; email: string; nome?: string }>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invEmail, setInvEmail] = useState("");
  const [invPerfil, setInvPerfil] = useState<Membro["perfil"]>("analista");
  const [loading, setLoading] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadEmpresas = async () => {
      const { data, error } = await listarEmpresasDoUsuario();
      if (!error && Array.isArray(data)) {
        const list = (data as Array<Record<string, unknown>>).map((e) => ({
          id: String(e.id),
          nome: String(e.nome),
        })) as Empresa[];
        setEmpresas(list);
        if (list.length > 0) setEmpresaId(list[0].id);
      }
    };
    loadEmpresas();
  }, []);

  useEffect(() => {
    const loadMembers = async () => {
      if (!empresaId) return;
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("org-members", { body: { empresaId } });
      setLoading(false);
      if (error) {
        toast({ title: "Erro ao carregar membros", description: error.message, variant: "destructive" });
        return;
      }
      setMembros((data?.membros || []) as Membro[]);
      setUsers((data?.users || {}) as Record<string, { id: string; email: string; nome?: string }>);
      setInvites((data?.invites || []) as Invite[]);
    };
    loadMembers();
  }, [empresaId, toast]);

  // Consultor e Gestor trocam perfil e removem; dar ou tirar "Consultor" é só do Consultor (regra no banco).
  const podeGerenciar = usePodeGerenciar(empresaId || null);

  const trocarPerfil = async (membro: Membro, perfil: Membro["perfil"]) => {
    if (perfil === membro.perfil) return;
    const { error } = await supabase.from("membros").update({ perfil }).eq("id", membro.id);
    if (error) {
      toast({ title: "Não foi possível trocar o perfil", description: mensagemDoErroDoProcesso(error, "Tente de novo."), variant: "destructive" });
      return;
    }
    setMembros((atuais) => atuais.map((item) => (item.id === membro.id ? { ...item, perfil } : item)));
    toast({ title: "Perfil atualizado", description: `${users[membro.user_id]?.email || "Membro"}: ${perfilLabels[perfil]}.` });
  };

  const removerMembro = async (membro: Membro) => {
    const quem = users[membro.user_id]?.email || "este membro";
    if (!window.confirm(`Remover ${quem} da empresa? O acesso aos dados da empresa termina na hora.`)) return;
    const { data, error } = await supabase.from("membros").delete().eq("id", membro.id).select("id");
    // Remoção bloqueada pela regra de acesso volta sem erro e sem linhas.
    if (error || !data?.length) {
      toast({ title: "Não foi possível remover", description: mensagemDoErroDoProcesso(error, "Você não tem permissão para remover este membro."), variant: "destructive" });
      return;
    }
    setMembros((atuais) => atuais.filter((item) => item.id !== membro.id));
    toast({ title: "Membro removido", description: quem });
  };

  const filtered = useMemo(() => {
    return membros.filter((m) => {
      const u = users[m.user_id];
      const alvo = `${u?.nome || ""} ${u?.email || ""}`.toLowerCase();
      return alvo.includes(search.toLowerCase());
    });
  }, [membros, users, search]);

  const handleInvite = async () => {
    if (!empresaId || !invEmail.trim()) {
      toast({ title: "Informe email e empresa", description: "Selecione a empresa e preencha o email.", variant: "destructive" });
      return;
    }
    setLoadingInvite(true);
    const { data, error } = await supabase.functions.invoke("org-invite", {
      body: { empresaId, email: invEmail.trim(), perfil: invPerfil, appBaseUrl: window.location.origin },
    });
    setLoadingInvite(false);
    if (error) {
      toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
      return;
    }
    if (data?.invite) {
      setInvites((prev) => [data.invite as Invite, ...prev]);
      setOpen(false);
      setInvEmail("");
      setInvPerfil("analista");
      toast({ title: "Convite enviado", description: "Convite criado com sucesso." });
    } else {
      toast({ title: "Convite existente", description: "Já há um convite pendente para este email." });
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const { data, error } = await supabase.functions.invoke("org-revoke-invite", {
      body: { inviteId },
    });

    if (error) {
      toast({ title: "Erro ao revogar convite", description: error.message, variant: "destructive" });
      return;
    }

    if (data?.invite) {
      const updated = data.invite as Invite;
      setInvites((prev) => prev.map((invite) => (invite.id === updated.id ? updated : invite)));
      toast({ title: "Convite revogado", description: "O convite foi cancelado com sucesso." });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Membros</h1>
          <p className="text-muted-foreground">Gerencie membros e convites por empresa</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Convidar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar membro</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={empresaId} onValueChange={(v) => setEmpresaId(v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (<SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="email@empresa.com" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={invPerfil} onValueChange={(v) => setInvPerfil(v as Membro["perfil"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{ROTULO_PERFIL.admin}</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="analista">{ROTULO_PERFIL.analista}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{DESCRICAO_PERFIL[invPerfil]}</p>
              </div>
              <Button className="w-full" onClick={handleInvite} disabled={loadingInvite}>{loadingInvite ? "Enviando..." : "Enviar convite"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="min-w-[220px]">
              <Label className="sr-only">Empresa</Label>
              <Select value={empresaId} onValueChange={(v) => setEmpresaId(v)}>
                <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (<SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                {podeGerenciar && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const u = users[m.user_id];
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{u?.nome || "—"}</TableCell>
                    <TableCell>{u?.email || "—"}</TableCell>
                    <TableCell>
                      {podeGerenciar ? (
                        <Select value={m.perfil} onValueChange={(valor) => void trocarPerfil(m, valor as Membro["perfil"])}>
                          <SelectTrigger className="w-40" aria-label={`Perfil de ${u?.email || "membro"}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(["admin", "gestor", "analista"] as const).map((perfil) => <SelectItem key={perfil} value={perfil}>{perfilLabels[perfil]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={perfilColors[m.perfil]}>{perfilLabels[m.perfil]}</Badge>
                      )}
                    </TableCell>
                    {podeGerenciar && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => void removerMembro(m)} aria-label={`Remover ${u?.email || "membro"}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {loading && <div className="text-sm text-muted-foreground mt-2">Carregando...</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Convites</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.email}</TableCell>
                  <TableCell><Badge className={perfilColors[i.perfil]}>{perfilLabels[i.perfil as Membro["perfil"]]}</Badge></TableCell>
                  <TableCell>{inviteStatusLabel(i)}</TableCell>
                  <TableCell>{new Date(i.expires_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{new Date(i.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    {i.status === "pending" ? (
                      <Button variant="outline" size="sm" onClick={() => handleRevokeInvite(i.id)}>
                        Revogar
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Usuarios;
