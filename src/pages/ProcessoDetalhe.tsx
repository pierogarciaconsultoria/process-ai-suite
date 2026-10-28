import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, FileText, GitBranch, Loader2, MessageSquare, Pencil } from "lucide-react";
import { CicloProcesso } from "@/components/processo/CicloProcesso";
import { RelatorioProcesso } from "@/components/relatorio/RelatorioProcesso";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { atualizacaoDaAcao, DOCUMENTACAO_BLOQUEADA, podeGerarDocumentacao, type AcaoCiclo } from "@/lib/ciclo-processo";
import { montarRelatorio } from "@/lib/relatorio-processo";
import type { Tables } from "@/integrations/supabase/types";

// O PDF sai pela impressão do navegador ("Salvar como PDF"); o título vira o nome sugerido do arquivo.
function imprimirComTitulo(titulo: string) {
  const tituloAnterior = document.title;
  document.title = titulo;
  const restaurar = () => {
    document.title = tituloAnterior;
    window.removeEventListener("afterprint", restaurar);
  };
  window.addEventListener("afterprint", restaurar);
  window.print();
}

const ProcessoDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const relatorio = useMemo(() => (processo ? montarRelatorio(processo) : null), [processo]);
  const entrevistaEmAndamento = relatorio?.entrevista ? !relatorio.entrevista.concluida : false;
  const documentacaoLiberada = podeGerarDocumentacao(processo?.status);

  const executarAcao = async (acao: AcaoCiclo) => {
    if (!processo) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("processos")
        .update({ ...atualizacaoDaAcao(acao, new Date().toISOString(), processo.mapa_aprovado_em), updated_by: auth.user?.id ?? null })
        .eq("id", processo.id)
        .eq("company_id", processo.company_id)
        .select("*")
        .single();
      if (error) throw error;
      setProcesso(data);
      toast({ title: `Processo agora está "${data.status}".` });
    } catch (error) {
      console.error("Erro ao atualizar o ciclo do processo:", error);
      toast({ title: "Não foi possível atualizar o processo", description: "Verifique sua conexão e tente novamente.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="no-print flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate("/processos")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        {relatorio && (
          <>
            {entrevistaEmAndamento && (
              <Button onClick={() => navigate(`/processos/${id}/entrevista`)}>
                <MessageSquare className="mr-2 h-4 w-4" /> Retomar entrevista
              </Button>
            )}
            <Button variant={entrevistaEmAndamento ? "outline" : "default"} onClick={() => imprimirComTitulo(`Relatório - ${relatorio.nome}`)}>
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </Button>
            {!relatorio.bpmnAsIs && !entrevistaEmAndamento && (
              <Button variant="outline" onClick={() => navigate(`/processos/${id}/resultado-guiado`, { state: { autoGenerate: true } })}>
                <GitBranch className="mr-2 h-4 w-4" /> Gerar mapa AS IS
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!documentacaoLiberada}
              title={documentacaoLiberada ? undefined : DOCUMENTACAO_BLOQUEADA}
              onClick={() => navigate(`/documentos?processId=${id}&mode=linked_process`)}
            >
              <FileText className="mr-2 h-4 w-4" /> Criar procedimento
            </Button>
            <Button variant="outline" onClick={() => navigate(`/processos/${id}/editar`)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando processo...
          </CardContent>
        </Card>
      ) : !relatorio ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Processo não encontrado ou dados ainda não cadastrados.
          </CardContent>
        </Card>
      ) : (
        <>
          <CicloProcesso status={processo!.status} onAcao={executarAcao} />
          <RelatorioProcesso relatorio={relatorio} />
        </>
      )}
    </div>
  );
};

export default ProcessoDetalhe;
