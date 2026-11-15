import { useState } from "react";
import { Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";

type Resultado = { item: string; quantidade: number };

// Plataforma: aplica agora os prazos de guarda (migration 202611150003). Com o pg_cron ativo,
// a mesma rotina roda sozinha todo dia.
export function PrazosDeGuarda() {
  const { toast } = useToast();
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<Resultado[] | null>(null);

  const aplicar = async () => {
    setAplicando(true);
    const { data, error } = await supabase.rpc("aplicar_prazos_de_guarda");
    setAplicando(false);
    if (error) {
      toast({ title: "Não foi possível aplicar os prazos", description: mensagemDoErroDoProcesso(error, "Tente de novo."), variant: "destructive" });
      return;
    }
    setResultado((data ?? []) as Resultado[]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Timer className="h-4 w-4 text-primary" aria-hidden /> Prazos de guarda</CardTitle>
        <CardDescription className="text-foreground/80">
          Texto de anexos do chat some depois de 90 dias (o nome do arquivo fica). Conversas sem mensagem nova há 12 meses são excluídas.
          Empresas de contas canceladas são excluídas 30 dias depois do cancelamento. A rotina roda todo dia se o agendamento estiver ativo;
          aqui você aplica agora.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" onClick={() => void aplicar()} disabled={aplicando}>
          {aplicando && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />} Aplicar prazos agora
        </Button>
        {resultado && (
          <ul className="space-y-1 text-sm" aria-live="polite">
            {resultado.map((linha) => (
              <li key={linha.item}>
                {linha.item}: <strong>{linha.quantidade}</strong>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
