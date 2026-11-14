import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, Loader2, Trash2, UserPlus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAdminDaPlataforma } from "@/hooks/useAdminDaPlataforma";
import { supabase } from "@/integrations/supabase/client";
import { DESCRICAO_PAPEL_CONTA, linkDoConviteDeConta, PAPEL_CONTA, TIPO_CONTA } from "@/lib/contas";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";

type Conta = { id: string; nome: string; tipo: string; plano: string; situacao: string; limite_empresas: number | null };
type Membro = { id: string; user_id: string; email: string; nome: string | null; papel: string };
type Convite = { id: string; email: string; papel: string; token: string; expira_em: string };

// Conta (consultoria ou empresa): nome, pessoas, papéis e convites. Para o administrador da conta e a plataforma.
const MinhaConta = () => {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const { admin: adminDaPlataforma, carregando: verificandoPlataforma } = useAdminDaPlataforma();
  const [conta, setConta] = useState<Conta | null>(null);
  const [nome, setNome] = useState("");
  const [membros, setMembros] = useState<Membro[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [semAcesso, setSemAcesso] = useState(false);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"admin" | "consultor">("consultor");
  const [ultimoLink, setUltimoLink] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const avisarErro = useCallback((titulo: string, error: unknown) => {
    toast({ title: titulo, description: mensagemDoErroDoProcesso(error, "Tente de novo."), variant: "destructive" });
  }, [toast]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: auth } = await supabase.auth.getUser();
    setMeuId(auth.user?.id ?? null);
    // A plataforma abre qualquer conta (?id=); os demais, a conta em que são administradores.
    let contaId = params.get("id");
    if (!contaId) {
      const { data: minhas } = await supabase.rpc("minhas_contas");
      contaId = (Array.isArray(minhas) ? minhas.find((item: { papel: string }) => item.papel === "admin") : undefined)?.id ?? null;
    }
    if (!contaId) {
      setSemAcesso(true);
      setCarregando(false);
      return;
    }
    const [{ data: dadosConta }, { data: dadosMembros, error: erroMembros }, { data: dadosConvites }] = await Promise.all([
      supabase.from("contas").select("id, nome, tipo, plano, situacao, limite_empresas").eq("id", contaId).maybeSingle(),
      supabase.rpc("membros_da_conta", { _conta_id: contaId }),
      supabase.from("convites_conta").select("id, email, papel, token, expira_em").eq("conta_id", contaId).eq("status", "pendente").order("created_at", { ascending: false }),
    ]);
    const lista = (dadosMembros ?? []) as Membro[];
    if (!dadosConta || erroMembros || lista.length === 0) {
      setSemAcesso(true);
      setCarregando(false);
      return;
    }
    setConta(dadosConta as Conta);
    setNome((dadosConta as Conta).nome);
    setMembros(lista);
    setConvites((dadosConvites ?? []) as Convite[]);
    setSemAcesso(false);
    setCarregando(false);
  }, [params]);

  useEffect(() => {
    if (!verificandoPlataforma) void carregar();
  }, [carregar, verificandoPlataforma]);

  const salvarNome = async () => {
    if (!conta || !nome.trim()) return;
    const { error } = await supabase.from("contas").update({ nome: nome.trim() }).eq("id", conta.id);
    if (error) return avisarErro("Não foi possível renomear a conta", error);
    setConta({ ...conta, nome: nome.trim() });
    toast({ title: "Conta renomeada" });
  };

  const trocarPapel = async (membro: Membro, novo: string) => {
    const { error } = await supabase.from("conta_membros").update({ papel: novo }).eq("id", membro.id);
    if (error) return avisarErro("Não foi possível trocar o papel", error);
    setMembros((atuais) => atuais.map((item) => (item.id === membro.id ? { ...item, papel: novo } : item)));
  };

  const remover = async (membro: Membro) => {
    if (!window.confirm(`Remover ${membro.nome || membro.email} da conta? A pessoa perde o acesso às empresas da conta (exceto as em que é membro direto).`)) return;
    const { error } = await supabase.from("conta_membros").delete().eq("id", membro.id);
    if (error) return avisarErro("Não foi possível remover", error);
    setMembros((atuais) => atuais.filter((item) => item.id !== membro.id));
  };

  const convidar = async () => {
    if (!conta || !email.trim()) return;
    setOcupado(true);
    const { data, error } = await supabase.from("convites_conta").insert({ conta_id: conta.id, email: email.trim(), papel }).select("id, email, papel, token, expira_em").single();
    setOcupado(false);
    if (error || !data) return avisarErro("Não foi possível criar o convite", error);
    setConvites((atuais) => [data as Convite, ...atuais]);
    setUltimoLink(linkDoConviteDeConta((data as Convite).token));
    setEmail("");
  };

  const copiar = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copiado", description: "Envie para a pessoa convidada (e-mail ou WhatsApp). Vale por 14 dias." });
    } catch {
      toast({ title: "Copie o link manualmente", description: link });
    }
  };

  const revogar = async (convite: Convite) => {
    const { error } = await supabase.from("convites_conta").update({ status: "revogado" }).eq("id", convite.id);
    if (error) return avisarErro("Não foi possível cancelar o convite", error);
    setConvites((atuais) => atuais.filter((item) => item.id !== convite.id));
  };

  if (carregando || verificandoPlataforma) {
    return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando a conta...</p>;
  }
  if (semAcesso || !conta) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Conta</CardTitle>
          <CardDescription>Esta tela é do administrador da conta (consultoria ou empresa).{adminDaPlataforma ? " Abra uma conta pela tela Contas." : ""}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{conta.nome}</h1>
        <p className="text-muted-foreground">
          {TIPO_CONTA[conta.tipo] ?? conta.tipo} · plano {conta.plano} · {conta.situacao}
          {conta.limite_empresas !== null ? ` · até ${conta.limite_empresas} empresas` : ""}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Nome da conta</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Nome da conta" value={nome} onChange={(e) => setNome(e.target.value)} className="sm:max-w-md" />
          <Button variant="outline" onClick={() => void salvarNome()} disabled={!nome.trim() || nome.trim() === conta.nome}>Salvar nome</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pessoas da conta</CardTitle>
          <CardDescription>{DESCRICAO_PAPEL_CONTA.admin} Consultor: {DESCRICAO_PAPEL_CONTA.consultor.toLowerCase()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow><TableHead>Pessoa</TableHead><TableHead>Papel</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {membros.map((membro) => (
                  <TableRow key={membro.id}>
                    <TableCell>
                      <div className="font-medium">{membro.nome || membro.email}</div>
                      {membro.nome && <div className="text-xs text-muted-foreground">{membro.email}</div>}
                    </TableCell>
                    <TableCell className="w-48">
                      <Select value={membro.papel} onValueChange={(valor) => void trocarPapel(membro, valor)}>
                        <SelectTrigger aria-label={`Papel de ${membro.email}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{PAPEL_CONTA.admin}</SelectItem>
                          <SelectItem value="consultor">{PAPEL_CONTA.consultor}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => void remover(membro)} aria-label={`Remover ${membro.email}`} title={membro.user_id === meuId ? "Remover você mesmo" : "Remover"}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convidar para a conta</CardTitle>
          <CardDescription>O Peter gera um link para o e-mail informado. Envie o link por e-mail ou WhatsApp; a pessoa entra com esse e-mail e aceita.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr,180px,auto]">
            <div className="space-y-1.5">
              <Label htmlFor="convite-email">E-mail</Label>
              <Input id="convite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@consultoria.com.br" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="convite-papel">Papel</Label>
              <Select value={papel} onValueChange={(valor) => setPapel(valor as "admin" | "consultor")}>
                <SelectTrigger id="convite-papel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultor">{PAPEL_CONTA.consultor}</SelectItem>
                  <SelectItem value="admin">{PAPEL_CONTA.admin}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="self-end" onClick={() => void convidar()} disabled={ocupado || !email.includes("@")}>
              {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Gerar convite
            </Button>
          </div>
          {ultimoLink && (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 truncate text-xs" data-testid="link-convite">{ultimoLink}</code>
              <Button size="sm" variant="outline" onClick={() => void copiar(ultimoLink)}><Copy className="mr-2 h-4 w-4" /> Copiar link</Button>
            </div>
          )}
          {convites.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Convites pendentes</div>
              {convites.map((convite) => (
                <div key={convite.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{convite.email}</span>
                  <Badge variant="outline">{PAPEL_CONTA[convite.papel] ?? convite.papel}</Badge>
                  <span className="text-xs text-muted-foreground">até {new Date(convite.expira_em).toLocaleDateString("pt-BR")}</span>
                  <Button size="sm" variant="ghost" onClick={() => void copiar(linkDoConviteDeConta(convite.token))} aria-label={`Copiar link de ${convite.email}`}><Copy className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => void revogar(convite)} aria-label={`Cancelar convite de ${convite.email}`}><XCircle className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MinhaConta;
