import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Download, Eye, FilePlus2, FileText, GitBranch, Link as LinkIcon, RotateCcw, Send, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { mapProcessRowToListItem, type ProcessoRow } from "@/lib/processos";
import { DOCUMENTACAO_BLOQUEADA, podeGerarDocumentacao } from "@/lib/ciclo-processo";
import {
  buildMappedProcessPayload,
  formatRevision,
  loadDocumentationState,
  PROCEDURE_CATEGORIES,
  type DocumentationState,
  type DocumentApprovalEntry,
  type DocumentDistributionEntry,
  type MappedProcessPayload,
  type DocumentPreviewData,
  type DocumentRevisionEntry,
  type DocumentTemplate,
  type GeneratedDocumentRecord,
  type ProcedureCategory,
} from "@/data/documentation-config";

type CompanyContext = {
  companyId: string | null;
  companyName: string;
  userId: string;
  isAuthenticated: boolean;
};

const DEFAULT_COMPANY_CONTEXT: CompanyContext = {
  companyId: null,
  companyName: "Empresa local",
  userId: "local-user",
  isAuthenticated: false,
};

type SourceMode = "linked_process" | "independent";
type SourceFilter = "all" | SourceMode;
type ApprovalDecision = "submit" | "approve" | "reject";
type IndependentDraft = {
  title: string;
  area: string;
  owner: string;
  procedureCategory: ProcedureCategory;
};

const OPERATIONAL_DOCUMENT_STATUSES = [
  "Rascunho",
  "Em revisão",
  "Em aprovação",
  "Publicado",
  "Obsoleto",
] as const;

const NO_APPROVED_PROCESSES_MESSAGE = "Nenhum processo com diagnóstico confirmado. Conclua a Etapa 5 da entrevista com o Peter antes de vincular.";

type DbGeneratedDocument = Tables<"generated_documents">;

function normalizeText(value: string) {
  return value.trim() || "Não informado.";
}

