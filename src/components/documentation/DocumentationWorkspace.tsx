import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Brain,
  CheckCircle2,
  Copy,
  FileCog,
  FileSearch,
  Files,
  Lock,
  Plus,
  Save,
  Sparkles,
  Upload,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { processos } from "@/data/mock-processos";
import {
  buildMappedProcessPayload,
  createEmptyManualDescription,
  DOCUMENTATION_TABS,
  DOCUMENT_DETAIL_LEVELS,
  DOCUMENT_STATUSES,
  DOCUMENT_TONES,
  DOCUMENT_TYPES,
  formatRevision,
  loadDocumentationState,
  loadGeneratedDocuments,
  nextDocumentCode,
  saveDocumentationState,
  saveGeneratedDocuments,
  type DocumentationState,
  type DocumentOrigin,
  type DocumentPreviewData,
  type DocumentSection,
  type DocumentTemplate,
  type GeneratedDocumentRecord,
  type ManualDescriptionInput,
} from "@/data/documentation-config";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";

const LEGACY_TEMPLATE_KEY = "process:docTemplate";

type CompanyContext = {
  companyId: string | null;
  companyName: string;
  userId: string;
};

const DEFAULT_COMPANY_CONTEXT: CompanyContext = {
  companyId: null,
  companyName: "Empresa local",
  userId: "local-user",
};

const ORIGIN_OPTIONS: { id: DocumentOrigin | "uploaded_document"; title: string; description: string; disabled?: boolean }[] = [
  {
    id: "mapped_process",
    title: "A partir de processo mapeado",
    description: "Use os dados estruturados de um processo já cadastrado para gerar a documentação.",
  },
  {
    id: "manual_description",
    title: "A partir de descrição livre",
    description: "Descreva o processo e deixe a IA estruturar o documento com base no modelo selecionado.",
  },
  {
    id: "uploaded_document",
    title: "A partir de documento existente",
    description: "Importe um documento para organizar, revisar ou usar como fonte futuramente.",
    disabled: true,
  },
];

const INTELLIGENT_OPTIONS: Array<{
  key: keyof DocumentTemplate["intelligentConfig"];
  label: string;
  icon: LucideIcon;
}> = [
  { key: "allowAsAISource", label: "Usar como fonte de IA", icon: Brain },
  { key: "allowIndexing", label: "Permitir indexação", icon: FileCog },
  { key: "allowEmbeddings", label: "Gerar embeddings", icon: Sparkles },
  { key: "allowCitations", label: "Permitir citações", icon: Files },
  { key: "allowNotes", label: "Permitir notas", icon: Bot },
  { key: "allowAutoSummary", label: "Permitir resumos", icon: Wand2 },
  { key: "allowFaq", label: "Permitir FAQ", icon: FileSearch },
  { key: "allowStudyGuide", label: "Permitir guia de estudo", icon: Brain },
  { key: "allowGeneratedChecklist", label: "Gerar checklist", icon: CheckCircle2 },
  { key: "allowFutureAudio", label: "Preparar áudio futuro", icon: Upload },
];

function templateStatusBadge(template: DocumentTemplate) {
  if (template.isSystemTemplate) return <Badge variant="secondary">Padrão do sistema</Badge>;
  if (template.isDefault) return <Badge>Padrão da empresa</Badge>;
  return <Badge variant="outline">Personalizado</Badge>;
}

function StatCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function buildSectionFallbackContent(section: DocumentSection, source: Record<string, unknown>) {
  const title = section.sectionTitle.toLowerCase();
  const normalized = source.normalized as Record<string, unknown> | undefined;

  if (title.includes("objetivo")) return String(source.objective ?? normalized?.objetivo ?? "Não informado.");
  if (title.includes("aplica") || title.includes("descri")) {
    return String(source.generalDescription ?? normalized?.descricao ?? normalized?.objetivo ?? "Não informado.");
  }
  if (title.includes("respons")) return String(source.stakeholders ?? normalized?.donoProcesso ?? "Não informado.");
  if (title.includes("entradas")) return String(source.inputs ?? normalized?.entradas ?? "Não informado.");
  if (title.includes("saídas") || title.includes("saidas")) return String(source.outputs ?? normalized?.saidas ?? "Não informado.");
  if (title.includes("sistemas")) {
    const systems = source.systems || normalized?.etapas;
    if (Array.isArray(systems)) {
      return systems
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "sistema" in item) return String((item as { sistema?: string }).sistema || "");
          if (item && typeof item === "object" && "ferramentaDocumento" in item) return String((item as { ferramentaDocumento?: string }).ferramentaDocumento || "");
          return "";
        })
        .filter(Boolean)
        .join(", ") || "Não informado.";
    }
    return String(systems ?? "Não informado.");
  }
  if (title.includes("etapas") || title.includes("checklist")) {
    const steps = normalized?.etapas;
    if (Array.isArray(steps)) {
      return steps
        .map((step, index) => {
          if (typeof step === "string") return `${index + 1}. ${step}`;
          if (step && typeof step === "object") {
            const row = step as { atividade?: string; responsavel?: string; sistema?: string };
            return `${index + 1}. ${row.atividade || "Atividade"} | Responsável: ${row.responsavel || "Não informado"} | Sistema: ${row.sistema || "Não informado"}`;
          }
          return `${index + 1}. Não informado`;
        })
        .join("\n");
    }
    return String(source.generalDescription ?? "Não informado.");
  }
  if (title.includes("riscos")) {
    const risks = source.knownRisks || normalized?.riscos;
    if (Array.isArray(risks)) {
      return risks
        .map((risk) => {
          if (typeof risk === "string") return `- ${risk}`;
          if (risk && typeof risk === "object") {
            const row = risk as { risco?: string; consequencia?: string; impacto?: string; probabilidade?: string };
            return `- ${row.risco || "Risco"}${row.consequencia ? ` | Consequência: ${row.consequencia}` : ""}${row.probabilidade ? ` | Probabilidade: ${row.probabilidade}` : ""}${row.impacto ? ` | Impacto: ${row.impacto}` : ""}`;
          }
          return "- Não informado";
        })
        .join("\n");
    }
    return String(risks ?? "Não informado.");
  }
  if (title.includes("controle")) return String(source.existingControls ?? "Validar controles existentes com a empresa.");
  if (title.includes("indicadores")) {
    const indicators = source.desiredIndicators || normalized?.indicadores;
    if (Array.isArray(indicators)) {
      return indicators
        .map((indicator) => {
          if (typeof indicator === "string") return `- ${indicator}`;
          if (indicator && typeof indicator === "object") {
            const row = indicator as { nome?: string; formula?: string; meta?: string; objetivo?: string };
            return `- ${row.nome || "Indicador"}${row.objetivo ? ` | Objetivo: ${row.objetivo}` : ""}${row.formula ? ` | Fórmula: ${row.formula}` : ""}${row.meta ? ` | Meta: ${row.meta}` : ""}`;
          }
          return "- Não informado";
        })
        .join("\n");
    }
    return String(indicators ?? "Não informado.");
  }
  if (title.includes("anexo")) return "Anexos e evidências devem ser vinculados conforme política documental da empresa.";
  if (title.includes("histórico")) return "Versão inicial gerada para revisão. Registrar alterações futuras no histórico de revisão.";

  return section.sectionDescription || "Não informado.";
}

