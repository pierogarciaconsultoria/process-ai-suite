import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type InvitePayload = {
  id: string;
  email: string;
  perfil: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  empresa: { id: string; nome: string } | null;
};

const ConviteAceite = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadInvite = useCallback(async () => {
    if (!token) {
      setErrorMessage("Convite inválido.");
      setLoadingInvite(false);
      return;
    }

    setLoadingInvite(true);
    const { data, error } = await supabase.functions.invoke("org-accept-invite", {
      body: { token, action: "inspect" },
    });

    if (error) {
      setInvite(null);
      setErrorMessage(error.message);
      setLoadingInvite(false);
      return;
    }

    if (!data?.invite) {
      setInvite(null);
      setErrorMessage("Convite não encontrado.");
      setLoadingInvite(false);
      return;
    }

    setInvite(data.invite as InvitePayload);
    setErrorMessage("");
    setLoadingInvite(false);
  }, [token]);

  useEffect(() => {
    loadInvite();
  }, [loadInvite]);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserEmail(data.user?.email?.toLowerCase() ?? null);
    };

    loadUser();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email?.toLowerCase() ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (!invite) return "";
    if (invite.status === "accepted") return "Aceito";
    if (invite.status === "revoked" && invite.revoked_reason === "expired") return "Expirado";
    if (invite.status === "revoked" && invite.revoked_reason === "cancelled") return "Cancelado";
    if (invite.status === "revoked") return "Revogado";
    return "Pendente";
  }, [invite]);

  const loginHref = invite
    ? `/login?email=${encodeURIComponent(invite.email)}&redirect=${encodeURIComponent(`/convite/${token}`)}`
    : "/login";
  const signupHref = `${loginHref}&mode=signup`;
  const emailMatchesInvite = Boolean(invite && userEmail && invite.email.toLowerCase() === userEmail);

  const acceptInvite = async () => {
    if (!token) return;
    setAccepting(true);

    const { data, error } = await supabase.functions.invoke("org-accept-invite", {
      body: { token, action: "accept" },
    });

    setAccepting(false);

    if (error) {
      toast({
        title: "Não foi possível aceitar o convite",
        description: error.message,
        variant: "destructive",
      });
      await loadInvite();
      return;
    }

    const acceptedInvite = data?.invite as InvitePayload | undefined;
    if (acceptedInvite?.empresa?.id && acceptedInvite.empresa?.nome) {
      localStorage.setItem("process:activeEmpresaId", acceptedInvite.empresa.id);
      localStorage.setItem("process:activeEmpresaNome", acceptedInvite.empresa.nome);
    }

    if (acceptedInvite) {
      setInvite(acceptedInvite);
    }

    toast({
      title: "Convite aceito",
      description: "A empresa já está disponível na sua conta.",
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mb-4">
            <Network className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Aceite de Convite</h1>
          <p className="text-sm text-muted-foreground mt-1">Process Intelligence</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Convite para empresa</CardTitle>
            <CardDescription>Valide o convite, autentique-se com o email convidado e confirme o acesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingInvite ? (
              <div className="text-sm text-muted-foreground">Carregando convite...</div>
            ) : errorMessage ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{errorMessage}</p>
                <Button variant="outline" onClick={() => navigate("/login")}>Ir para login</Button>
              </div>
            ) : invite ? (
              <>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant="secondary">{statusLabel}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Empresa</span>
                    <span className="text-sm font-medium">{invite.empresa?.nome ?? "Empresa não encontrada"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Email convidado</span>
                    <span className="text-sm font-medium">{invite.email}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Perfil</span>
                    <span className="text-sm font-medium capitalize">{invite.perfil}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Expira em</span>
                    <span className="text-sm font-medium">{new Date(invite.expires_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>

                {!userEmail ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Faça login ou crie sua conta com o email <strong>{invite.email}</strong> para concluir o aceite.
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <Button asChild>
                        <Link to={loginHref}>Entrar para aceitar</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to={signupHref}>Criar conta</Link>
                      </Button>
                    </div>
                  </div>
                ) : invite.status === "accepted" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-foreground">Este convite já foi aceito e a empresa já pode ser acessada na sua conta.</p>
                    <div className="flex gap-3 flex-wrap">
                      <Button onClick={() => navigate("/dashboard")}>Ir para o dashboard</Button>
                      <Button variant="outline" onClick={handleSignOut}>Sair</Button>
                    </div>
                  </div>
                ) : invite.status === "revoked" ? (
                  <p className="text-sm text-muted-foreground">
                    {invite.revoked_reason === "expired"
                      ? "Este convite expirou. Solicite um novo convite ao administrador da empresa."
                      : "Este convite não está mais disponível. Solicite um novo convite ao administrador da empresa."}
                  </p>
                ) : emailMatchesInvite ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Você está autenticado com o email correto. Clique abaixo para concluir o vínculo com a empresa.
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <Button onClick={acceptInvite} disabled={accepting}>
                        {accepting ? "Aceitando..." : "Aceitar convite"}
                      </Button>
                      <Button variant="outline" onClick={handleSignOut}>Entrar com outro email</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-destructive">
                      Você está autenticado como <strong>{userEmail}</strong>, mas o convite foi enviado para <strong>{invite.email}</strong>.
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <Button variant="outline" onClick={handleSignOut}>Sair</Button>
                      <Button asChild>
                        <Link to={loginHref}>Entrar com o email convidado</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConviteAceite;
