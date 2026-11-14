import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { trocarEmpresaAtiva } from "@/lib/empresa-ativa";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";
import { PAPEL_CONTA, TIPO_CONTA } from "@/lib/contas";

type Convite = { conta_nome: string; conta_tipo: string; papel: string; email: string; status: string; expirado: boolean };

// Convite para uma conta (consultoria ou empresa): quem recebe entra com o e-mail convidado e aceita.
const ConviteConta = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [convite, setConvite] = useState<Convite | null>(null);
  const [emailLogado, setEmailLogado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const [{ data: info, error }, { data: auth }] = await Promise.all([
        supabase.rpc("convite_conta_info", { _token: token }),
        supabase.auth.getUser(),
      ]);
      if (!ativo) return;
      setEmailLogado(auth.user?.email?.toLowerCase() ?? null);
      const primeiro = Array.isArray(info) ? (info[0] as Convite | undefined) : undefined;
      if (error || !primeiro) setErro("Convite não encontrado. Confira o link ou peça um novo.");
      else setConvite(primeiro);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [token]);

  const aceitar = async () => {
    setAceitando(true);
    setErro("");
    const { error } = await supabase.rpc("aceitar_convite_conta", { _token: token });
    setAceitando(false);
    if (error) {
      setErro(mensagemDoErroDoProcesso(error, "Não foi possível aceitar o convite."));
      return;
    }
    // A primeira empresa da conta vira a ativa ao entrar (se houver).
    const { data: empresas } = await supabase.rpc("empresas_do_usuario");
    const primeira = Array.isArray(empresas) ? (empresas[0] as { id: string; nome: string } | undefined) : undefined;
    if (primeira) trocarEmpresaAtiva(primeira.id, primeira.nome);
    navigate("/inicio");
  };

  const pendente = convite?.status === "pendente" && !convite.expirado;
  const emailCerto = Boolean(convite && emailLogado && convite.email === emailLogado);
  const voltarAqui = `/login?redirect=${encodeURIComponent(`/convite-conta/${token}`)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><Network className="h-6 w-6 text-primary" /></div>
          <CardTitle>Convite para o Peter</CardTitle>
          {convite && (
            <CardDescription>
              Você foi convidado para a {TIPO_CONTA[convite.conta_tipo]?.toLowerCase() ?? "conta"} <strong className="text-foreground">{convite.conta_nome}</strong> como{" "}
              <strong className="text-foreground">{PAPEL_CONTA[convite.papel] ?? convite.papel}</strong>.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {carregando ? (
            <p className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o convite...</p>
          ) : !convite ? null : !pendente ? (
            <p className="text-center text-muted-foreground">
              {convite.status === "aceito" ? "Este convite já foi usado." : convite.status === "revogado" ? "Este convite foi cancelado." : "Este convite expirou."} Peça um novo ao administrador da conta.
            </p>
          ) : !emailLogado ? (
            <>
              <p className="text-center text-muted-foreground">Entre ou crie seu acesso com o e-mail <strong className="text-foreground">{convite.email}</strong> para aceitar.</p>
              <Button className="w-full" asChild><Link to={voltarAqui}>Entrar ou criar acesso</Link></Button>
            </>
          ) : !emailCerto ? (
            <>
              <p className="text-center text-muted-foreground">
                Você está conectado como <strong className="text-foreground">{emailLogado}</strong>, mas o convite é para <strong className="text-foreground">{convite.email}</strong>.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void supabase.auth.signOut().then(() => navigate(voltarAqui))}
              >
                Sair e entrar com {convite.email}
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={() => void aceitar()} disabled={aceitando}>
              {aceitando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Aceitar convite
            </Button>
          )}
          {erro && <p className="text-center text-destructive" role="alert">{erro}</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConviteConta;