function parseJsonArray<T>(value: Json | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mapDocumentRow(row: DbGeneratedDocument): GeneratedDocumentRecord {
  const metadata = typeof row.generation_metadata === "object" && row.generation_metadata
    ? row.generation_metadata as Record<string, unknown>
    : {};
  const processName = row.process_name || String(metadata.processName || "");
  const linkedMapRevision = row.linked_map_revision || String(metadata.linkedMapRevision || "");
  const linkedMapApprovedAt = row.linked_map_approved_at || String(metadata.linkedMapApprovedAt || "");
  const revision = row.revision || (row.version?.startsWith("Rev.") ? row.version : "Rev.00");
  const distributionHistory = parseJsonArray<DocumentDistributionEntry>(row.distribution_history);

  return {
    id: row.id,
    code: row.code || "IT-000",
    sourceMode: (row.source_mode === "linked_process" ? "linked_process" : "independent"),
    companyId: row.company_id,
    processId: row.process_id,
    processMappingId: row.process_mapping_id,
    processName,
    processLink: row.process_id ? `/processos/${row.process_id}` : null,
    processStatusAtGeneration: String(metadata.processStatusAtGeneration || ""),
    linkedMapRevision,
    linkedMapApprovedAt,
    mapVersionLabel: row.map_version_label || String(metadata.mapVersionLabel || ""),
    area: row.area || String(metadata.area || ""),
    templateId: row.template_id,
    documentOrigin: row.document_origin as GeneratedDocumentRecord["documentOrigin"],
    documentType: row.document_type as GeneratedDocumentRecord["documentType"],
    procedureCategory: (row.procedure_category as ProcedureCategory) || "Procedimento Operacional",
    documentOwner: row.document_owner || String(metadata.documentOwner || ""),
    title: row.title,
    contentMarkdown: row.content_markdown,
    contentText: row.content_text || row.content_markdown.replace(/[#>*`-]/g, "").trim(),
    summary: String(metadata.summary || ""),
    pointsOfAttention: parseJsonArray<string>(metadata.pointsOfAttention as Json | undefined),
    suggestedRisks: parseJsonArray<string>(metadata.suggestedRisks as Json | undefined),
    suggestedIndicators: parseJsonArray<string>(metadata.suggestedIndicators as Json | undefined),
    generationMetadata: metadata,
    status: row.status as GeneratedDocumentRecord["status"],
    version: row.version,
    revision,
    revisionNumber: row.revision_number,
    approverName: row.approver_name || "",
    approverRole: row.approver_role || "",
    distributedTo: row.distribution_list?.length > 0
      ? row.distribution_list
      : Array.from(new Set(distributionHistory.map((item) => item.recipient).filter(Boolean))),
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    descriptionInput: row.description_input || undefined,
    aiModel: row.ai_model || undefined,
    aiPromptUsed: row.ai_prompt_used || undefined,
    revisionHistory: parseJsonArray<DocumentRevisionEntry>(row.review_history),
    approvalHistory: parseJsonArray<DocumentApprovalEntry>(row.approval_history),
    distributionHistory,
  };
}

function markdownToHtml(markdown: string) {
  return markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^> (.*)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br />");
}

function parseRevision(label: string) {
  const match = /Rev\.(\d+)/i.exec(label || "");
  return match ? Number(match[1]) : 0;
}

function formatDatePtBr(value: string) {
  if (!value) return "Não informado";
  return new Date(value).toLocaleDateString("pt-BR");
}

function canEditDocument(doc: GeneratedDocumentRecord) {
  return doc.status === "Rascunho" || doc.status === "Em revisão";
}

function originLabel(doc: GeneratedDocumentRecord) {
  return doc.sourceMode === "linked_process"
    ? `🔗 ${doc.processName || "Processo vinculado"}`
    : "📄 Independente";
}

function buildMapVersionLabel(payload: MappedProcessPayload | null) {
  if (!payload) return "";
  const approvedAt = payload.normalized.mapaAprovadoEm;
  const revision = payload.normalized.mapaRevisao || "Rev.00";
  if (!approvedAt) return "Mapa sem aprovação formal registrada";
  return `Mapa aprovado em ${formatDatePtBr(approvedAt)} — ${revision}`;
}

function buildLinkedFallbackPreview(template: DocumentTemplate, payload: MappedProcessPayload | null): DocumentPreviewData {
  const normalized = payload?.normalized;
  const process = payload?.process;
  const sections = template.sections
    .filter((section) => section.isActive && section.includeInFinalDocument)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sectionContent = sections.map((section) => {
    const key = section.sectionTitle.toLowerCase();
    let content = section.sectionDescription || "Não informado.";

    if (key.includes("objetivo")) content = normalizeText(String(normalized?.objetivo ?? ""));
    else if (key.includes("respons")) content = normalizeText(process?.responsavel ?? "");
    else if (key.includes("entradas")) content = normalizeText(String(normalized?.entradas ?? ""));
    else if (key.includes("saídas") || key.includes("saidas")) content = normalizeText(String(normalized?.saidas ?? ""));
    else if (key.includes("etapas")) {
      content = Array.isArray(normalized?.etapas) && normalized.etapas.length > 0
        ? normalized.etapas.map((step, index) => `${index + 1}. ${step.atividade} | Responsável: ${step.responsavel || "Não informado"} | Sistema: ${step.ferramentaDocumento || "Não informado"}`).join("\n")
        : "Não informado.";
    } else if (key.includes("riscos")) {
      content = Array.isArray(normalized?.riscos) && normalized.riscos.length > 0
        ? normalized.riscos.map((risk) => `- ${risk.risco || "Risco"}${risk.impacto ? ` | Impacto: ${risk.impacto}` : ""}`).join("\n")
        : normalizeText(String(normalized?.problemasTexto ?? ""));
    } else if (key.includes("indicadores")) {
      content = Array.isArray(normalized?.indicadores) && normalized.indicadores.length > 0
        ? normalized.indicadores.map((item) => `- ${item.nome || "Indicador"} | Meta: ${item.meta || "Não informado"}`).join("\n")
        : "Não informado.";
    } else if (key.includes("descri")) {
      content = normalizeText(payload?.detailed?.descricao ?? "");
    }

    return `## ${section.sectionTitle}\n\n${content}`;
  });

  const contentMarkdown = [
    `# ${template.name} - ${process?.nome || "Processo"}`,
    "",
    `> Prévia operacional gerada a partir do processo mapeado ${process?.nome || ""}.`,
    "",
    ...sectionContent,
  ].join("\n").trim();

  return {
    title: `Procedimento - ${process?.nome || "Processo"}`,
    contentMarkdown,
    contentText: contentMarkdown.replace(/[#>*`-]/g, "").trim(),
    summary: `Documento operacional gerado para o processo ${process?.nome || "selecionado"}.`,
    pointsOfAttention: [
      "Validar aprovador e distribuição antes da publicação.",
      "Confirmar a revisão do conteúdo com o responsável pelo processo.",
    ],
    suggestedRisks: [],
    suggestedIndicators: [],
    generationMetadata: {
      mode: "frontend-fallback",
      processId: process?.id || null,
      generatedAt: new Date().toISOString(),
    },
  };
}

function buildIndependentFallbackPreview(template: DocumentTemplate, draft: IndependentDraft): DocumentPreviewData {
  const contentMarkdown = [
    `# ${draft.title}`,
    "",
    "> Procedimento independente gerado sem vínculo com processo mapeado.",
    "",
    "## Classificação",
    "",
    `Tipo: ${draft.procedureCategory}`,
    "",
    "## Área responsável",
    "",
    normalizeText(draft.area),
    "",
    "## Responsável pelo documento",
    "",
    normalizeText(draft.owner),
    "",
    "## Diretriz inicial",
    "",
    `Documento criado com apoio do template "${template.name}" para posterior detalhamento operacional.`,
  ].join("\n").trim();

  return {
    title: draft.title,
    contentMarkdown,
    contentText: contentMarkdown.replace(/[#>*`-]/g, "").trim(),
    summary: "Procedimento independente preparado para revisão e complementação manual.",
    pointsOfAttention: [
      "Validar o conteúdo com a área dona do procedimento.",
      "Definir aprovador e distribuição antes da publicação.",
    ],
    suggestedRisks: [],
    suggestedIndicators: [],
    generationMetadata: {
      mode: "frontend-fallback",
      sourceMode: "independent",
      generatedAt: new Date().toISOString(),
    },
  };
}

function statusBadgeVariant(status: GeneratedDocumentRecord["status"]): "default" | "secondary" | "outline" | "destructive" {
  if (status === "Publicado" || status === "Aprovado") return "default";
  if (status === "Obsoleto" || status === "Arquivado") return "secondary";
  if (status === "Em revisão" || status === "Em aprovação") return "outline";
  return "secondary";
}

export default function Documentos() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const guidedSelectionHandled = useRef(false);
  const [companyContext, setCompanyContext] = useState<CompanyContext>(DEFAULT_COMPANY_CONTEXT);
  const [state, setState] = useState<DocumentationState | null>(null);
  const [documents, setDocuments] = useState<GeneratedDocumentRecord[]>([]);
  const [processRows, setProcessRows] = useState<ProcessoRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("linked_process");
  const [filterProcess, setFilterProcess] = useState("all");
  const [filterArea, setFilterArea] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterApprover, setFilterApprover] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterOrigin, setFilterOrigin] = useState<SourceFilter>("all");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isNewDocumentOpen, setIsNewDocumentOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [preview, setPreview] = useState<DocumentPreviewData | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [independentDraft, setIndependentDraft] = useState<IndependentDraft>({
    title: "",
    area: "",
    owner: "",
    procedureCategory: "Procedimento Operacional",
  });
  const [viewingDoc, setViewingDoc] = useState<GeneratedDocumentRecord | null>(null);
  const [editingDoc, setEditingDoc] = useState<GeneratedDocumentRecord | null>(null);
  const [reviewingDoc, setReviewingDoc] = useState<GeneratedDocumentRecord | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [reviewSourceMode, setReviewSourceMode] = useState<SourceMode>("linked_process");
  const [reviewProcessId, setReviewProcessId] = useState("");
  const [reviewIndependentDraft, setReviewIndependentDraft] = useState<IndependentDraft>({
    title: "",
    area: "",
    owner: "",
    procedureCategory: "Procedimento Operacional",
  });
  const [approvalDoc, setApprovalDoc] = useState<GeneratedDocumentRecord | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision>("submit");
  const [approvalName, setApprovalName] = useState("");
  const [approvalRole, setApprovalRole] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [distributionDoc, setDistributionDoc] = useState<GeneratedDocumentRecord | null>(null);
  const [distributionRecipients, setDistributionRecipients] = useState("");
  const [distributedBy, setDistributedBy] = useState("");

  const refreshDocuments = async (companyId: string | null) => {
    if (!companyId) {
      setDocuments([]);
      return;
    }

    const { data, error } = await supabase
      .from("generated_documents")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    setDocuments((data || []).map(mapDocumentRow));
  };

  const refreshProcesses = async (companyId: string | null) => {
    if (!companyId) {
      setProcessRows([]);
      return;
    }

    const { data, error } = await supabase
      .from("processos")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    setProcessRows(data || []);
  };

  const persistDocumentVersion = async (
    companyId: string,
    userId: string,
    documentId: string,
    versionLabel: string,
    contentMarkdown: string,
    changeSummary: string | null,
  ) => {
    const payload: TablesInsert<"generated_document_versions"> = {
      company_id: companyId,
      document_id: documentId,
      version: versionLabel,
      content_markdown: contentMarkdown,
      content_text: contentMarkdown.replace(/[#>*`-]/g, "").trim(),
      change_summary: changeSummary,
      created_by: userId,
    };

    await supabase.from("generated_document_versions").insert(payload);
  };

  useEffect(() => {
    const loadPage = async () => {
      const nextContext: CompanyContext = {
        companyId: window.localStorage.getItem("process:activeEmpresaId"),
        companyName: window.localStorage.getItem("process:activeEmpresaNome") || "Empresa local",
        userId: "local-user",
        isAuthenticated: false,
      };

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user?.id) {
          nextContext.userId = userData.user.id;
          nextContext.isAuthenticated = true;
          const resolvedCompanyId = await resolveAccessibleCompanyId(userData.user.id, nextContext.companyId);
          if (resolvedCompanyId) {
            nextContext.companyId = resolvedCompanyId;
          }
        }
      } catch {
        // fallback local
      }

      const nextState = loadDocumentationState(nextContext.companyId, nextContext.userId);
      const activeTemplates = nextState.templates.filter((template) => template.isActive);
      const defaultTemplate = activeTemplates.find((template) => template.id === nextState.generationSettings.defaultTemplateId) || activeTemplates[0];

      setCompanyContext(nextContext);
      setState(nextState);
      setSelectedTemplateId(defaultTemplate?.id || "");
      setReviewedBy(nextContext.userId);
      setApprovalName(nextContext.userId);
      setDistributedBy(nextContext.userId);

      try {
        await Promise.all([
          refreshProcesses(nextContext.companyId),
          refreshDocuments(nextContext.companyId),
        ]);
      } catch {
        setProcessRows([]);
        setDocuments([]);
        toast({
          title: "Falha ao carregar dados",
          description: "Não foi possível carregar processos e documentos da empresa ativa.",
          variant: "destructive",
        });
      } finally {
        setIsLoaded(true);
      }
    };

    void loadPage();
  }, [toast]);

  const activeTemplates = useMemo(
    () => state?.templates.filter((template) => template.isActive) ?? [],
    [state],
  );

  const activeTemplate = useMemo(
    () => activeTemplates.find((template) => template.id === selectedTemplateId) ?? activeTemplates[0] ?? null,
    [activeTemplates, selectedTemplateId],
  );

  const availableProcesses = useMemo(
    () => processRows.map(mapProcessRowToListItem),
    [processRows],
  );

  const approvedProcesses = useMemo(
    () => availableProcesses.filter((processo) => podeGerarDocumentacao(processo.status)),
    [availableProcesses],
  );

  useEffect(() => {
    if (!isLoaded || guidedSelectionHandled.current) return;
    const requestedProcessId = searchParams.get("processId");
    if (!requestedProcessId) return;
    guidedSelectionHandled.current = true;
    const requestedProcess = availableProcesses.find((processo) => processo.id === requestedProcessId);
    if (podeGerarDocumentacao(requestedProcess?.status)) {
      setSourceMode("linked_process");
      setSelectedProcessId(requestedProcessId);
      setIsNewDocumentOpen(true);
    } else {
      const obsoleto = requestedProcess?.status === "Obsoleto";
      toast({
        title: !requestedProcess ? "Processo não encontrado" : obsoleto ? "Processo obsoleto" : "Processo ainda sem diagnóstico",
        description: !requestedProcess
          ? "Não foi possível localizar o processo solicitado nesta empresa."
          : obsoleto ? "Processos obsoletos não aceitam nova documentação." : DOCUMENTACAO_BLOQUEADA,
        variant: "destructive",
      });
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("processId");
    nextParams.delete("mode");
    setSearchParams(nextParams, { replace: true });
  }, [availableProcesses, isLoaded, searchParams, setSearchParams, toast]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filterProcess !== "all" && doc.processId !== filterProcess) return false;
      if (filterArea !== "all" && doc.area !== filterArea) return false;
      if (filterStatus !== "all" && doc.status !== filterStatus) return false;
      if (filterOrigin !== "all" && doc.sourceMode !== filterOrigin) return false;
      if (filterApprover !== "all" && `${doc.approverName}${doc.approverRole}` !== filterApprover) return false;
      if (filterDate) {
        const createdDate = doc.createdAt.slice(0, 10);
        const updatedDate = doc.updatedAt.slice(0, 10);
        if (createdDate !== filterDate && updatedDate !== filterDate) return false;
      }
      return true;
    });
  }, [documents, filterApprover, filterArea, filterDate, filterOrigin, filterProcess, filterStatus]);

  const uniqueAreas = useMemo(
    () => Array.from(new Set(documents.map((doc) => doc.area).filter(Boolean))).sort(),
    [documents],
  );

  const uniqueApprovers = useMemo(
    () => Array.from(new Set(documents
      .filter((doc) => doc.approverName || doc.approverRole)
      .map((doc) => `${doc.approverName}${doc.approverRole}`))),
    [documents],
  );

  const selectedProcessRow = useMemo(
    () => processRows.find((processo) => processo.id === selectedProcessId) || null,
    [processRows, selectedProcessId],
  );

  const selectedProcess = useMemo(
    () => availableProcesses.find((processo) => processo.id === selectedProcessId) || null,
    [availableProcesses, selectedProcessId],
  );

  const selectedReviewProcessRow = useMemo(
    () => processRows.find((processo) => processo.id === reviewProcessId) || null,
    [processRows, reviewProcessId],
  );

  const selectedReviewProcess = useMemo(
    () => approvedProcesses.find((processo) => processo.id === reviewProcessId) || null,
    [approvedProcesses, reviewProcessId],
  );

  const selectedProcessPayload = useMemo(
    () => buildMappedProcessPayload(selectedProcessRow),
    [selectedProcessRow],
  );

  const selectedReviewProcessPayload = useMemo(
    () => buildMappedProcessPayload(selectedReviewProcessRow),
    [selectedReviewProcessRow],
  );

  useEffect(() => {
    if (approvedProcesses.length === 0) {
      if (selectedProcessId) setSelectedProcessId("");
      return;
    }

    const hasCurrentSelection = approvedProcesses.some((processo) => processo.id === selectedProcessId);
    if (!hasCurrentSelection) {
      setSelectedProcessId(approvedProcesses[0].id);
    }
  }, [approvedProcesses, selectedProcessId]);

  useEffect(() => {
    if (!reviewingDoc || reviewSourceMode !== "linked_process") return;

    if (approvedProcesses.length === 0) {
      if (reviewProcessId) setReviewProcessId("");
      return;
    }

    const hasCurrentSelection = approvedProcesses.some((processo) => processo.id === reviewProcessId);
    if (!hasCurrentSelection) {
      setReviewProcessId(approvedProcesses[0].id);
    }
  }, [approvedProcesses, reviewProcessId, reviewingDoc, reviewSourceMode]);

  useEffect(() => {
    if (!selectedProcess) return;
    if (sourceMode === "linked_process") {
      setPreviewTitle((current) => current || `Procedimento - ${selectedProcess.nome}`);
    }
  }, [selectedProcess, sourceMode]);

  const newerApprovedRevision = useMemo(() => {
    if (!viewingDoc || viewingDoc.sourceMode !== "linked_process" || !viewingDoc.processId) return null;
    const currentProcess = processRows.find((item) => item.id === viewingDoc.processId);
    if (!currentProcess || !podeGerarDocumentacao(currentProcess.status) || !currentProcess.mapa_revisao) return null;
    if (parseRevision(currentProcess.mapa_revisao) <= parseRevision(viewingDoc.linkedMapRevision)) return null;
    return currentProcess.mapa_revisao;
  }, [processRows, viewingDoc]);

  const getNewerApprovedRevision = (doc: GeneratedDocumentRecord) => {
    if (doc.sourceMode !== "linked_process" || !doc.processId) return null;
    const currentProcess = processRows.find((item) => item.id === doc.processId);
    if (!currentProcess || !podeGerarDocumentacao(currentProcess.status) || !currentProcess.mapa_revisao) return null;
    if (parseRevision(currentProcess.mapa_revisao) <= parseRevision(doc.linkedMapRevision)) return null;
    return currentProcess.mapa_revisao;
  };

  const handleGeneratePreview = async () => {
    if (!activeTemplate) {
      toast({
        title: "Dados incompletos",
        description: "Selecione o template ativo antes de gerar o procedimento.",
        variant: "destructive",
      });
      return;
    }

    if (sourceMode === "linked_process" && approvedProcesses.length === 0) {
      toast({
        title: "Nenhum processo diagnosticado",
        description: NO_APPROVED_PROCESSES_MESSAGE,
        variant: "destructive",
      });
      return;
    }

    if (sourceMode === "linked_process" && !selectedProcessId) {
      toast({
        title: "Processo obrigatório",
        description: "Selecione um processo mapeado para gerar o procedimento vinculado.",
        variant: "destructive",
      });
      return;
    }

    if (sourceMode === "independent") {
      if (!independentDraft.title.trim() || !independentDraft.area.trim() || !independentDraft.owner.trim()) {
        toast({
          title: "Campos obrigatórios",
          description: "Informe nome do procedimento, área responsável e responsável pelo documento.",
          variant: "destructive",
        });
        return;
      }
    }

    const mappedProcessData = sourceMode === "linked_process" ? selectedProcessPayload : null;
    if (sourceMode === "linked_process" && !mappedProcessData) {
      toast({
        title: "Processo não encontrado",
        description: "Não foi possível carregar os dados do processo selecionado.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        template: activeTemplate,
        sections: activeTemplate.sections.filter((section) => section.isActive && section.includeInFinalDocument),
        mappedProcessData,
        manualDescription: sourceMode === "independent"
          ? {
              title: independentDraft.title,
              documentType: activeTemplate.documentType,
              templateId: activeTemplate.id,
              area: independentDraft.area,
              objective: independentDraft.title,
              generalDescription: `Procedimento independente do tipo ${independentDraft.procedureCategory}.`,
              inputs: "",
              outputs: "",
              stakeholders: independentDraft.owner,
              systems: "",
              relatedDocuments: "",
              businessRules: "",
              knownRisks: "",
              existingControls: "",
              desiredIndicators: "",
              additionalNotes: "",
            }
          : null,
        generationConfig: activeTemplate.promptConfig,
        companyContext,
        process_id: sourceMode === "linked_process" ? selectedProcessId : null,
        use_peter_assistant: sourceMode === "linked_process",
      };
      const { data, error } = await supabase.functions.invoke("ai-generate-document", { body: payload });
      if (error) throw error;

      const nextPreview: DocumentPreviewData = {
        title: data?.title || (sourceMode === "linked_process" && mappedProcessData ? `Procedimento - ${mappedProcessData.process.nome}` : independentDraft.title),
        contentMarkdown: data?.content_markdown || "",
        contentText: data?.content_text || "",
        summary: data?.executive_summary || "Resumo não informado.",
        pointsOfAttention: Array.isArray(data?.attention_points) ? data.attention_points : [],
        suggestedRisks: Array.isArray(data?.suggested_risks) ? data.suggested_risks : [],
        suggestedIndicators: Array.isArray(data?.suggested_indicators) ? data.suggested_indicators : [],
        generationMetadata: data?.generation_metadata || {},
      };

      setPreview(nextPreview);
      setPreviewTitle(nextPreview.title);
      setPreviewMarkdown(nextPreview.contentMarkdown);
      toast({ title: "Prévia gerada", description: "Revise o procedimento antes de salvar." });
    } catch {
      const fallback = sourceMode === "linked_process"
        ? buildLinkedFallbackPreview(activeTemplate, selectedProcessPayload)
        : buildIndependentFallbackPreview(activeTemplate, independentDraft);
      setPreview(fallback);
      setPreviewTitle(fallback.title);
      setPreviewMarkdown(fallback.contentMarkdown);
      toast({
        title: "Prévia gerada em modo local",
        description: "A função de IA não respondeu. Foi montada uma versão operacional para revisão.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDocument = async () => {
    if (!activeTemplate || !preview) return;
    if (sourceMode === "linked_process" && approvedProcesses.length === 0) {
      toast({
        title: "Nenhum processo diagnosticado",
        description: NO_APPROVED_PROCESSES_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (sourceMode === "linked_process" && !selectedProcessId) return;
    if (!companyContext.companyId || !companyContext.isAuthenticated) {
      toast({
        title: "Empresa não identificada",
        description: "É necessário estar autenticado e com uma empresa ativa para salvar o procedimento.",
        variant: "destructive",
      });
      return;
    }

    const mappedProcessData = sourceMode === "linked_process" ? selectedProcessPayload : null;
    if (sourceMode === "linked_process" && !mappedProcessData) return;

    setIsPersisting(true);
    try {
      const revision = formatRevision(0);
      const documentOrigin = sourceMode === "linked_process" ? "mapped_process" : "manual_description";
      const processName = sourceMode === "linked_process" && mappedProcessData ? mappedProcessData.process.nome : "";
      const area = sourceMode === "linked_process" && mappedProcessData ? mappedProcessData.process.area : independentDraft.area;
      const documentOwner = sourceMode === "linked_process" && mappedProcessData ? mappedProcessData.process.responsavel : independentDraft.owner;
      const processStatus = sourceMode === "linked_process" && mappedProcessData ? mappedProcessData.process.status : "";
      const linkedMapRevision = sourceMode === "linked_process" && mappedProcessData ? mappedProcessData.normalized.mapaRevisao || "Rev.00" : "";
      const linkedMapApprovedAt = sourceMode === "linked_process" && mappedProcessData ? mappedProcessData.normalized.mapaAprovadoEm || null : null;
      const mapVersionLabel = sourceMode === "linked_process" ? buildMapVersionLabel(mappedProcessData) : "";
      const title = previewTitle || (sourceMode === "linked_process" && mappedProcessData ? `Procedimento - ${mappedProcessData.process.nome}` : independentDraft.title);

      const insertPayload: TablesInsert<"generated_documents"> = {
        company_id: companyContext.companyId,
        process_id: sourceMode === "linked_process" ? selectedProcessId : null,
        process_mapping_id: null,
        process_name: processName,
        source_mode: sourceMode,
        area,
        document_owner: documentOwner,
        procedure_category: sourceMode === "linked_process" ? "Procedimento Operacional" : independentDraft.procedureCategory,
        template_id: activeTemplate.id,
        document_origin: documentOrigin,
        document_type: activeTemplate.documentType,
        title,
        description_input: sourceMode === "independent" ? independentDraft.title : null,
        content_text: previewMarkdown.replace(/[#>*`-]/g, "").trim(),
        content_markdown: previewMarkdown,
        status: "Rascunho",
        version: revision,
        revision,
        revision_number: 0,
        approver_name: "",
        approver_role: "",
        distribution_list: [],
        approval_history: [],
        review_history: [],
        distribution_history: [],
        linked_map_revision: linkedMapRevision || null,
        linked_map_approved_at: linkedMapApprovedAt,
        map_version_label: mapVersionLabel || null,
        ai_model: String(preview.generationMetadata.ai_model || "ai-generate-document"),
        ai_prompt_used: activeTemplate.promptConfig.systemPrompt,
        generation_metadata: {
          ...preview.generationMetadata,
          summary: preview.summary,
          pointsOfAttention: preview.pointsOfAttention,
          suggestedRisks: preview.suggestedRisks,
          suggestedIndicators: preview.suggestedIndicators,
          templateName: activeTemplate.name,
          processStatusAtGeneration: processStatus,
          processName,
          area,
          documentOwner,
          procedureCategory: sourceMode === "linked_process" ? "Procedimento Operacional" : independentDraft.procedureCategory,
          linkedMapRevision,
          linkedMapApprovedAt,
          mapVersionLabel,
        } as Json,
        created_by: companyContext.userId,
      };

      const { data: insertedDocument, error: insertError } = await supabase
        .from("generated_documents")
        .insert(insertPayload)
        .select("*")
        .single();

      if (insertError || !insertedDocument) throw insertError || new Error("Falha ao criar documento.");

      await persistDocumentVersion(
        companyContext.companyId,
        companyContext.userId,
        insertedDocument.id,
        revision,
        previewMarkdown,
        "Versão inicial do procedimento.",
      );

      await refreshDocuments(companyContext.companyId);

      setIsNewDocumentOpen(false);
      setPreview(null);
      setPreviewTitle("");
      setPreviewMarkdown("");
      setSourceMode("linked_process");
      setIndependentDraft({
        title: "",
        area: "",
        owner: "",
        procedureCategory: "Procedimento Operacional",
      });
      toast({ title: "Documento criado", description: "O procedimento foi salvo na listagem operacional da empresa." });
    } catch {
      toast({
        title: "Falha ao salvar",
        description: "Não foi possível persistir o procedimento no Supabase.",
        variant: "destructive",
      });
    } finally {
      setIsPersisting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingDoc || !companyContext.companyId) return;
    try {
      const updatePayload: TablesUpdate<"generated_documents"> = {
        title: editingDoc.title,
        content_markdown: editingDoc.contentMarkdown,
        content_text: editingDoc.contentMarkdown.replace(/[#>*`-]/g, "").trim(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("generated_documents")
        .update(updatePayload)
        .eq("id", editingDoc.id)
        .eq("company_id", companyContext.companyId);

      if (error) throw error;

      await refreshDocuments(companyContext.companyId);
      setEditingDoc(null);
      toast({ title: "Documento atualizado", description: "As alterações foram salvas na versão atual." });
    } catch {
      toast({
        title: "Falha ao editar",
        description: "Não foi possível atualizar o documento selecionado.",
        variant: "destructive",
      });
    }
  };

  const handleReview = async () => {
    if (!reviewingDoc || !reviewReason.trim() || !companyContext.companyId) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe o motivo da revisão para criar a nova versão.",
        variant: "destructive",
      });
      return;
    }

    if (reviewSourceMode === "linked_process" && approvedProcesses.length === 0) {
      toast({
        title: "Nenhum processo diagnosticado",
        description: NO_APPROVED_PROCESSES_MESSAGE,
        variant: "destructive",
      });
      return;
    }

    if (reviewSourceMode === "linked_process" && !reviewProcessId) {
      toast({
        title: "Processo obrigatório",
        description: "Selecione o processo a ser vinculado nesta revisão.",
        variant: "destructive",
      });
      return;
    }

    if (reviewSourceMode === "independent" && (!reviewIndependentDraft.title.trim() || !reviewIndependentDraft.area.trim() || !reviewIndependentDraft.owner.trim())) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, área e responsável do procedimento independente.",
        variant: "destructive",
      });
      return;
    }

    const reviewPayload = reviewSourceMode === "linked_process" ? selectedReviewProcessPayload : null;
    const now = new Date().toISOString();
    const reviewedByName = reviewedBy || companyContext.userId;
    const reviewEntry: DocumentRevisionEntry = {
      revision: reviewingDoc.revision,
      revisedBy: reviewedByName,
      revisedAt: now,
      reason: reviewReason,
      previousStatus: reviewingDoc.status,
    };

    try {
      const nextRevisionNumber = reviewingDoc.revisionNumber + 1;
      const nextRevision = formatRevision(nextRevisionNumber);
      const processName = reviewSourceMode === "linked_process" && reviewPayload ? reviewPayload.process.nome : "";
      const area = reviewSourceMode === "linked_process" && reviewPayload ? reviewPayload.process.area : reviewIndependentDraft.area;
      const documentOwner = reviewSourceMode === "linked_process" && reviewPayload ? reviewPayload.process.responsavel : reviewIndependentDraft.owner;
      const linkedMapRevision = reviewSourceMode === "linked_process" && reviewPayload ? reviewPayload.normalized.mapaRevisao || "Rev.00" : "";
      const linkedMapApprovedAt = reviewSourceMode === "linked_process" && reviewPayload ? reviewPayload.normalized.mapaAprovadoEm || null : null;
      const mapVersionLabel = reviewSourceMode === "linked_process" ? buildMapVersionLabel(reviewPayload) : "";

      const obsoletePayload: TablesUpdate<"generated_documents"> = {
        status: "Obsoleto",
        updated_at: now,
      };
      const { error: obsoleteError } = await supabase
        .from("generated_documents")
        .update(obsoletePayload)
        .eq("id", reviewingDoc.id)
        .eq("company_id", companyContext.companyId);

      if (obsoleteError) throw obsoleteError;

      const newDocumentPayload: TablesInsert<"generated_documents"> = {
        company_id: companyContext.companyId,
        code: reviewingDoc.code,
        process_id: reviewSourceMode === "linked_process" ? reviewProcessId : null,
        process_mapping_id: null,
        process_name: processName,
        source_mode: reviewSourceMode,
        area,
        document_owner: documentOwner,
        procedure_category: reviewSourceMode === "linked_process" ? "Procedimento Operacional" : reviewIndependentDraft.procedureCategory,
        template_id: reviewingDoc.templateId,
        document_origin: reviewSourceMode === "linked_process" ? "mapped_process" : "manual_description",
        document_type: reviewingDoc.documentType,
        title: reviewSourceMode === "linked_process" && reviewPayload ? `Procedimento - ${reviewPayload.process.nome}` : reviewIndependentDraft.title,
        description_input: reviewSourceMode === "independent" ? reviewIndependentDraft.title : reviewingDoc.descriptionInput ?? null,
        content_text: reviewingDoc.contentMarkdown.replace(/[#>*`-]/g, "").trim(),
        content_markdown: reviewingDoc.contentMarkdown,
        status: "Em revisão",
        version: nextRevision,
        revision: nextRevision,
        revision_number: nextRevisionNumber,
        approver_name: "",
        approver_role: "",
        distribution_list: [],
        approval_history: [],
        review_history: [reviewEntry] as unknown as Json,
        distribution_history: [],
        linked_map_revision: linkedMapRevision || null,
        linked_map_approved_at: linkedMapApprovedAt,
        map_version_label: mapVersionLabel || null,
        ai_model: reviewingDoc.aiModel ?? null,
        ai_prompt_used: reviewingDoc.aiPromptUsed ?? null,
        generation_metadata: {
          ...reviewingDoc.generationMetadata,
          processName,
          area,
          documentOwner,
          linkedMapRevision,
          linkedMapApprovedAt,
          mapVersionLabel,
        } as Json,
        created_by: companyContext.userId,
      };

      const { data: insertedReview, error: insertError } = await supabase
        .from("generated_documents")
        .insert(newDocumentPayload)
        .select("*")
        .single();

      if (insertError || !insertedReview) throw insertError || new Error("Falha ao criar revisão.");

      await persistDocumentVersion(
        companyContext.companyId,
        companyContext.userId,
        insertedReview.id,
        nextRevision,
        reviewingDoc.contentMarkdown,
        reviewReason,
      );

      await refreshDocuments(companyContext.companyId);

      setReviewingDoc(null);
      setReviewReason("");
      setReviewProcessId("");
      toast({ title: "Nova revisão criada", description: "A revisão anterior foi marcada como obsoleta e o fluxo de aprovação foi reiniciado." });
    } catch {
      toast({
        title: "Falha ao revisar",
        description: "Não foi possível criar a nova revisão do procedimento.",
        variant: "destructive",
      });
    }
  };

  const handleApproval = async () => {
    if (!approvalDoc || !approvalName.trim() || !companyContext.companyId) {
      toast({
        title: "Responsável obrigatório",
        description: "Informe quem está aprovando, reprovando ou encaminhando o documento.",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const status = approvalDecision === "submit"
        ? "Em aprovação"
        : approvalDecision === "approve"
          ? "Publicado"
          : "Em revisão";

      const nextApprovalHistory = approvalDecision === "submit"
        ? approvalDoc.approvalHistory
        : [
            {
              decision: approvalDecision === "approve" ? "Aprovado" : "Reprovado",
              responsibleName: approvalName,
              responsibleRole: approvalRole,
              decidedAt: now,
              comment: approvalComment,
            },
            ...approvalDoc.approvalHistory,
          ];

      const updatePayload: TablesUpdate<"generated_documents"> = {
        status,
        approver_name: approvalName,
        approver_role: approvalRole,
        approval_history: nextApprovalHistory,
        approved_at: approvalDecision === "approve" ? now : null,
        approved_by: approvalDecision === "approve" ? companyContext.userId : null,
        published_at: approvalDecision === "approve" ? now : null,
        updated_at: now,
      };

      const { error } = await supabase
        .from("generated_documents")
        .update(updatePayload)
        .eq("id", approvalDoc.id)
        .eq("company_id", companyContext.companyId);

      if (error) throw error;

      await refreshDocuments(companyContext.companyId);
      setApprovalDoc(null);
      setApprovalComment("");
      toast({
        title: approvalDecision === "approve" ? "Documento publicado" : approvalDecision === "reject" ? "Documento reprovado" : "Documento enviado para aprovação",
        description: "O status operacional foi atualizado com rastreabilidade.",
      });
    } catch {
      toast({
        title: "Falha na aprovação",
        description: "Não foi possível atualizar o status do documento.",
        variant: "destructive",
      });
    }
  };

  const handleDistribution = async () => {
    if (!distributionDoc || !distributionRecipients.trim() || !companyContext.companyId) {
      toast({
        title: "Distribuição obrigatória",
        description: "Informe ao menos uma área ou pessoa para registrar a distribuição.",
        variant: "destructive",
      });
      return;
    }

    const recipients = distributionRecipients
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const distributedAt = new Date().toISOString();
      const nextDistributionHistory: DocumentDistributionEntry[] = [
        ...recipients.map((recipient) => ({
          recipient,
          distributedAt,
          distributedBy: distributedBy || companyContext.userId,
          revision: distributionDoc.revision,
          version: distributionDoc.version,
        })),
        ...distributionDoc.distributionHistory,
      ];

      const updatePayload: TablesUpdate<"generated_documents"> = {
        distribution_list: Array.from(new Set([...distributionDoc.distributedTo, ...recipients])),
        distribution_history: nextDistributionHistory as unknown as Json,
        updated_at: distributedAt,
      };

      const { error } = await supabase
        .from("generated_documents")
        .update(updatePayload)
        .eq("id", distributionDoc.id)
        .eq("company_id", companyContext.companyId);

      if (error) throw error;

      await refreshDocuments(companyContext.companyId);
      setDistributionDoc(null);
      setDistributionRecipients("");
      toast({ title: "Distribuição registrada", description: "Os destinatários ficaram vinculados ao documento com data e responsável." });
    } catch {
      toast({
        title: "Falha na distribuição",
        description: "Não foi possível registrar a distribuição do documento.",
        variant: "destructive",
      });
    }
  };

  const handleExportWord = (doc: GeneratedDocumentRecord) => {
    const html = `
      <html>
        <head><meta charset="utf-8"><title>${doc.title}</title></head>
        <body>${markdownToHtml(doc.contentMarkdown)}</body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.code}-${doc.revision}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = (doc: GeneratedDocumentRecord) => {
    const popup = window.open("", "_blank", "width=960,height=720");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${doc.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #17313b; }
            h1, h2, h3 { color: #0f766e; }
            blockquote { border-left: 4px solid #0f766e; margin: 16px 0; padding-left: 16px; color: #4b5563; }
            li { margin-bottom: 6px; }
          </style>
        </head>
        <body>${markdownToHtml(doc.contentMarkdown)}</body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  if (!isLoaded || !state) {
    return <div className="p-6">Carregando módulo de documentos...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="max-w-3xl text-muted-foreground">
            Lista operacional dos procedimentos gerados a partir de processos mapeados, com revisão, aprovação, distribuição e exportação.
          </p>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Empresa: {companyContext.companyName}</Badge>
            <Badge variant="outline">Módulo operacional</Badge>
            <Badge variant="outline">Sem configurações de template nesta tela</Badge>
          </div>
        </div>
        <Button onClick={() => setIsNewDocumentOpen(true)} disabled={!activeTemplate}>
          <FilePlus2 className="mr-2 h-4 w-4" /> Novo Documento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine a operação por processo, área, status, aprovador e data.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2">
            <Label>Processo</Label>
            <Select value={filterProcess} onValueChange={setFilterProcess}>
              <SelectTrigger><SelectValue placeholder="Todos os processos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableProcesses.map((processo) => (
                  <SelectItem key={processo.id} value={processo.id}>{processo.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Área</Label>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger><SelectValue placeholder="Todas as áreas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {uniqueAreas.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {OPERATIONAL_DOCUMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Aprovador</Label>
            <Select value={filterApprover} onValueChange={setFilterApprover}>
              <SelectTrigger><SelectValue placeholder="Todos os aprovadores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueApprovers.map((value) => {
                  const doc = documents.find((item) => `${item.approverName}${item.approverRole}` === value);
                  const label = [doc?.approverName, doc?.approverRole].filter(Boolean).join(" / ");
                  return <SelectItem key={value} value={value}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={filterOrigin} onValueChange={(value) => setFilterOrigin(value as SourceFilter)}>
              <SelectTrigger><SelectValue placeholder="Todas as origens" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="linked_process">Vinculados a processo</SelectItem>
                <SelectItem value="independent">Independentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listagem de Documentos</CardTitle>
          <CardDescription>Procedimentos controlados com código automático, revisão, status e distribuição.</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-medium">Nenhum procedimento gerado ainda.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum procedimento gerado ainda. Acesse um processo mapeado e clique em Gerar Procedimento, ou crie um procedimento independente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome do procedimento</TableHead>
                    <TableHead>Processo vinculado</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Revisão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aprovador</TableHead>
                    <TableHead>Distribuição</TableHead>
                    <TableHead>Data de criação</TableHead>
                    <TableHead>Última atualização</TableHead>
                    <TableHead className="min-w-[340px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.code}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{doc.title}</div>
                          {getNewerApprovedRevision(doc) ? (
                            <div className="text-xs text-amber-700">
                              ⚠ Processo vinculado com versão mais recente: {getNewerApprovedRevision(doc)}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{doc.processName ? <Link className="text-primary hover:underline" to={doc.processLink || "#"}>{doc.processName}</Link> : "Independente"}</TableCell>
                      <TableCell>{originLabel(doc)}</TableCell>
                      <TableCell>{doc.revision}</TableCell>
                      <TableCell><Badge variant={statusBadgeVariant(doc.status)}>{doc.status}</Badge></TableCell>
                      <TableCell>{[doc.approverName, doc.approverRole].filter(Boolean).join(" / ") || "-"}</TableCell>
                      <TableCell>{doc.distributedTo.length > 0 ? doc.distributedTo.join(", ") : "-"}</TableCell>
                      <TableCell>{new Date(doc.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{new Date(doc.updatedAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => setViewingDoc(doc)}>
                            <Eye className="mr-2 h-4 w-4" /> Visualizar
                          </Button>
                          <Button size="sm" variant="outline" disabled={!canEditDocument(doc)} onClick={() => setEditingDoc({ ...doc })}>
                            <FileText className="mr-2 h-4 w-4" /> Editar
                          </Button>
                          <Button size="sm" variant="outline" disabled={doc.status === "Obsoleto"} onClick={() => {
                            setReviewingDoc(doc);
                            setReviewSourceMode(doc.sourceMode);
                            setReviewProcessId(
                              doc.processId && approvedProcesses.some((processo) => processo.id === doc.processId)
                                ? doc.processId
                                : approvedProcesses[0]?.id || "",
                            );
                            setReviewIndependentDraft({
                              title: doc.title,
                              area: doc.area,
                              owner: doc.documentOwner,
                              procedureCategory: doc.procedureCategory,
                            });
                          }}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Revisar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setApprovalDoc(doc)}>
                            <ShieldCheck className="mr-2 h-4 w-4" /> Aprovar / Reprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDistributionDoc(doc)}>
                            <Send className="mr-2 h-4 w-4" /> Distribuir
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleExportPdf(doc)}>
                            <Download className="mr-2 h-4 w-4" /> Exportar PDF
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleExportWord(doc)}>
                            <Download className="mr-2 h-4 w-4" /> Exportar Word
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isNewDocumentOpen} onOpenChange={setIsNewDocumentOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Novo Documento</DialogTitle>
            <DialogDescription>Escolha entre procedimento vinculado a processo ou procedimento independente. O template ativo vem exclusivamente de Configurações → Documentação do Processo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSourceMode("linked_process")}
                  className={`rounded-xl border p-4 text-left transition ${sourceMode === "linked_process" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <div className="font-medium">🔗 Vinculado a processo mapeado</div>
                  <p className="mt-2 text-sm text-muted-foreground">Preenche dados a partir do processo e registra a versão do mapa utilizado.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("independent")}
                  className={`rounded-xl border p-4 text-left transition ${sourceMode === "independent" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <div className="font-medium">📄 Procedimento independente</div>
                  <p className="mt-2 text-sm text-muted-foreground">Cria um procedimento sem vínculo com processo mapeado.</p>
                </button>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                <div className="font-medium text-foreground">Template ativo da geração</div>
                <div className="mt-2 text-muted-foreground">{activeTemplate?.name || "Nenhum template ativo configurado"}</div>
                <div className="mt-1 text-muted-foreground">Essa definição é controlada apenas em Configurações → Documentação do Processo.</div>
              </div>
              {sourceMode === "linked_process" ? (
                <div className="space-y-4">
                  {approvedProcesses.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      {NO_APPROVED_PROCESSES_MESSAGE}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Processo mapeado</Label>
                      <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o processo" /></SelectTrigger>
                        <SelectContent>
                          {approvedProcesses.map((processo) => (
                            <SelectItem key={processo.id} value={processo.id}>
                              {processo.nome} • Aprovado
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {selectedProcess && approvedProcesses.length > 0 ? (
                    <div className="rounded-xl border p-4 text-sm">
                      <div className="font-medium text-foreground">{selectedProcess.nome}</div>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <div>Área responsável: {selectedProcess.area}</div>
                        <div>Responsável / Dono do processo: {selectedProcess.responsavel}</div>
                        <div>Versão do mapa utilizada: {buildMapVersionLabel(selectedProcessPayload)}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Nome do procedimento</Label>
                    <Input value={independentDraft.title} onChange={(e) => setIndependentDraft((current) => ({ ...current, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Área responsável</Label>
                    <Input value={independentDraft.area} onChange={(e) => setIndependentDraft((current) => ({ ...current, area: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável pelo documento</Label>
                    <Input value={independentDraft.owner} onChange={(e) => setIndependentDraft((current) => ({ ...current, owner: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={independentDraft.procedureCategory} onValueChange={(value) => setIndependentDraft((current) => ({ ...current, procedureCategory: value as ProcedureCategory }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROCEDURE_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Prévia operacional</CardTitle>
                  <CardDescription>
                    O documento nasce com o template ativo e pode ser vinculado a processo ou criado como procedimento independente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={handleGeneratePreview} disabled={isGenerating || !activeTemplate || (sourceMode === "linked_process" && !selectedProcessId)}>
                    <FilePlus2 className="mr-2 h-4 w-4" /> {isGenerating ? "Gerando..." : "Gerar Procedimento"}
                  </Button>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={previewTitle} onChange={(e) => setPreviewTitle(e.target.value)} placeholder="Título do procedimento" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo do procedimento</Label>
              <Textarea
                className="min-h-[420px] font-mono text-xs"
                value={previewMarkdown}
                onChange={(e) => setPreviewMarkdown(e.target.value)}
                placeholder="A prévia do procedimento aparecerá aqui."
              />
              {preview ? (
                <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Resumo</p>
                  <p className="text-muted-foreground">{preview.summary}</p>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDocumentOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDocument} disabled={!previewMarkdown.trim() || isPersisting}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> {isPersisting ? "Salvando..." : "Salvar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewingDoc)} onOpenChange={(open) => !open && setViewingDoc(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewingDoc?.title}</DialogTitle>
            <DialogDescription>
              {[viewingDoc?.code, viewingDoc?.revision, viewingDoc?.status].filter(Boolean).join(" • ")}
            </DialogDescription>
          </DialogHeader>
          {viewingDoc ? (
            <div className="flex flex-wrap gap-2">
              {viewingDoc.sourceMode === "linked_process" ? (
                <Badge variant="outline" className="gap-1">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Vinculado ao processo: <Link className="underline" to={viewingDoc.processLink || "#"}>{viewingDoc.processName}</Link> — {viewingDoc.linkedMapRevision || "Rev.00"}
                </Badge>
              ) : (
                <Badge variant="outline">📄 Procedimento independente — sem vínculo com processo</Badge>
              )}
            </div>
          ) : null}
          {newerApprovedRevision && viewingDoc ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">O processo vinculado possui uma versão mais recente ({newerApprovedRevision}). Deseja iniciar uma revisão deste procedimento?</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setViewingDoc(null);
                      setReviewingDoc(viewingDoc);
                      setReviewSourceMode("linked_process");
                      setReviewProcessId(viewingDoc.processId || "");
                      setReviewIndependentDraft({
                        title: viewingDoc.title,
                        area: viewingDoc.area,
                        owner: viewingDoc.documentOwner,
                        procedureCategory: viewingDoc.procedureCategory,
                      });
                    }}
                  >
                    <GitBranch className="mr-2 h-4 w-4" /> Iniciar revisão
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          <Textarea readOnly className="min-h-[520px] font-mono text-xs" value={viewingDoc?.contentMarkdown || ""} />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingDoc)} onOpenChange={(open) => !open && setEditingDoc(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
            <DialogDescription>Disponível apenas para documentos em Rascunho ou Em revisão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={editingDoc?.title || ""} onChange={(e) => setEditingDoc((current) => current ? { ...current, title: e.target.value } : current)} />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea className="min-h-[420px] font-mono text-xs" value={editingDoc?.contentMarkdown || ""} onChange={(e) => setEditingDoc((current) => current ? { ...current, contentMarkdown: e.target.value } : current)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reviewingDoc)} onOpenChange={(open) => !open && setReviewingDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar documento</DialogTitle>
            <DialogDescription>
              A nova revisão incrementa o número da versão, registra o motivo e permite redefinir a origem do procedimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setReviewSourceMode("linked_process")}
                className={`rounded-xl border p-4 text-left transition ${reviewSourceMode === "linked_process" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <div className="font-medium">🔗 Vinculado a processo mapeado</div>
                <p className="mt-2 text-sm text-muted-foreground">Mantém rastreabilidade com o processo e a revisão do mapa.</p>
              </button>
              <button
                type="button"
                onClick={() => setReviewSourceMode("independent")}
                className={`rounded-xl border p-4 text-left transition ${reviewSourceMode === "independent" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <div className="font-medium">📄 Procedimento independente</div>
                <p className="mt-2 text-sm text-muted-foreground">Segue sem vínculo com processo mapeado.</p>
              </button>
            </div>
            {reviewSourceMode === "linked_process" ? (
              <div className="space-y-2">
                <Label>Processo vinculado</Label>
                {approvedProcesses.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    {NO_APPROVED_PROCESSES_MESSAGE}
                  </div>
                ) : (
                  <Select value={reviewProcessId} onValueChange={setReviewProcessId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o processo" /></SelectTrigger>
                    <SelectContent>
                      {approvedProcesses.map((processo) => (
                        <SelectItem key={processo.id} value={processo.id}>
                          {processo.nome} • Aprovado
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Nome do procedimento</Label>
                  <Input value={reviewIndependentDraft.title} onChange={(e) => setReviewIndependentDraft((current) => ({ ...current, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Área responsável</Label>
                  <Input value={reviewIndependentDraft.area} onChange={(e) => setReviewIndependentDraft((current) => ({ ...current, area: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Responsável pelo documento</Label>
                  <Input value={reviewIndependentDraft.owner} onChange={(e) => setReviewIndependentDraft((current) => ({ ...current, owner: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={reviewIndependentDraft.procedureCategory} onValueChange={(value) => setReviewIndependentDraft((current) => ({ ...current, procedureCategory: value as ProcedureCategory }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROCEDURE_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Quem revisou</Label>
              <Input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Motivo da revisão</Label>
              <Textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Ex.: ajuste no fluxo de aprovação comercial." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewingDoc(null)}>Cancelar</Button>
            <Button onClick={handleReview}>
              <RotateCcw className="mr-2 h-4 w-4" /> Criar nova revisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(approvalDoc)} onOpenChange={(open) => !open && setApprovalDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovação do documento</DialogTitle>
            <DialogDescription>Registre o encaminhamento, aprovação ou reprovação com responsável e data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={approvalDecision} onValueChange={(value) => setApprovalDecision(value as ApprovalDecision)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="submit">Enviar para aprovação</SelectItem>
                  <SelectItem value="approve">Aprovar</SelectItem>
                  <SelectItem value="reject">Reprovar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do responsável</Label>
              <Input value={approvalName} onChange={(e) => setApprovalName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cargo do responsável</Label>
              <Input value={approvalRole} onChange={(e) => setApprovalRole(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={approvalComment} onChange={(e) => setApprovalComment(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDoc(null)}>Cancelar</Button>
            <Button onClick={handleApproval}>
              {approvalDecision === "approve" ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(distributionDoc)} onOpenChange={(open) => !open && setDistributionDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribuir documento</DialogTitle>
            <DialogDescription>Registre áreas ou pessoas que receberam o procedimento e quem fez a distribuição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Distribuído por</Label>
              <Input value={distributedBy} onChange={(e) => setDistributedBy(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Áreas ou pessoas</Label>
              <Textarea value={distributionRecipients} onChange={(e) => setDistributionRecipients(e.target.value)} placeholder="Uma por linha ou separadas por vírgula." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDistributionDoc(null)}>Cancelar</Button>
            <Button onClick={handleDistribution}>
              <Send className="mr-2 h-4 w-4" /> Registrar distribuição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
