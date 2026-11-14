import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";

// Contas da plataforma (migration 202611140001): quem assina o Peter. Só para o administrador da plataforma.

type Conta = {
  id: string;
  nome: string;
  tipo: string;
  plano: string;
  situacao: string;
  limite_empresas: number | null;
  limite_usuarios: number | null;
  created_at: string;
  empresas: number;
  administradores: string | null;
};

type Rascunho = {
  id: string | null;
  nome: string;
  tipo: "consultoria" | "empresa";
  plano: string;
  situacao: "ativa" | "suspensa" | "cancelada";
  limiteEmpresas: string;
  limiteUsuarios: string;
};

const TIPO: Record<string, string> = { consultoria: "Consultoria", empresa: "Empresa direta" };
const SITUACAO: Record<string, string> = { ativa: "Ativa", suspensa: "Suspensa", cancelada: "Cancelada" };

const vazio: Rascunho = { id: null, nome: "", tipo: "consultoria", plano: "teste", situacao: "ativa", limiteEmpresas: "", limiteUsuarios: "" };

function limite(texto: string): number | null {
  const numero = Number(texto);
  return texto.trim() && Number.isInteger(numero) && numero >= 0 ? numero : null;
}

const ConfigContas = () => {
  const { toast } = useToast();
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc("contas_da_plataforma");
    setCarregando(false);
    if (error) {
      toast({ title: "Contas indisponíveis", description: mensagemDoErroDoProcesso(error, "Aplique a migration 202611140001 no banco."), variant: "destructive" });
      return;
    }
    setContas((data ?? []) as Conta[]);
  }, [toast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvar = async () => {
    if (!rascunho || !rascunho.nome.trim()) return;
    setSalvando(true);
    const dados = {
      nome: rascunho.nome.trim(),
      tipo: rascunho.tipo,
      plano: rascunho.plano.trim() || "teste",
      situacao: rascunho.situacao,
      limite_empresas: limite(rascunho.limiteEmpresas),
      limite_usuarios: limite(rascunho.limiteUsuarios),
    };
    const { error } = rascunho.id
      ? await supabase.from("contas").update(dados).eq("id", rascunho.id)
      : await supabase.from("contas").insert(dados);
    setSalvando(false);
    if (error) {
      toast({ title: "Não foi possível salvar a conta", description: mensagemDoErroDoProcesso(error, "Tente de novo."), variant: "destructive" });
      return;
    }
    toast({ title: rascunho.id ? "Conta atualizada" : "Conta criada", description: dados.nome });
    setRascunho(null);
    await carregar();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas</h1>
          <p className="text-muted-foreground">Quem assina o Peter: consultorias (com a carteira de empresas) e empresas que assinam direto.</p>
        </div>
        <Button onClick={() => setRascunho({ ...vazio })}><Plus className="mr-2 h-4 w-4" /> Nova conta</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todas as contas</CardTitle>
          <CardDescription>O administrador de cada conta é definido pelo convite (próxima etapa). Limite em branco = sem limite.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-center">Empresas</TableHead>
                  <TableHead>Administradores</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando contas...</TableCell></TableRow>
                ) : contas.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma conta.</TableCell></TableRow>
                ) : (
                  contas.map((conta) => (
                    <TableRow key={conta.id}>
                      <TableCell className="font-medium">{conta.nome}</TableCell>
                      <TableCell>{TIPO[conta.tipo] ?? conta.tipo}</TableCell>
                      <TableCell>{conta.plano}</TableCell>
                      <TableCell><Badge variant={conta.situacao === "ativa" ? "secondary" : "destructive"}>{SITUACAO[conta.situacao] ?? conta.situacao}</Badge></TableCell>
                      <TableCell className="text-center">{conta.empresas}{conta.limite_empresas !== null ? ` / ${conta.limite_empresas}` : ""}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">{conta.administradores || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Editar ${conta.nome}`}
                          onClick={() => setRascunho({
                            id: conta.id,
                            nome: conta.nome,
                            tipo: conta.tipo === "empresa" ? "empresa" : "consultoria",
                            plano: conta.plano,
                            situacao: (conta.situacao as Rascunho["situacao"]) ?? "ativa",
                            limiteEmpresas: conta.limite_empresas?.toString() ?? "",
                            limiteUsuarios: conta.limite_usuarios?.toString() ?? "",
                          })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(rascunho)} onOpenChange={(aberto) => !aberto && setRascunho(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{rascunho?.id ? "Editar conta" : "Nova conta"}</DialogTitle>
            <DialogDescription>Plano, situação e limites valem para todas as empresas da conta.</DialogDescription>
          </DialogHeader>
          {rascunho && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="conta-nome">Nome</Label>
                <Input id="conta-nome" value={rascunho.nome} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conta-tipo">Tipo</Label>
                <Select value={rascunho.tipo} onValueChange={(valor) => setRascunho({ ...rascunho, tipo: valor as Rascunho["tipo"] })}>
                  <SelectTrigger id="conta-tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultoria">Consultoria</SelectItem>
                    <SelectItem value="empresa">Empresa direta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conta-situacao">Situação</Label>
                <Select value={rascunho.situacao} onValueChange={(valor) => setRascunho({ ...rascunho, situacao: valor as Rascunho["situacao"] })}>
                  <SelectTrigger id="conta-situacao"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="suspensa">Suspensa</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="conta-plano">Plano</Label>
                <Input id="conta-plano" value={rascunho.plano} onChange={(e) => setRascunho({ ...rascunho, plano: e.target.value })} placeholder="teste" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conta-limite-empresas">Limite de empresas</Label>
                <Input id="conta-limite-empresas" inputMode="numeric" value={rascunho.limiteEmpresas} onChange={(e) => setRascunho({ ...rascunho, limiteEmpresas: e.target.value })} placeholder="sem limite" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conta-limite-usuarios">Limite de usuários</Label>
                <Input id="conta-limite-usuarios" inputMode="numeric" value={rascunho.limiteUsuarios} onChange={(e) => setRascunho({ ...rascunho, limiteUsuarios: e.target.value })} placeholder="sem limite" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRascunho(null)}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando || !rascunho?.nome.trim()}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConfigContas;