function buildLocalPreview(
  template: DocumentTemplate,
  sections: DocumentSection[],
  origin: DocumentOrigin,
  mappedProcessData: ReturnType<typeof buildMappedProcessPayload> | null,
  manualDescription: ManualDescriptionInput,
): DocumentPreviewData {
  const source = origin === "mapped_process" ? (mappedProcessData || {}) : manualDescription;
  const contentMarkdown = [
    `# ${manualDescription.title || template.name}`,
    "",
    `> Documento gerado em modo local para revisão. Origem: ${origin === "mapped_process" ? "processo mapeado" : "descrição livre"}.`,
    "",
    ...sections.flatMap((section) => [
      `## ${section.sectionTitle}`,
      "",
      buildSectionFallbackContent(section, source as Record<string, unknown>),
      "",
    ]),
  ].join("\n").trim();

  return {
    title: manualDescription.title || template.name,
    contentMarkdown,
    contentText: contentMarkdown.replace(/[#>*`-]/g, "").trim(),
    summary: origin === "mapped_process"
      ? "Prévia gerada com base no processo selecionado. Revise antes de salvar."
      : "Prévia gerada com base na descrição livre. Revise antes de salvar.",
    pointsOfAttention: [
      "Validar dados críticos antes de publicar.",
      "Confirmar anexos obrigatórios e revisão por responsável.",
    ],
    suggestedRisks: [],
    suggestedIndicators: [],
    generationMetadata: {
      mode: "frontend-fallback",
      origin,
      sectionsCount: sections.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

export default function DocumentationWorkspace() {
  const { toast } = useToast();
  const [companyContext, setCompanyContext] = useState<CompanyContext>(DEFAULT_COMPANY_CONTEXT);
  const [state, setState] = useState<DocumentationState | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocumentRecord[]>([]);
  const [activeTab, setActiveTab] = useState("modelos");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isNewDocumentOpen, setIsNewDocumentOpen] = useState(false);
  const [documentOrigin, setDocumentOrigin] = useState<DocumentOrigin>("mapped_process");
  const [selectedProcessId, setSelectedProcessId] = useState<string>(processos[0]?.id ?? "");
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [manualDescription, setManualDescription] = useState<ManualDescriptionInput>(createEmptyManualDescription(""));
  const [preview, setPreview] = useState<DocumentPreviewData | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPersistingDoc, setIsPersistingDoc] = useState(false);
  const [customVariable, setCustomVariable] = useState({
    variableKey: "",
    variableLabel: "",
    sourceField: "",
    exampleValue: "",
  });

  useEffect(() => {
    const loadWorkspace = async () => {
      const localCompanyId = window.localStorage.getItem("process:activeEmpresaId");
      const localCompanyName = window.localStorage.getItem("process:activeEmpresaNome") || "Empresa local";
      const nextContext: CompanyContext = {
        companyId: localCompanyId,
        companyName: localCompanyName,
        userId: "local-user",
      };

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user?.id) {
          nextContext.userId = userData.user.id;
          const resolvedCompanyId = await resolveAccessibleCompanyId(userData.user.id, localCompanyId);
          if (resolvedCompanyId) {
            nextContext.companyId = resolvedCompanyId;
          }
        }
      } catch {
        // fallback local sem sessão
      }

      const persistedState = loadDocumentationState(nextContext.companyId, nextContext.userId);
      const legacyTemplate = window.localStorage.getItem(LEGACY_TEMPLATE_KEY);
      const explicitStorageKey = `process:documentation:${nextContext.companyId ?? "local"}`;

      if (legacyTemplate && !window.localStorage.getItem(explicitStorageKey)) {
        persistedState.templates[0].referenceContent = legacyTemplate;
      }

      setCompanyContext(nextContext);
      setState(persistedState);
      setSelectedTemplateId(persistedState.generationSettings.defaultTemplateId);
      setManualDescription(createEmptyManualDescription(persistedState.generationSettings.defaultTemplateId));
      setGeneratedDocs(loadGeneratedDocuments(nextContext.companyId));
      setIsLoaded(true);
    };

    void loadWorkspace();
  }, []);

  const activeTemplate = useMemo(
    () => state?.templates.find((template) => template.id === selectedTemplateId) ?? state?.templates[0] ?? null,
    [selectedTemplateId, state],
  );

  useEffect(() => {
    if (activeTemplate) {
      setSelectedSectionIds(activeTemplate.sections.filter((section) => section.isActive).map((section) => section.id));
      setManualDescription((current) => ({
        ...current,
        templateId: activeTemplate.id,
        documentType: activeTemplate.documentType,
        title: current.title || activeTemplate.name,
      }));
    }
  }, [activeTemplate]);

  const mappedProcessPayload = useMemo(() => buildMappedProcessPayload(selectedProcessId), [selectedProcessId]);

  const persistState = (nextState: DocumentationState) => {
    setState(nextState);
    saveDocumentationState(companyContext.companyId, nextState);
  };

  const persistGeneratedDocs = (docs: GeneratedDocumentRecord[]) => {
    setGeneratedDocs(docs);
    saveGeneratedDocuments(companyContext.companyId, docs);
  };

  const updateActiveTemplate = (updater: (template: DocumentTemplate) => DocumentTemplate) => {
    if (!state || !activeTemplate) return;
    const updatedTemplates = state.templates.map((template) =>
      template.id === activeTemplate.id
        ? { ...updater(template), updatedAt: new Date().toISOString() }
        : template,
    );
    persistState({ ...state, templates: updatedTemplates });
  };

  const handleSaveConfiguration = () => {
    if (!state) return;
    setIsSaving(true);
    saveDocumentationState(companyContext.companyId, state);
    window.localStorage.setItem(LEGACY_TEMPLATE_KEY, activeTemplate?.referenceContent || "");
    toast({
      title: "Configuração salva",
      description: "A central de documentação foi atualizada para a empresa ativa.",
    });
    setIsSaving(false);
  };

  const extractFromPdf = async (file: File): Promise<string> => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker as string;
    const buf = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: buf });
    const pdf = await loadingTask.promise;
    let full = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((it: unknown) => {
          const rec = it as { str?: unknown };
          return typeof rec.str === "string" ? rec.str : "";
        })
        .filter((s) => s && s.trim().length > 0)
        .join(" ");
      full += "\n" + pageText;
    }
    return full.trim();
  };

  const extractFromDocx = async (file: File): Promise<string> => {
    const mammoth = await import("mammoth/mammoth.browser");
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    return String(res.value || "").trim();
  };

  const extractFromImage = async (file: File): Promise<string> => {
    const Tesseract = await import("tesseract.js");
    const result = await Tesseract.recognize(file, "por+eng");
    return String(result.data?.text || "").trim();
  };

  const handleImportReferenceFile = async (file: File) => {
    if (!activeTemplate) return;
    setIsImporting(true);
    try {
      const name = file.name.toLowerCase();
      let text = "";
      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        text = await extractFromPdf(file);
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) {
        text = await extractFromDocx(file);
      } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
        text = await extractFromImage(file);
      } else {
        toast({
          title: "Formato não suportado",
          description: "Use PDF, DOCX ou imagem para importar o documento base.",
          variant: "destructive",
        });
        return;
      }

      updateActiveTemplate((template) => ({
        ...template,
        referenceContent: `${template.referenceContent.trim()}\n\n${text.slice(0, 20000)}`.trim(),
      }));
      toast({
        title: "Documento importado",
        description: "O conteúdo foi anexado ao texto-base do modelo ativo.",
      });
    } catch (error) {
      toast({
        title: "Falha ao importar",
        description: error instanceof Error ? error.message : "Erro ao processar o arquivo informado.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreateTemplate = () => {
    if (!state || !activeTemplate) return;
    const now = new Date().toISOString();
    const newTemplate: DocumentTemplate = {
      ...activeTemplate,
      id: crypto.randomUUID(),
      name: `Novo modelo ${state.templates.length + 1}`,
      description: "Modelo personalizado criado a partir do template ativo.",
      version: "1.0",
      isDefault: false,
      isSystemTemplate: false,
      createdBy: companyContext.userId,
      createdAt: now,
      updatedAt: now,
      sections: activeTemplate.sections.map((section, index) => ({
        ...section,
        id: crypto.randomUUID(),
        sortOrder: index + 1,
      })),
      variables: activeTemplate.variables.map((variable) => ({ ...variable, id: crypto.randomUUID() })),
    };

    const nextState = {
      ...state,
      templates: [newTemplate, ...state.templates],
    };
    persistState(nextState);
    setSelectedTemplateId(newTemplate.id);
    toast({ title: "Modelo criado", description: "Um novo template documental foi criado a partir do modelo atual." });
  };

  const handleDuplicateTemplate = () => {
    if (!state || !activeTemplate) return;
    const now = new Date().toISOString();
    const duplicate: DocumentTemplate = {
      ...activeTemplate,
      id: crypto.randomUUID(),
      name: `${activeTemplate.name} (cópia)`,
      isDefault: false,
      isSystemTemplate: false,
      createdBy: companyContext.userId,
      createdAt: now,
      updatedAt: now,
      sections: activeTemplate.sections.map((section) => ({ ...section, id: crypto.randomUUID() })),
      variables: activeTemplate.variables.map((variable) => ({ ...variable, id: crypto.randomUUID() })),
    };
    const nextState = { ...state, templates: [duplicate, ...state.templates] };
    persistState(nextState);
    setSelectedTemplateId(duplicate.id);
    toast({ title: "Modelo duplicado", description: "Crie variações por empresa sem alterar o template de origem." });
  };

  const handleSetDefaultTemplate = () => {
    if (!state || !activeTemplate) return;
    const updatedTemplates = state.templates.map((template) => ({
      ...template,
      isDefault: template.id === activeTemplate.id,
      updatedAt: template.id === activeTemplate.id ? new Date().toISOString() : template.updatedAt,
    }));
    const nextState = {
      templates: updatedTemplates,
      generationSettings: {
        ...state.generationSettings,
        defaultTemplateId: activeTemplate.id,
      },
    };
    persistState(nextState);
    toast({ title: "Modelo padrão atualizado", description: "Este template será sugerido por padrão na geração documental." });
  };

  const handleToggleTemplateStatus = () => {
    updateActiveTemplate((template) => ({ ...template, isActive: !template.isActive }));
  };

  const handleAddSection = () => {
    if (!activeTemplate) return;
    const nextOrder = activeTemplate.sections.length + 1;
    updateActiveTemplate((template) => ({
      ...template,
      sections: [
        ...template.sections,
        {
          id: crypto.randomUUID(),
          sectionKey: `nova_secao_${nextOrder}`,
          sectionTitle: `Nova seção ${nextOrder}`,
          sectionDescription: "Descreva o objetivo desta seção documental.",
          sortOrder: nextOrder,
          isRequired: false,
          isActive: true,
          sourceType: "manual",
          generatedByAI: true,
          allowsAttachments: false,
          includeInFinalDocument: true,
          includeInAIIndexing: true,
        },
      ],
    }));
  };

  const handleUpdateSection = (sectionId: string, updater: (section: DocumentSection) => DocumentSection) => {
    updateActiveTemplate((template) => ({
      ...template,
      sections: template.sections.map((section) =>
        section.id === sectionId ? updater(section) : section,
      ),
    }));
  };

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    if (!activeTemplate) return;
    const sections = [...activeTemplate.sections].sort((a, b) => a.sortOrder - b.sortOrder);
    const currentIndex = sections.findIndex((section) => section.id === sectionId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sections.length) return;
    const [moved] = sections.splice(currentIndex, 1);
    sections.splice(targetIndex, 0, moved);
    updateActiveTemplate((template) => ({
      ...template,
      sections: sections.map((section, index) => ({ ...section, sortOrder: index + 1 })),
    }));
  };

  const handleAddCustomVariable = () => {
    if (!activeTemplate || !customVariable.variableKey.trim() || !customVariable.variableLabel.trim()) {
      toast({
        title: "Variável incompleta",
        description: "Informe ao menos chave e nome amigável para a nova variável.",
        variant: "destructive",
      });
      return;
    }

    updateActiveTemplate((template) => ({
      ...template,
      variables: [
        ...template.variables,
        {
          id: crypto.randomUUID(),
          variableKey: customVariable.variableKey,
          variableLabel: customVariable.variableLabel,
          variableDescription: "Variável personalizada da empresa.",
          sourceField: customVariable.sourceField,
          isRequired: false,
          dataType: "texto",
          exampleValue: customVariable.exampleValue,
          isCustom: true,
        },
      ],
    }));
    setCustomVariable({ variableKey: "", variableLabel: "", sourceField: "", exampleValue: "" });
  };

  const selectedSections = useMemo(
    () => activeTemplate?.sections.filter((section) => selectedSectionIds.includes(section.id)) ?? [],
    [activeTemplate, selectedSectionIds],
  );

  const handleGeneratePreview = async () => {
    if (!activeTemplate) return;
    if (documentOrigin === "mapped_process" && !mappedProcessPayload) {
      toast({
        title: "Processo não encontrado",
        description: "Selecione um processo válido para gerar o documento estruturado.",
        variant: "destructive",
      });
      return;
    }
    if (documentOrigin === "manual_description" && !manualDescription.generalDescription.trim()) {
      toast({
        title: "Descrição obrigatória",
        description: "Preencha a descrição geral do processo para acionar a IA documental.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        template: activeTemplate,
        sections: selectedSections,
        mappedProcessData: documentOrigin === "mapped_process" ? mappedProcessPayload : null,
        manualDescription: documentOrigin === "manual_description" ? manualDescription : null,
        generationConfig: activeTemplate.promptConfig,
        companyContext,
      };

      const { data, error } = await supabase.functions.invoke("ai-generate-document", { body: payload });
      if (error) throw error;

      const nextPreview: DocumentPreviewData = {
        title: data?.title || manualDescription.title || activeTemplate.name,
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
      toast({ title: "Documento gerado", description: "A prévia foi montada e está pronta para revisão." });
    } catch {
      const fallback = buildLocalPreview(activeTemplate, selectedSections, documentOrigin, mappedProcessPayload, manualDescription);
      setPreview(fallback);
      setPreviewTitle(fallback.title);
      setPreviewMarkdown(fallback.contentMarkdown);
      toast({
        title: "Prévia gerada em modo local",
        description: "A função de IA não respondeu. Foi criada uma versão incremental para revisão.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGeneratedDocument = async () => {
    if (!activeTemplate || !preview) return;
    setIsPersistingDoc(true);
    const now = new Date().toISOString();
    const documentCode = nextDocumentCode(generatedDocs);

    const documentRecord: GeneratedDocumentRecord = {
      id: crypto.randomUUID(),
      code: documentCode,
      companyId: companyContext.companyId,
      processId: documentOrigin === "mapped_process" ? selectedProcessId : null,
      processMappingId: null,
      processName: documentOrigin === "mapped_process" ? mappedProcessPayload?.process.nome || "Processo mapeado" : manualDescription.title || "Documento avulso",
      area: documentOrigin === "mapped_process" ? mappedProcessPayload?.process.area || "" : manualDescription.area,
      templateId: activeTemplate.id,
      documentOrigin,
      documentType: documentOrigin === "manual_description" ? manualDescription.documentType : activeTemplate.documentType,
      title: previewTitle,
      descriptionInput: documentOrigin === "manual_description" ? manualDescription.generalDescription : undefined,
      contentMarkdown: previewMarkdown,
      contentText: previewMarkdown.replace(/[#>*`-]/g, "").trim(),
      summary: preview.summary,
      pointsOfAttention: preview.pointsOfAttention,
      suggestedRisks: preview.suggestedRisks,
      suggestedIndicators: preview.suggestedIndicators,
      generationMetadata: {
        ...preview.generationMetadata,
        templateName: activeTemplate.name,
        code: documentCode,
      },
      status: activeTemplate.approvalVersioning.requireApproval ? "Em revisão" : "Rascunho",
      version: "1.0",
      revision: formatRevision(0),
      revisionNumber: 0,
      approverName: "",
      approverRole: "",
      distributedTo: [],
      updatedAt: now,
      createdBy: companyContext.userId,
      createdAt: now,
      aiModel: String(preview.generationMetadata.ai_model || "ai-generate-document"),
      aiPromptUsed: activeTemplate.promptConfig.systemPrompt,
      revisionHistory: [],
      approvalHistory: [],
      distributionHistory: [],
    };

    const nextDocs = [documentRecord, ...generatedDocs];
    persistGeneratedDocs(nextDocs);

    let persistedToDatabase = false;

    if (companyContext.companyId && companyContext.userId !== "local-user") {
      try {
        const insertPayload: TablesInsert<"generated_documents"> = {
          company_id: companyContext.companyId,
          process_id: documentRecord.processId,
          process_mapping_id: null,
          template_id: activeTemplate.id,
          document_origin: documentOrigin,
          document_type: documentRecord.documentType,
          title: documentRecord.title,
          description_input: documentRecord.descriptionInput ?? null,
          content_text: documentRecord.contentText,
          content_markdown: documentRecord.contentMarkdown,
          status: documentRecord.status,
          version: documentRecord.version,
          ai_model: documentRecord.aiModel,
          ai_prompt_used: documentRecord.aiPromptUsed,
          generation_metadata: documentRecord.generationMetadata as Json,
          created_by: companyContext.userId,
        };

        const insertResult = await supabase.from("generated_documents").insert(insertPayload).select("id").single();
        if (insertResult.error) throw new Error(insertResult.error.message);
        persistedToDatabase = true;
      } catch {
        persistedToDatabase = false;
      }
    }

    toast({
      title: persistedToDatabase ? "Documento salvo no banco" : "Documento salvo localmente",
      description: persistedToDatabase
        ? "O documento foi salvo e já está preparado para versionamento futuro."
        : "A prévia foi mantida na camada local. A persistência no Supabase depende da migration/RLS aplicada no ambiente.",
    });

    setIsPersistingDoc(false);
    setIsNewDocumentOpen(false);
  };

  if (!isLoaded || !state || !activeTemplate) {
    return <div className="p-6">Carregando central de documentação...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2 max-w-3xl">
          <h1 className="text-2xl font-bold text-foreground">Documentação do Processo</h1>
          <p className="text-muted-foreground">
            Configure modelos documentais, regras de IA, variáveis, anexos, aprovação e a base para documentos inteligentes da empresa.
          </p>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Empresa: {companyContext.companyName}</Badge>
            <Badge variant="outline">company_id obrigatório</Badge>
            <Badge variant="outline">Pronto para markdown, chunks e embeddings</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSaveConfiguration} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> Salvar configuração
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Modelos ativos"
          value={String(state.templates.filter((template) => template.isActive).length)}
          description="Templates disponíveis para geração e parametrização."
        />
        <StatCard
          title="Variáveis dinâmicas"
          value={String(activeTemplate.variables.length)}
          description="Placeholders e campos prontos para reaproveitamento em múltiplos templates."
        />
        <StatCard
          title="Seções indexáveis"
          value={String(activeTemplate.sections.filter((section) => section.includeInAIIndexing).length)}
          description="Seções preparadas para chunkização e consulta inteligente futura."
        />
        <StatCard
          title="Aprovação"
          value={activeTemplate.approvalVersioning.requireApproval ? "Ativa" : "Opcional"}
          description="Fluxo documental com revisão antes da publicação final."
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {DOCUMENTATION_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="mt-1">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="modelos" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[360px,1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Biblioteca de modelos</CardTitle>
                <CardDescription>Gerencie templates padrão, personalizados e variações por empresa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateTemplate}>
                    <Plus className="mr-2 h-4 w-4" /> Novo modelo
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDuplicateTemplate}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicar
                  </Button>
                </div>
                {state.templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`w-full rounded-xl border p-4 text-left transition ${selectedTemplateId === template.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{template.name}</div>
                        <div className="text-sm text-muted-foreground">{template.documentType}</div>
                      </div>
                      {templateStatusBadge(template)}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>v{template.version}</span>
                      <span>{template.isActive ? "Ativo" : "Inativo"}</span>
                      <span>{template.sections.length} seções</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cadastro do modelo</CardTitle>
                <CardDescription>Defina metadados, conteúdo base e comportamento principal do template.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome do modelo</Label>
                    <Input value={activeTemplate.name} onChange={(e) => updateActiveTemplate((template) => ({ ...template, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de documento</Label>
                    <Select value={activeTemplate.documentType} onValueChange={(value) => updateActiveTemplate((template) => ({ ...template, documentType: value as DocumentTemplate["documentType"] }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Descrição</Label>
                    <Textarea value={activeTemplate.description} onChange={(e) => updateActiveTemplate((template) => ({ ...template, description: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Versão</Label>
                    <Input value={activeTemplate.version} onChange={(e) => updateActiveTemplate((template) => ({ ...template, version: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={activeTemplate.isActive ? "ativo" : "inativo"}
                      onValueChange={(value) => updateActiveTemplate((template) => ({ ...template, isActive: value === "ativo" }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
                  <div className="space-y-2">
                    <Label>Texto/base de referência</Label>
                    <Textarea
                      className="min-h-[260px]"
                      value={activeTemplate.referenceContent}
                      onChange={(e) => updateActiveTemplate((template) => ({ ...template, referenceContent: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-3 rounded-xl border p-4">
                    <div>
                      <h3 className="font-medium">Ações rápidas</h3>
                      <p className="text-sm text-muted-foreground">Importe um padrão existente ou ajuste o template padrão da empresa.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Documento base</Label>
                      <Input
                        type="file"
                        accept=".pdf,.docx,image/*"
                        disabled={isImporting}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          await handleImportReferenceFile(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleSetDefaultTemplate}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Definir como padrão
                    </Button>
                    <Button variant="outline" className="w-full" onClick={handleToggleTemplateStatus}>
                      <FileSearch className="mr-2 h-4 w-4" /> {activeTemplate.isActive ? "Inativar modelo" : "Ativar modelo"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="estrutura" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Estrutura do documento</CardTitle>
                <CardDescription>Ative, reordene e configure as seções do template selecionado.</CardDescription>
              </div>
              <Button onClick={handleAddSection}>
                <Plus className="mr-2 h-4 w-4" /> Nova seção
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...activeTemplate.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section) => (
                <div key={section.id} className="rounded-xl border p-4 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="grid gap-3 flex-1 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Título da seção</Label>
                        <Input
                          value={section.sectionTitle}
                          onChange={(e) => handleUpdateSection(section.id, (current) => ({ ...current, sectionTitle: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Chave</Label>
                        <Input
                          value={section.sectionKey}
                          onChange={(e) => handleUpdateSection(section.id, (current) => ({ ...current, sectionKey: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Descrição</Label>
                        <Textarea
                          value={section.sectionDescription}
                          onChange={(e) => handleUpdateSection(section.id, (current) => ({ ...current, sectionDescription: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" onClick={() => moveSection(section.id, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => moveSection(section.id, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                    <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Obrigatória</span><Switch checked={section.isRequired} onCheckedChange={(checked) => handleUpdateSection(section.id, (current) => ({ ...current, isRequired: checked }))} /></div>
                    <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Ativa</span><Switch checked={section.isActive} onCheckedChange={(checked) => handleUpdateSection(section.id, (current) => ({ ...current, isActive: checked }))} /></div>
                    <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Gerada por IA</span><Switch checked={section.generatedByAI} onCheckedChange={(checked) => handleUpdateSection(section.id, (current) => ({ ...current, generatedByAI: checked }))} /></div>
                    <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Aceita anexos</span><Switch checked={section.allowsAttachments} onCheckedChange={(checked) => handleUpdateSection(section.id, (current) => ({ ...current, allowsAttachments: checked }))} /></div>
                    <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">No documento final</span><Switch checked={section.includeInFinalDocument} onCheckedChange={(checked) => handleUpdateSection(section.id, (current) => ({ ...current, includeInFinalDocument: checked }))} /></div>
                    <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Na indexação IA</span><Switch checked={section.includeInAIIndexing} onCheckedChange={(checked) => handleUpdateSection(section.id, (current) => ({ ...current, includeInAIIndexing: checked }))} /></div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Origem</Label>
                      <Select value={section.sourceType} onValueChange={(value) => handleUpdateSection(section.id, (current) => ({ ...current, sourceType: value as DocumentSection["sourceType"] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="formulario">Formulário</SelectItem>
                          <SelectItem value="entrevista">Entrevista</SelectItem>
                          <SelectItem value="analise_fase">Análise por fase</SelectItem>
                          <SelectItem value="processo_mapeado">Processo mapeado</SelectItem>
                          <SelectItem value="descricao_livre">Descrição livre</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="hibrido">Híbrido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prompts e IA</CardTitle>
              <CardDescription>Centralize o comportamento da IA por template sem espalhar prompts pelo código.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Prompt de sistema</Label>
                  <Textarea
                    className="min-h-[180px]"
                    value={activeTemplate.promptConfig.systemPrompt}
                    onChange={(e) => updateActiveTemplate((template) => ({ ...template, promptConfig: { ...template.promptConfig, systemPrompt: e.target.value } }))}
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Instruções de geração</Label>
                  <Textarea
                    value={activeTemplate.promptConfig.generationInstructions}
                    onChange={(e) => updateActiveTemplate((template) => ({ ...template, promptConfig: { ...template.promptConfig, generationInstructions: e.target.value } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tom</Label>
                  <Select value={activeTemplate.promptConfig.tone} onValueChange={(value) => updateActiveTemplate((template) => ({ ...template, promptConfig: { ...template.promptConfig, tone: value as DocumentTemplate["promptConfig"]["tone"] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TONES.map((tone) => <SelectItem key={tone} value={tone}>{tone}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nível de detalhamento</Label>
                  <Select value={activeTemplate.promptConfig.detailLevel} onValueChange={(value) => updateActiveTemplate((template) => ({ ...template, promptConfig: { ...template.promptConfig, detailLevel: value as DocumentTemplate["promptConfig"]["detailLevel"] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_DETAIL_LEVELS.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Público-alvo</Label>
                  <Input
                    value={activeTemplate.promptConfig.targetAudience}
                    onChange={(e) => updateActiveTemplate((template) => ({ ...template, promptConfig: { ...template.promptConfig, targetAudience: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["includeRisks", "Incluir riscos"],
                  ["includeIndicators", "Incluir indicadores"],
                  ["includeImprovements", "Incluir melhorias"],
                  ["includeAutomationOpportunities", "Incluir automação"],
                  ["includeActionPlan", "Incluir plano de ação"],
                  ["includeChecklist", "Incluir checklist"],
                  ["generateExecutiveSummary", "Gerar resumo executivo"],
                  ["generateManagerVersion", "Gerar versão para gestor"],
                  ["generateCollaboratorVersion", "Gerar versão para colaborador"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={Boolean(activeTemplate.promptConfig[key as keyof typeof activeTemplate.promptConfig])}
                      onCheckedChange={(checked) =>
                        updateActiveTemplate((template) => ({
                          ...template,
                          promptConfig: { ...template.promptConfig, [key]: checked },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variaveis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Variáveis dinâmicas</CardTitle>
              <CardDescription>Mapeie placeholders do documento para campos reais do processo, descrição ou análises.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label>Chave</Label>
                  <Input placeholder="{{minha_variavel}}" value={customVariable.variableKey} onChange={(e) => setCustomVariable((current) => ({ ...current, variableKey: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nome amigável</Label>
                  <Input value={customVariable.variableLabel} onChange={(e) => setCustomVariable((current) => ({ ...current, variableLabel: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Campo de origem</Label>
                  <Input value={customVariable.sourceField} onChange={(e) => setCustomVariable((current) => ({ ...current, sourceField: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Exemplo</Label>
                  <Input value={customVariable.exampleValue} onChange={(e) => setCustomVariable((current) => ({ ...current, exampleValue: e.target.value }))} />
                </div>
                <div className="md:col-span-2 xl:col-span-4">
                  <Button onClick={handleAddCustomVariable}><Plus className="mr-2 h-4 w-4" />Adicionar variável</Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {activeTemplate.variables.map((variable) => (
                  <div key={variable.id} className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{variable.variableLabel}</div>
                        <div className="text-xs text-muted-foreground">{variable.variableKey}</div>
                      </div>
                      {variable.isCustom ? <Badge variant="outline">Custom</Badge> : <Badge variant="secondary">Sistema</Badge>}
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea value={variable.variableDescription} onChange={(e) => updateActiveTemplate((template) => ({ ...template, variables: template.variables.map((item) => item.id === variable.id ? { ...item, variableDescription: e.target.value } : item) }))} />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Origem</Label>
                        <Input value={variable.sourceField} onChange={(e) => updateActiveTemplate((template) => ({ ...template, variables: template.variables.map((item) => item.id === variable.id ? { ...item, sourceField: e.target.value } : item) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Exemplo</Label>
                        <Input value={variable.exampleValue} onChange={(e) => updateActiveTemplate((template) => ({ ...template, variables: template.variables.map((item) => item.id === variable.id ? { ...item, exampleValue: e.target.value } : item) }))} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm">Obrigatória</span>
                      <Switch checked={variable.isRequired} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, variables: template.variables.map((item) => item.id === variable.id ? { ...item, isRequired: checked } : item) }))} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anexos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anexos e evidências</CardTitle>
              <CardDescription>Defina formatos permitidos, obrigatoriedade e preparo para indexação futura.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Anexos obrigatórios</Label>
                  <Textarea
                    value={activeTemplate.attachmentRules.requiredTypes.join(", ")}
                    onChange={(e) => updateActiveTemplate((template) => ({ ...template, attachmentRules: { ...template.attachmentRules, requiredTypes: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Anexos opcionais</Label>
                  <Textarea
                    value={activeTemplate.attachmentRules.optionalTypes.join(", ")}
                    onChange={(e) => updateActiveTemplate((template) => ({ ...template, attachmentRules: { ...template.attachmentRules, optionalTypes: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Formatos permitidos</Label>
                  <Input
                    value={activeTemplate.attachmentRules.allowedFormats.join(", ")}
                    onChange={(e) => updateActiveTemplate((template) => ({ ...template, attachmentRules: { ...template.attachmentRules, allowedFormats: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Limite de tamanho (MB)</Label>
                  <Input
                    type="number"
                    value={activeTemplate.attachmentRules.maxSizeMb}
                    onChange={(e) => updateActiveTemplate((template) => ({ ...template, attachmentRules: { ...template.attachmentRules, maxSizeMb: Number(e.target.value) || 0 } }))}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Anexos por fase</span><Switch checked={activeTemplate.attachmentRules.perPhase} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, attachmentRules: { ...template.attachmentRules, perPhase: checked } }))} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Por tipo de documento</span><Switch checked={activeTemplate.attachmentRules.perDocumentType} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, attachmentRules: { ...template.attachmentRules, perDocumentType: checked } }))} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">No documento final</span><Switch checked={activeTemplate.attachmentRules.includeInFinalDocument} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, attachmentRules: { ...template.attachmentRules, includeInFinalDocument: checked } }))} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Preparar indexação</span><Switch checked={activeTemplate.attachmentRules.includeInFutureIndexing} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, attachmentRules: { ...template.attachmentRules, includeInFutureIndexing: checked } }))} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aprovacao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Aprovação e versionamento</CardTitle>
              <CardDescription>Defina numeração de versão, revisão periódica e políticas de publicação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status padrão</Label>
                  <Select value={activeTemplate.approvalVersioning.status} onValueChange={(value) => updateActiveTemplate((template) => ({ ...template, approvalVersioning: { ...template.approvalVersioning, status: value as DocumentTemplate["approvalVersioning"]["status"] } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Perfil aprovador</Label>
                  <Select value={activeTemplate.approvalVersioning.approverRole} onValueChange={(value) => updateActiveTemplate((template) => ({ ...template, approvalVersioning: { ...template.approvalVersioning, approverRole: value } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="analista">Analista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prazo de revisão (dias)</Label>
                  <Input type="number" value={activeTemplate.approvalVersioning.reviewPeriodDays} onChange={(e) => updateActiveTemplate((template) => ({ ...template, approvalVersioning: { ...template.approvalVersioning, reviewPeriodDays: Number(e.target.value) || 0 } }))} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Numeração automática</span><Switch checked={activeTemplate.approvalVersioning.autoVersionNumbering} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, approvalVersioning: { ...template.approvalVersioning, autoVersionNumbering: checked } }))} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Exigir aprovação</span><Switch checked={activeTemplate.approvalVersioning.requireApproval} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, approvalVersioning: { ...template.approvalVersioning, requireApproval: checked } }))} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Versionamento</span><Switch checked={activeTemplate.approvalVersioning.versioningEnabled} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, approvalVersioning: { ...template.approvalVersioning, versioningEnabled: checked } }))} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Revisão periódica</span><Switch checked={activeTemplate.approvalVersioning.periodicReviewEnabled} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, approvalVersioning: { ...template.approvalVersioning, periodicReviewEnabled: checked } }))} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Publicação automática</span><Switch checked={activeTemplate.approvalVersioning.autoPublishAfterApproval} onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, approvalVersioning: { ...template.approvalVersioning, autoPublishAfterApproval: checked } }))} /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inteligentes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integração com Documentos Inteligentes</CardTitle>
              <CardDescription>Prepare documentos em markdown para chunks, embeddings, citações, notas e consultas futuras.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {INTELLIGENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                  <div key={option.key} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-secondary p-2"><Icon className="h-4 w-4 text-secondary-foreground" /></div>
                        <span className="text-sm font-medium">{option.label}</span>
                      </div>
                      <Switch
                        checked={Boolean(activeTemplate.intelligentConfig[option.key])}
                        onCheckedChange={(checked) => updateActiveTemplate((template) => ({ ...template, intelligentConfig: { ...template.intelligentConfig, [option.key]: checked } }))}
                      />
                    </div>
                  </div>
                )})}
              </div>
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                A base já fica preparada para armazenar markdown, versões, metadados, chunks e embeddings. O chat documental estilo NotebookLM não é implementado agora, mas o modelo e a tela já deixam o caminho aberto para essa evolução.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isNewDocumentOpen} onOpenChange={setIsNewDocumentOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Documento</DialogTitle>
            <DialogDescription>Escolha a origem, selecione o modelo e gere uma prévia editável antes de salvar.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {ORIGIN_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => !option.disabled && setDocumentOrigin(option.id as DocumentOrigin)}
                  className={`rounded-xl border p-4 text-left transition ${documentOrigin === option.id ? "border-primary bg-primary/5" : "border-border"} ${option.disabled ? "opacity-50" : "hover:border-primary/40"}`}
                >
                  <div className="font-medium">{option.title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
                  {option.disabled ? <Badge variant="outline" className="mt-3">Em breve</Badge> : null}
                </button>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Configuração da geração</CardTitle>
                    <CardDescription>Selecione template, seções e origem dos dados do documento.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Modelo documental</Label>
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {state.templates.filter((template) => template.isActive).map((template) => (
                              <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {documentOrigin === "mapped_process" ? (
                        <div className="space-y-2">
                          <Label>Processo mapeado</Label>
                          <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {processos.map((processo) => (
                                <SelectItem key={processo.id} value={processo.id}>{processo.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Título do documento</Label>
                          <Input value={manualDescription.title} onChange={(e) => setManualDescription((current) => ({ ...current, title: e.target.value }))} />
                        </div>
                      )}
                    </div>

                    {documentOrigin === "manual_description" ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Tipo de documento</Label>
                          <Select value={manualDescription.documentType} onValueChange={(value) => setManualDescription((current) => ({ ...current, documentType: value as ManualDescriptionInput["documentType"] }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DOCUMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Área / Departamento</Label>
                          <Input value={manualDescription.area} onChange={(e) => setManualDescription((current) => ({ ...current, area: e.target.value }))} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Objetivo do processo</Label>
                          <Textarea value={manualDescription.objective} onChange={(e) => setManualDescription((current) => ({ ...current, objective: e.target.value }))} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Descrição geral</Label>
                          <Textarea className="min-h-[120px]" value={manualDescription.generalDescription} onChange={(e) => setManualDescription((current) => ({ ...current, generalDescription: e.target.value }))} />
                        </div>
                        <div className="space-y-2"><Label>Entradas</Label><Textarea value={manualDescription.inputs} onChange={(e) => setManualDescription((current) => ({ ...current, inputs: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Saídas</Label><Textarea value={manualDescription.outputs} onChange={(e) => setManualDescription((current) => ({ ...current, outputs: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Responsáveis</Label><Textarea value={manualDescription.stakeholders} onChange={(e) => setManualDescription((current) => ({ ...current, stakeholders: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Sistemas utilizados</Label><Textarea value={manualDescription.systems} onChange={(e) => setManualDescription((current) => ({ ...current, systems: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Documentos relacionados</Label><Textarea value={manualDescription.relatedDocuments} onChange={(e) => setManualDescription((current) => ({ ...current, relatedDocuments: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Regras de negócio</Label><Textarea value={manualDescription.businessRules} onChange={(e) => setManualDescription((current) => ({ ...current, businessRules: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Riscos conhecidos</Label><Textarea value={manualDescription.knownRisks} onChange={(e) => setManualDescription((current) => ({ ...current, knownRisks: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Controles existentes</Label><Textarea value={manualDescription.existingControls} onChange={(e) => setManualDescription((current) => ({ ...current, existingControls: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Indicadores desejados</Label><Textarea value={manualDescription.desiredIndicators} onChange={(e) => setManualDescription((current) => ({ ...current, desiredIndicators: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Observações adicionais</Label><Textarea value={manualDescription.additionalNotes} onChange={(e) => setManualDescription((current) => ({ ...current, additionalNotes: e.target.value }))} /></div>
                      </div>
                    ) : mappedProcessPayload ? (
                      <div className="rounded-xl border p-4 text-sm text-muted-foreground space-y-2">
                        <div className="font-medium text-foreground">{mappedProcessPayload.process.nome}</div>
                        <div>Área: {mappedProcessPayload.process.area}</div>
                        <div>Responsável: {mappedProcessPayload.process.responsavel}</div>
                        <div>Descrição: {mappedProcessPayload.detailed?.descricao || "Não informada"}</div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <Label>Seções incluídas</Label>
                      <div className="grid gap-2 md:grid-cols-2">
                        {[...activeTemplate.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section) => (
                          <label key={section.id} className="flex items-start gap-3 rounded-lg border p-3">
                            <Checkbox
                              checked={selectedSectionIds.includes(section.id)}
                              onCheckedChange={(checked) => {
                                setSelectedSectionIds((current) =>
                                  checked === true
                                    ? Array.from(new Set([...current, section.id]))
                                    : current.filter((id) => id !== section.id),
                                );
                              }}
                            />
                            <div>
                              <div className="font-medium text-sm">{section.sectionTitle}</div>
                              <div className="text-xs text-muted-foreground">{section.sectionDescription}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <Button onClick={handleGeneratePreview} disabled={isGenerating}>
                      <Wand2 className="mr-2 h-4 w-4" /> {isGenerating ? "Gerando..." : "Gerar prévia do documento"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Prévia gerada</CardTitle>
                    <CardDescription>Revise, ajuste o markdown e só então salve como documento.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input value={previewTitle} onChange={(e) => setPreviewTitle(e.target.value)} placeholder="Título sugerido do documento" />
                    </div>
                    <div className="space-y-2">
                      <Label>Markdown</Label>
                      <Textarea className="min-h-[360px] font-mono text-xs" value={previewMarkdown} onChange={(e) => setPreviewMarkdown(e.target.value)} placeholder="A prévia do documento aparecerá aqui." />
                    </div>
                    {preview ? (
                      <div className="space-y-3 rounded-xl border p-4 text-sm">
                        <div>
                          <div className="font-medium">Resumo</div>
                          <p className="text-muted-foreground">{preview.summary}</p>
                        </div>
                        {preview.pointsOfAttention.length > 0 ? (
                          <div>
                            <div className="font-medium">Pontos de atenção</div>
                            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                              {preview.pointsOfAttention.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDocumentOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveGeneratedDocument} disabled={!previewMarkdown.trim() || isPersistingDoc}>
              <Lock className="mr-2 h-4 w-4" /> {isPersistingDoc ? "Salvando..." : "Salvar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
