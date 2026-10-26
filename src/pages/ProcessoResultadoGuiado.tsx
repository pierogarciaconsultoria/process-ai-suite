import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import BPMNCanvas from "@/components/BPMNCanvas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DiagnosticoResult, ProcessoFormData } from "@/data/processo-form-types";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { mapProcessRowToForm } from "@/lib/processos";
import { buildMappedProcessPayload } from "@/data/documentation-config";
import { RelatorioProcesso } from "@/components/relatorio/RelatorioProcesso";
import { montarRelatorio } from "@/lib/relatorio-processo";

type GenerationState = "idle" | "loading" | "ready" | "error";

const hasFunctionError = (value: unknown): value is { error: string } =>
  typeof value === "object" && value !== null && "error" in value;

function ReportContent({ diagnosis }: { diagnosis: DiagnosticoResult }) {
  const entries = Object.entries(diagnosis as unknown as Record<string, unknown>);
  return (
    <div className="space-y-4">
      {entries.map(([key, value]) => (
        <Card key={key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base capitalize">{key.replace(/([A-Z])/g, " $1")}</CardTitle>
          </CardHeader>
          <CardContent>
            {typeof value === "string" ? (
              <p className="whitespace-pre-wrap text-sm leading-6">{value}</p>
            ) : (
              <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs leading-5">
                {JSON.stringify(value, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ProcessoResultadoGuiado() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { processo?: ProcessoFormData; autoGenerate?: boolean } | null;
  const [processForm, setProcessForm] = useState<ProcessoFormData | null>(routeState?.processo ?? null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosticoResult | null>(null);
  const [bpmnXml, setBpmnXml] = useState("");
  const [state, setState] = useState<GenerationState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processRow, setProcessRow] = useState<Tables<"processos"> | null>(null);
  const [generatedDocument, setGeneratedDocument] = useState<{ title: string; content_markdown: string } | null>(null);
  const [documentLoading, setDocumentLoading] = useState<string | null>(null);
  const startedRef = useRef(false);

  const loadProcess = useCallback(async () => {
    if (!id) throw new Error("Processo não identificado.");
    const { data, error } = await supabase.from("processos").select("*").eq("id", id).single();
    if (error || !data) throw error || new Error("Processo não encontrado.");
    const row = data as Tables<"processos">;
    setProcessRow(row);
    const form = routeState?.processo ?? mapProcessRowToForm(row);
    setProcessForm(form);
    setCompanyId(row.company_id);
    setBpmnXml(row.bpmn_as_is || "");
    setDiagnosis((row.diagnostico as unknown as DiagnosticoResult | null) ?? null);
    // Vindo da entrevista guiada, o diagnóstico já foi feito e validado lá.
    const diagnosticoDaEntrevista = Boolean(montarRelatorio(row).diagnostico);
    return { row, form, diagnosticoDaEntrevista };
  }, [id, routeState?.processo]);

  const gerarDocumento = async (documentType: "raci" | "ficha_processo" | "pop_v5") => {
    if (!id || !processRow) return;
    const mappedProcessData = buildMappedProcessPayload(processRow);
    if (!mappedProcessData) return;
    const labels = { raci: "Matriz RACI", ficha_processo: "Ficha do Processo", pop_v5: "POP — Metodologia v5" };
    setDocumentLoading(documentType);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-document", {
        body: {
          template: { id: documentType, name: labels[documentType], type: documentType, documentType },
          sections: [],
          mappedProcessData,
          manualDescription: null,
          generationConfig: { documentType },
          companyContext: { companyId: processRow.company_id },
          process_id: id,
          use_peter_assistant: true,
        },
      });
      if (error || hasFunctionError(data)) throw error || new Error(data.error);
      setGeneratedDocument({
        title: String(data?.title || labels[documentType]),
        content_markdown: String(data?.content_markdown || ""),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível gerar o documento.");
    } finally {
      setDocumentLoading(null);
    }
  };

  const generate = useCallback(async () => {
    if (!id) return;
    setState("loading");
    setErrorMessage(null);
    try {
      const { row, form, diagnosticoDaEntrevista } = await loadProcess();
      const [diagnosisResult, bpmnResult] = await Promise.allSettled([
        diagnosticoDaEntrevista
          ? Promise.resolve(null)
          : supabase.functions.invoke("ai-diagnose-process", {
            body: { company_id: row.company_id, process_id: id, processoData: form, use_peter_assistant: true },
          }),
        supabase.functions.invoke("ai-generate-bpmn", {
          body: {
            company_id: row.company_id,
            process_id: id,
            nomeProcesso: form.nomeProcesso,
            etapas: form.etapas,
            decisoes: form.decisoes,
            gatilho: form.gatilho,
            entradas: form.entradas,
            saidas: form.saidas,
            resumo: form.objetivo || form.problemasTexto,
            mode: "as-is",
            use_peter_assistant: true,
          },
        }),
      ]);

      const update: { diagnostico?: Json; bpmn_as_is?: string; updated_by?: string } = {};
      const failures: string[] = [];

      if (diagnosticoDaEntrevista) {
        // Nada a gerar: o relatório usa o diagnóstico da entrevista.
      } else if (diagnosisResult.status === "fulfilled" && diagnosisResult.value && !diagnosisResult.value.error && !hasFunctionError(diagnosisResult.value.data)) {
        const nextDiagnosis = diagnosisResult.value.data as DiagnosticoResult;
        setDiagnosis(nextDiagnosis);
        update.diagnostico = nextDiagnosis as unknown as Json;
      } else {
        failures.push("relatório");
      }

      if (bpmnResult.status === "fulfilled" && !bpmnResult.value.error && !hasFunctionError(bpmnResult.value.data)) {
        const xml = String(bpmnResult.value.data?.xml || "");
        if (xml) {
          setBpmnXml(xml);
          update.bpmn_as_is = xml;
        } else failures.push("mapa BPMN AS IS");
      } else {
        failures.push("mapa BPMN AS IS");
      }

      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.id) update.updated_by = auth.user.id;
      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabase
          .from("processos")
          .update(update)
          .eq("id", id)
          .eq("company_id", row.company_id);
        if (updateError) throw updateError;
      }

      if (failures.length > 0) {
        setState("error");
        setErrorMessage(`Não foi possível gerar ${failures.join(" e ")}. O que foi concluído foi salvo; tente novamente.`);
      } else {
        setState("ready");
      }
    } catch (error) {
      console.error("Erro na conclusão guiada:", error);
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível concluir a geração automática.");
    }
  }, [id, loadProcess]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (routeState?.autoGenerate) void generate();
    else void loadProcess().then(() => setState("ready")).catch((error) => {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Falha ao carregar o resultado.");
    });
  }, [generate, loadProcess, routeState?.autoGenerate]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">Experiência guiada</Badge>
            {state === "ready" && <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Concluído</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{processForm?.nomeProcesso || "Resultado do processo"}</h1>
          <p className="text-muted-foreground">Relatório e mapa AS IS produzidos a partir da entrevista com Peter.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/processos")}><ArrowLeft className="mr-2 h-4 w-4" /> Processos</Button>
          <Button variant="outline" onClick={() => navigate(`/processos/${id}`)} disabled={!id || state === "loading"}>
            <Download className="mr-2 h-4 w-4" /> Relatório em PDF
          </Button>
          <Button onClick={() => navigate(`/documentos?processId=${id}&mode=linked_process`)} disabled={!id || state === "loading"}>
            <FileText className="mr-2 h-4 w-4" /> Criar procedimento
          </Button>
          <Button variant="outline" onClick={() => void gerarDocumento("raci")} disabled={!processRow || Boolean(documentLoading)}>
            {documentLoading === "raci" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "📊"} Gerar Matriz RACI
          </Button>
          <Button variant="outline" onClick={() => void gerarDocumento("ficha_processo")} disabled={!processRow || Boolean(documentLoading)}>
            {documentLoading === "ficha_processo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "📌"} Gerar Ficha do Processo
          </Button>
          <Button variant="outline" onClick={() => void gerarDocumento("pop_v5")} disabled={!processRow || Boolean(documentLoading)}>
            {documentLoading === "pop_v5" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "📄"} Gerar POP (metodologia v5)
          </Button>
        </div>
      </div>

      {state === "loading" && (
        <Card><CardContent className="flex items-center gap-3 py-8"><Loader2 className="h-5 w-5 animate-spin" /><div><p className="font-medium">Peter está concluindo o trabalho</p><p className="text-sm text-muted-foreground">Gerando relatório e mapa BPMN AS IS. Não feche esta página.</p></div></CardContent></Card>
      )}

      {state === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" /><AlertTitle>Geração incompleta</AlertTitle><AlertDescription className="flex flex-col gap-3"><span>{errorMessage}</span><Button variant="outline" className="w-fit" onClick={() => void generate()}><RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente</Button></AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="report" className="space-y-4">
        <TabsList>
          <TabsTrigger value="report">Relatório</TabsTrigger>
          <TabsTrigger value="map">Mapa do Processo AS IS</TabsTrigger>
        </TabsList>
        <TabsContent value="report">
          {processRow ? (
            <div className="space-y-4">
              <RelatorioProcesso relatorio={montarRelatorio({ ...processRow, bpmn_as_is: bpmnXml || processRow.bpmn_as_is })} />
              {diagnosis && !montarRelatorio(processRow).diagnostico && <ReportContent diagnosis={diagnosis} />}
            </div>
          ) : diagnosis ? <ReportContent diagnosis={diagnosis} /> : <Card><CardContent className="py-10 text-center text-muted-foreground">O relatório ainda não foi gerado.</CardContent></Card>}
        </TabsContent>
        <TabsContent value="map">
          {bpmnXml && processForm && companyId ? (
            <Card><CardContent className="pt-6"><BPMNCanvas xml={bpmnXml} onChange={() => undefined} readOnly formData={processForm} mode="as-is" companyId={companyId} processId={id} /></CardContent></Card>
          ) : (
            <Card><CardContent className="py-10 text-center text-muted-foreground">O mapa BPMN AS IS ainda não foi gerado.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
      {generatedDocument && (
        <Card>
          <CardHeader><CardTitle>{generatedDocument.title}</CardTitle></CardHeader>
          <CardContent><pre className="overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-6">{generatedDocument.content_markdown}</pre></CardContent>
        </Card>
      )}
    </div>
  );
}
