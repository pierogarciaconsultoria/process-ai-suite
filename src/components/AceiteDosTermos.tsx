import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { VERSAO_DOCUMENTOS_LEGAIS } from "@/data/documentos-legais";

type Estado = "verificando" | "pendente" | "aceito";

async function registrarAceite(): Promise<{ ok: boolean }> {
  const { error } = await supabase.from("aceites_termos").insert({ versao: VERSAO_DOCUMENTOS_LEGAIS });
  // 23505: a versão já estava aceita (outra aba, por exemplo).
  return { ok: !error || error.code === "23505" };
}

// Antes das telas do app: o usuário precisa ter aceitado a versão vigente da Política de
// privacidade e dos Termos de uso (tabela aceites_termos, migration 202611150002).
export function AceiteDosTermos({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [marcado, setMarcado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await supabase
        .from("aceites_termos")
        .select("id")
        .eq("versao", VERSAO_DOCUMENTOS_LEGAIS)
        .limit(1);
      if (!ativo) return;
      if (error) {
        // Sem a tabela (migration ainda não aplicada) ou falha de rede: não bloqueia o uso.
        console.warn("[aceite] não foi possível verificar o aceite dos termos:", error.code);
        setEstado("aceito");
        return;
      }
      if (data && data.length > 0) {
        setEstado("aceito");
        return;
      }
      // Quem marcou o aceite no cadastro registra aqui, no primeiro acesso.
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.user_metadata?.aceite_termos_versao === VERSAO_DOCUMENTOS_LEGAIS) {
        const { ok } = await registrarAceite();
        if (!ativo) return;
        if (ok) {
          setEstado("aceito");
          return;
        }
      }
      if (ativo) setEstado("pendente");
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const aceitar = async () => {
    setSalvando(true);
    setErro("");
    const { ok } = await registrarAceite();
    setSalvando(false);
    if (ok) setEstado("aceito");
    else setErro("Não foi possível registrar o aceite. Tente de novo.");
  };

  if (estado === "aceito") return <>{children}</>;

  if (estado === "verificando") {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> Carregando...
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <CardTitle>Antes de continuar</CardTitle>
          <CardDescription className="text-foreground/80">
            Para usar o Peter, leia e aceite a Política de privacidade e os Termos de uso. Eles explicam quais dados tratamos, com quem
            compartilhamos (como a OpenAI, que processa o conteúdo para gerar as respostas) e as regras de uso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <Checkbox id="aceite-termos" checked={marcado} onCheckedChange={(valor) => setMarcado(valor === true)} className="mt-0.5" />
            <Label htmlFor="aceite-termos" className="font-normal leading-relaxed">
              Li e aceito a{" "}
              <Link to="/privacidade" target="_blank" rel="noopener" className="text-primary underline">Política de privacidade</Link> e os{" "}
              <Link to="/termos" target="_blank" rel="noopener" className="text-primary underline">Termos de uso</Link>.
            </Label>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => void supabase.auth.signOut()}>Sair</Button>
            <Button onClick={() => void aceitar()} disabled={!marcado || salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />} Aceitar e continuar
            </Button>
          </div>
          {erro && <p className="text-destructive" role="alert">{erro}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
