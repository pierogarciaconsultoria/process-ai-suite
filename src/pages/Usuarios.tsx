import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Empresa = { id: string; nome: string };
type Membro = { id: string; user_id: string; perfil: "admin" | "gestor" | "analista"; created_at: string };
type Invite = { id: string; email: string; perfil: "admin" | "gestor" | "analista"; status: "pending" | "accepted" | "revoked"; created_at: string };

const perfilColors: Record<string, string> = {
  admin: "bg-info text-info-foreground",
  gestor: "bg-primary text-primary-foreground",
  analista: "bg-muted text-muted-foreground",
};

const perfilLabels: Record<Membro["perfil"], string> = { admin: "Admin", gestor: "Gestor", analista: "Analista" };

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
      const { data, error } = await supabase.functions.invoke("org-list");
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
      body: { empresaId, email: invEmail.trim(), perfil: invPerfil },
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
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="analista">Analista</SelectItem>
                  </SelectContent>
                </Select>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const u = users[m.user_id];
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{u?.nome || "—"}</TableCell>
                    <TableCell>{u?.email || "—"}</TableCell>
                    <TableCell><Badge className={perfilColors[m.perfil]}>{perfilLabels[m.perfil]}</Badge></TableCell>
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
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.email}</TableCell>
                  <TableCell><Badge className={perfilColors[i.perfil]}>{perfilLabels[i.perfil as Membro["perfil"]]}</Badge></TableCell>
                  <TableCell>{i.status}</TableCell>
                  <TableCell>{new Date(i.created_at).toLocaleString("pt-BR")}</TableCell>
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
