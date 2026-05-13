import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import type { Tables } from "@/integrations/supabase/types";

const statusColors: Record<string, string> = {
  Rascunho: "bg-muted text-muted-foreground",
  "Em revisão": "bg-warning text-warning-foreground",
  Aprovado: "bg-primary text-primary-foreground",
  Publicado: "bg-success text-success-foreground",
  Obsoleto: "bg-secondary text-secondary-foreground",
};

const ProcessoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [processo, setProcesso] = useState<Tables<"processos"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadProcesso = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const activeCompanyId = await resolveAccessibleCompanyId(auth.user?.id ?? null);

        if (!activeCompanyId) {
          if (isMounted) setProcesso(null);
          return;
        }

        const { data, error } = await supabase
          .from("processos")
          .select("*")
          .eq("id", id)
          .eq("company_id", activeCompanyId)
          .maybeSingle();

        if (error) throw error;
        if (isMounted) setProcesso(data);
      } catch (error) {
        console.error("Erro ao carregar processo:", error);
        if (isMounted) setProcesso(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadProcesso();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="outline" onClick={() => navigate("/processos")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
      <Card>
        <CardContent className="py-12">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando processo...
            </div>
          ) : !processo ? (
            <div className="text-center text-muted-foreground">
              Processo não encontrado ou dados ainda não cadastrados.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold">{processo.nome}</h1>
                <Badge className={statusColors[processo.status]}>{processo.status}</Badge>
                {processo.mapa_revisao ? <Badge variant="outline">{processo.mapa_revisao}</Badge> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div><span className="font-medium">Área:</span> {processo.area}</div>
                <div><span className="font-medium">Responsável:</span> {processo.responsavel}</div>
                <div><span className="font-medium">Criado em:</span> {new Date(processo.created_at).toLocaleDateString("pt-BR")}</div>
                <div><span className="font-medium">Mapa aprovado em:</span> {processo.mapa_aprovado_em ? new Date(processo.mapa_aprovado_em).toLocaleDateString("pt-BR") : "Não informado"}</div>
                <div><span className="font-medium">Classificação:</span> {processo.classificacao}</div>
                <div><span className="font-medium">Status:</span> {processo.status}</div>
              </div>
              <div className="space-y-2">
                <h2 className="font-medium">Objetivo</h2>
                <p className="text-sm text-muted-foreground">{processo.objetivo || "Não informado"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessoDetalhe;
