import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Network, Building2, ClipboardList, Sparkles, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupNome, setSignupNome] = useState("");
  const [signupEmpresa, setSignupEmpresa] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingSignup, setLoadingSignup] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingLogin(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      navigate("/dashboard");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Erro ao entrar", description: message, variant: "destructive" });
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSignup(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            nome: signupNome,
            empresa: signupEmpresa,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;
      toast({
        title: "Conta criada",
        description: "Verifique seu e-mail para confirmar o cadastro. Após confirmar, acesse com suas credenciais.",
      });
      setSignupNome("");
      setSignupEmpresa("");
      setSignupEmail("");
      setSignupPassword("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Erro no cadastro", description: message, variant: "destructive" });
    } finally {
      setLoadingSignup(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Network className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Process Intelligence</h1>
              <p className="text-xs text-muted-foreground">Plataforma multi-empresa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/login")} className="no-print">
              Entrar
            </Button>
            <Button onClick={() => document.getElementById("auth-card")?.scrollIntoView({ behavior: "smooth" })} className="no-print">
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <Badge className="w-fit" variant="secondary">Multi-empresa</Badge>
            <h2 className="text-4xl font-bold tracking-tight">
              Orquestre processos, meça maturidade digital e evolua com IA
            </h2>
            <p className="text-muted-foreground">
              Mapeie atividades, identifique gargalos e gere diagnósticos automáticos na escala 0–4.
              Plataforma preparada para múltiplas empresas, usuários e perfis.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => document.getElementById("auth-card")?.scrollIntoView({ behavior: "smooth" })}>
                Começar agora
              </Button>
              <Button variant="outline" onClick={() => navigate("/processos")}>
                Ver funcionalidades
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
              <Card>
                <CardHeader className="flex-row items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-base">Empresas e usuários</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Estruture múltiplas empresas, times e perfis de acesso.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex-row items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-base">Diagnóstico 0–4</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Classificação automática e proposta de evolução do processo.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex-row items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-base">IA aplicada</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Geração de relatório e mapa BPMN com suporte de IA.
                </CardContent>
              </Card>
            </div>
          </div>

          <div id="auth-card" className="scroll-mt-24">
            <Card>
              <CardHeader>
                <CardTitle>Autenticação e Cadastro</CardTitle>
                <CardDescription>Crie sua conta para sua empresa ou entre com suas credenciais.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="signup" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="signup">Criar conta</TabsTrigger>
                    <TabsTrigger value="login">Entrar</TabsTrigger>
                  </TabsList>
                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="empresa">Empresa</Label>
                          <Input id="empresa" placeholder="Nome da empresa" value={signupEmpresa} onChange={(e) => setSignupEmpresa(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nome">Seu nome</Label>
                          <Input id="nome" placeholder="Seu nome completo" value={signupNome} onChange={(e) => setSignupNome(e.target.value)} required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email-signup">Email</Label>
                        <Input id="email-signup" type="email" placeholder="seu@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password-signup">Senha</Label>
                        <Input id="password-signup" type="password" placeholder="••••••••" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                      </div>
                      <Button type="submit" className="w-full" disabled={loadingSignup}>
                        {loadingSignup ? "Cadastrando..." : "Criar conta"}
                      </Button>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Seus dados são protegidos e você pode excluir a conta a qualquer momento.
                      </p>
                    </form>
                  </TabsContent>
                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email-login">Email</Label>
                        <Input id="email-login" type="email" placeholder="seu@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password-login">Senha</Label>
                        <Input id="password-login" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                      </div>
                      <div className="flex items-center justify-between">
                        <Button type="submit" disabled={loadingLogin}>
                          {loadingLogin ? "Entrando..." : "Entrar"}
                        </Button>
                        <button type="button" className="text-sm text-primary hover:underline" onClick={() => navigate("/login")}>
                          Recuperar senha
                        </button>
                      </div>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex-row items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Users className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-base">Perfis de acesso</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Convide usuários e defina perfis (admin, gestor, analista).
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex-row items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-base">Relatórios com IA</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Gere diagnósticos e PDF de forma automática para sua empresa.
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Process Intelligence — Plataforma multi-empresa
        </div>
      </footer>
    </div>
  );
}
