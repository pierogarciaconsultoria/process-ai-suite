import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, FileText, GitBranch, Loader2, MessageSquare, Workflow } from "lucide-react";
import { CicloProcesso } from "@/components/processo/CicloProcesso";
import { EditorSecao } from "@/components/relatorio/EditorSecao";
import { RelatorioProcesso } from "@/components/relatorio/RelatorioProcesso";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { atualizacaoDaAcao, DOCUMENTACAO_BLOQUEADA, podeGerarDocumentacao, type AcaoCiclo } from "@/lib/ciclo-processo";
import { atualizacaoDaSecao, type RascunhoSecao, type SecaoEditavel } from "@/lib/edicao-processo";
import { buscarProcessoComMesmoNome, chaveDoNome, mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";
import { indicadoresAindaNaoEnviados, ultimaMedicao, type Indicador, type Medicao } from "@/lib/indicadores";
import { acoesAindaNaoEnviadas, type Acao } from "@/lib/plano-de-acao";
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
  const [editando, setEditando] = useState<SecaoEditavel | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);

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

  // As ações do processo no Plano de Ação; sem a tabela (migration ainda não aplicada), o relatório segue sem elas.
  const processoId = processo?.id;
  const empresaDoProcesso = processo?.company_id;
  useEffect(() => {
    if (!processoId || !empresaDoProcesso) return;
    let ativo = true;
    void supabase
      .from("acoes")
      .select("*")
      .eq("processo_id", processoId)
      .eq("company_id", empresaDoProcesso)
      .order("created_at")
      .then(({ data, error }) => {
        if (error) console.warn("Plano de Ação indisponível:", error);
        else if (ativo) setAcoes(data ?? []);
      });
    void supabase
      .from("indicadores")
      .select("*")
      .eq("processo_id", processoId)
      .eq("company_id", empresaDoProcesso)
      .order("nome")
      .then(async ({ data, error }) => {
        if (error) {
          console.warn("Indicadores indisponíveis:", error);
          return;
        }
        const lista = data ?? [];
        const { data: resultados } = lista.length
          ? await supabase.from("indicador_medicoes").select("*").in("indicador_id", lista.map((item) => item.id)).order("periodo")
          : { data: [] as Medicao[] };
        if (!ativo) return;
        setIndicadores(lista);
        setMedicoes(resultados ?? []);
      });
    return () => {
      ativo = false;
    };
  }, [processoId, empresaDoProcesso]);

  const relatorio = useMemo(() => (processo ? montarRelatorio(processo) : null), [processo]);
  const acoesPendentes = useMemo(() => (processo ? acoesAindaNaoEnviadas(processo, acoes, "").length : 0), [processo, acoes]);
  const indicadoresPendentes = useMemo(() => (processo ? indicadoresAindaNaoEnviados(processo, indicadores, "").length : 0), [processo, indicadores]);
  const acompanhados = useMemo(
    () => indicadores.map((indicador) => ({ indicador, ultima: ultimaMedicao(medicoes, indicador.id) })),
    [indicadores, medicoes],
  );

  const enviarIndicadores = async () => {
    if (!processo) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada. Entre de novo.");
      const novos = indicadoresAindaNaoEnviados(processo, indicadores, auth.user.id);
      if (novos.length === 0) return;
      const { data, error } = await supabase.from("indicadores").insert(novos).select("*");
      if (error) throw error;
      setIndicadores((atuais) => [...atuais, ...(data ?? [])]);
      toast({ title: `${novos.length === 1 ? "1 indicador enviado" : `${novos.length} indicadores enviados`} para Indicadores`, description: "Confira a meta de cada um antes de lançar os resultados." });
    } catch (error) {
      console.error("Erro ao enviar indicadores:", error);
      toast({ title: "Não foi possível enviar os indicadores", description: mensagemDoErroDoProcesso(error, "Tente novamente."), variant: "destructive" });
    }
  };

  const enviarAcoes = async () => {
    if (!processo) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada. Entre de novo.");
      const novas = acoesAindaNaoEnviadas(processo, acoes, auth.user.id);
      if (novas.length === 0) return;
      const { data, error } = await supabase.from("acoes").insert(novas).select("*");
      if (error) throw error;
      setAcoes((atuais) => [...atuais, ...(data ?? [])]);
      toast({ title: `${novas.length === 1 ? "1 ação enviada" : `${novas.length} ações enviadas`} ao Plano de Ação` });
    } catch (error) {
      console.error("Erro ao enviar ações:", error);
      toast({ title: "Não foi possível enviar as ações", description: mensagemDoErroDoProcesso(error, "Tente novamente."), variant: "destructive" });
    }
  };
  const entrevistaEmAndamento = relatorio?.entrevista ? !relatorio.entrevista.concluida : false;
  const documentacaoLiberada = podeGerarDocumentacao(processo?.status);

  const salvarSecao = async (secao: SecaoEditavel, rascunho: RascunhoSecao): Promise<boolean> => {
    if (!processo) return false;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada. Entre de novo.");
      const atualizacao = atualizacaoDaSecao(processo, secao, rascunho, auth.user.id);
      if (typeof atualizacao.nome === "string") {
        if (!chaveDoNome(atualizacao.nome)) throw new Error("Informe o nome do processo.");
        const existente = await buscarProcessoComMesmoNome(processo.company_id, atualizacao.nome, processo.id);
        if (existente) throw new Error(`Já existe um processo chamado "${existente.nome}" nesta empresa. Use outro nome.`);
      }
      const { data, error } = await supabase
        .from("processos")
        .update(atualizacao)
        .eq("id", processo.id)
        .eq("company_id", processo.company_id)
        .select("*")
        .single();
      if (error) throw error;
      setProcesso(data);
      toast({ title: "Alterações salvas" });
      return true;
    } catch (error) {
      console.error("Erro ao salvar a seção:", error);
      toast({ title: "Não foi possível salvar", description: mensagemDoErroDoProcesso(error, "Tente novamente."), variant: "destructive" });
      return false;
    }
  };

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
            <Button variant="outline" onClick={() => navigate(`/processos/${id}/mapa`)}>
              <Workflow className="mr-2 h-4 w-4" /> Editar mapa
            </Button>
            <Button
              variant="outline"
              disabled={!documentacaoLiberada}
              title={documentacaoLiberada ? undefined : DOCUMENTACAO_BLOQUEADA}
              onClick={() => navigate(`/documentos?processId=${id}&mode=linked_process`)}
            >
              <FileText className="mr-2 h-4 w-4" /> Criar procedimento
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
          <RelatorioProcesso
            relatorio={relatorio}
            onEditar={setEditando}
            onEditarMapa={() => navigate(`/processos/${id}/mapa`)}
            acoes={acoes}
            acoesPendentes={acoesPendentes}
            onEnviarAcoes={() => void enviarAcoes()}
            onAbrirPlanoDeAcao={() => navigate(`/plano-de-acao?processo=${id}`)}
            indicadores={acompanhados}
            indicadoresPendentes={indicadoresPendentes}
            onEnviarIndicadores={() => void enviarIndicadores()}
            onAbrirIndicadores={() => navigate(`/indicadores?processo=${id}`)}
          />
          <EditorSecao processo={processo!} secao={editando} onFechar={() => setEditando(null)} onSalvar={salvarSecao} indicadoresNoModulo={indicadores.length > 0} />
        </>
      )}
    </div>
  );
};

export default ProcessoDetalhe;
