import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { montarRelatorio } from "@/lib/relatorio-processo";

const Relatorios = () => {
  const navigate = useNavigate();
  const [processos, setProcessos] = useState<Tables<"processos">[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const empresa = await resolveAccessibleCompanyId(auth.user?.id ?? null);
        if (!empresa) {
          if (ativo) setProcessos([]);
          return;
        }
        const { data, error } = await supabase
          .from("processos")
          .select("*")
          .eq("company_id", empresa)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        if (ativo) setProcessos(data ?? []);
      } catch (error) {
        console.error("Erro ao carregar relatórios:", error);
        if (ativo) setErro(true);
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const relatorios = useMemo(
    () => processos.map((processo) => ({ processo, relatorio: montarRelatorio(processo) })),
    [processos],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Relatório de diagnóstico de cada processo mapeado, pronto para baixar em PDF.</p>
      </div>

      {carregando ? (
        <Card><CardContent className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando relatórios...</CardContent></Card>
      ) : erro ? (
        <Card><CardContent className="py-8 text-muted-foreground">Não foi possível carregar os relatórios. Atualize a página e tente novamente.</CardContent></Card>
      ) : relatorios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="text-muted-foreground">Nenhum processo mapeado ainda. O relatório é gerado a partir da entrevista com o Peter.</p>
            <Button onClick={() => navigate("/processos/novo/entrevista", { state: { guidedExperience: true } })}>Mapear um processo</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {relatorios.map(({ processo, relatorio }) => {
            const completo = Boolean(relatorio.diagnostico && relatorio.plano);
            return (
              <Card key={processo.id}>
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{relatorio.nome}</p>
                        <Badge variant={completo ? "default" : "secondary"}>{completo ? "Completo" : "Parcial"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[relatorio.area, `atualizado em ${new Date(processo.updated_at).toLocaleDateString("pt-BR")}`].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-fit" onClick={() => navigate(`/processos/${processo.id}`)}>
                    Abrir relatório
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Relatorios;
