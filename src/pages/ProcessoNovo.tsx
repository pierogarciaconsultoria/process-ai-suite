import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, ArrowRight } from "lucide-react";
import type { ProcessoFormData } from "@/data/processo-form-types";

type NovoProcessoState = {
  formPrefill?: ProcessoFormData;
  fromInterview?: boolean;
  focusTab?: string;
} | null;

export default function ProcessoNovo() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as NovoProcessoState;

  useEffect(() => {
    if (state?.focusTab || state?.formPrefill || state?.fromInterview) {
      navigate("/processos/novo/formulario", { replace: true, state });
    }
  }, [navigate, state]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Novo processo</h1>
        <p className="text-muted-foreground">
          Escolha como deseja iniciar o mapeamento. As duas opções alimentam as mesmas informações do processo e levam ao mesmo fluxo de diagnóstico.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle>Preencher formulário</CardTitle>
              <CardDescription>
                Ideal para quem já conhece o processo e prefere registrar os dados manualmente, com acesso direto a todas as abas.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você preenche o mesmo cadastro do processo, com liberdade para navegar entre identificação, dores, operação atual, plano de ação e relatório.
            </p>
            <Button className="w-full" onClick={() => navigate("/processos/novo/formulario", { state })}>
              Ir para o formulário <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle>Ser entrevistado pelo Peter</CardTitle>
              <CardDescription>
                Ideal para quem prefere conversar com a IA e deixar o formulário ser preenchido automaticamente ao longo da entrevista.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O Peter conduz a conversa, organiza o entendimento do processo e preenche os mesmos campos usados no formulário manual.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/processos/novo/entrevista", { state })}>
              Iniciar entrevista <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
