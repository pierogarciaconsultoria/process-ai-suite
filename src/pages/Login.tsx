import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isSignupMode, setIsSignupMode] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "signup") setIsSignupMode(true);
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/dashboard");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Erro ao entrar", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome, empresa },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;
      toast({
        title: "Conta criada",
        description: "Verifique seu e-mail para confirmar o cadastro. Após confirmar, acesse com suas credenciais.",
      });
      setIsSignupMode(false);
      setNome("");
      setEmpresa("");
      setEmail("");
      setPassword("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Erro no cadastro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "Email enviado", description: "Verifique sua caixa de entrada para redefinir sua senha." });
      setIsResetMode(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mb-4">
            <Network className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Process Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">by Piero Garcia</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{isResetMode ? "Recuperar Senha" : isSignupMode ? "Criar Conta" : "Entrar"}</CardTitle>
            <CardDescription>
              {isResetMode
                ? "Informe seu email para receber o link de recuperação"
                : isSignupMode
                ? "Crie sua conta e comece a gerenciar seus processos"
                : "Acesse sua conta para gerenciar seus processos"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isResetMode ? handleResetPassword : isSignupMode ? handleSignup : handleLogin} className="space-y-4">
              {isSignupMode ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="empresa">Empresa</Label>
                      <Input id="empresa" placeholder="Nome da empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome">Seu nome</Label>
                      <Input id="nome" placeholder="Seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  {!isResetMode && (
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative">
                        <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Aguarde..." : isResetMode ? "Enviar Link" : isSignupMode ? "Criar Conta" : "Entrar"}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setIsResetMode(!isResetMode)} className="w-full text-sm text-primary hover:underline">
                  {isResetMode ? "Voltar ao login" : "Esqueci minha senha"}
                </button>
                <button type="button" onClick={() => setIsSignupMode(!isSignupMode)} className="w-full text-sm text-primary hover:underline">
                  {isSignupMode ? "Já tenho conta" : "Criar conta"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
