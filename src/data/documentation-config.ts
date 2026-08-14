import type { Json } from "@/integrations/supabase/types";
import type { DiagnosticoResult, ProcessoFormData } from "@/data/processo-form-types";
import {
  mapProcessRowToForm,
  mapProcessRowToListItem,
  type ProcessoListItem,
  type ProcessoRow,
} from "@/lib/processos";

export const DOCUMENTATION_STORAGE_PREFIX = "process:documentation";
export const GENERATED_DOCUMENTS_STORAGE_PREFIX = "process:generated-documents";

export const DOCUMENTATION_TABS = [
  { id: "modelos", label: "Modelos" },
  { id: "estrutura", label: "Estrutura" },
  { id: "prompts", label: "Prompts e IA" },
  { id: "variaveis", label: "Variáveis" },
  { id: "anexos", label: "Anexos" },
  { id: "aprovacao", label: "Aprovação e Versionamento" },
  { id: "inteligentes", label: "Integração com Documentos Inteligentes" },
] as const;

export const DOCUMENT_TYPES = [
  "Procedimento Operacional Padrão",
  "Relatório de Análise do Processo",
  "Análise por Fase",
  "Matriz de Riscos",
  "Indicadores do Processo",
  "Plano de Ação",
  "Checklist Operacional",
  "Manual do Processo",
  "Instrução de Trabalho",
  "Roteiro de Treinamento",
  "Documento de Entrevista",
  "Documento consolidado do processo",
  "Documento avulso gerado por IA",
  "raci",
  "ficha_processo",
  "pop_v5",
] as const;

export const PROCEDURE_CATEGORIES = [
  "Procedimento Operacional",
  "Instrução de Trabalho",
  "Norma Interna",
  "Outro",
] as const;

export const DOCUMENT_TONES = [
  "Técnico",
  "Executivo",
  "Didático",
  "Operacional",
  "Consultivo",
  "Formal",
  "Simples e direto",
] as const;

export const DOCUMENT_DETAIL_LEVELS = [
  "Resumido",
  "Intermediário",
  "Detalhado",
  "Muito detalhado",
] as const;

export const DOCUMENT_STATUSES = [
  "Rascunho",
  "Em revisão",
  "Em aprovação",
  "Aprovado",
  "Publicado",
  "Obsoleto",
  "Arquivado",
] as const;

export const DOCUMENT_ORIGINS = [
  "mapped_process",
  "manual_description",
  "uploaded_document",
  "imported_document",
  "ai_generated",
] as const;

export type DocumentationTabId = typeof DOCUMENTATION_TABS[number]["id"];
export type DocumentType = typeof DOCUMENT_TYPES[number];
export type ProcedureCategory = typeof PROCEDURE_CATEGORIES[number];
export type DocumentTone = typeof DOCUMENT_TONES[number];
export type DocumentDetailLevel = typeof DOCUMENT_DETAIL_LEVELS[number];
export type DocumentStatus = typeof DOCUMENT_STATUSES[number];
export type DocumentOrigin = typeof DOCUMENT_ORIGINS[number];
export type DocumentSourceMode = "linked_process" | "independent";

export type SectionSourceType =
  | "formulario"
  | "entrevista"
  | "analise_fase"
  | "processo_mapeado"
  | "descricao_livre"
  | "manual"
  | "hibrido";

export interface DocumentSection {
  id: string;
  sectionKey: string;
  sectionTitle: string;
  sectionDescription: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  sourceType: SectionSourceType;
  generatedByAI: boolean;
  allowsAttachments: boolean;
  includeInFinalDocument: boolean;
  includeInAIIndexing: boolean;
}

export interface DocumentPromptConfig {
  systemPrompt: string;
  generationInstructions: string;
  tone: DocumentTone;
  detailLevel: DocumentDetailLevel;
  targetAudience: string;
  includeRisks: boolean;
  includeIndicators: boolean;
  includeImprovements: boolean;
  includeAutomationOpportunities: boolean;
  includeActionPlan: boolean;
  includeChecklist: boolean;
  generateExecutiveSummary: boolean;
  generateManagerVersion: boolean;
  generateCollaboratorVersion: boolean;
}

export interface DocumentVariable {
  id: string;
  variableKey: string;
  variableLabel: string;
  variableDescription: string;
  sourceField: string;
  isRequired: boolean;
  dataType: string;
  exampleValue: string;
  isCustom?: boolean;
}

export interface AttachmentRuleConfig {
  requiredTypes: string[];
  optionalTypes: string[];
  perPhase: boolean;
  perDocumentType: boolean;
  maxSizeMb: number;
  allowedFormats: string[];
  includeInFinalDocument: boolean;
  includeInFutureIndexing: boolean;
}

export interface ApprovalVersioningConfig {
  autoVersionNumbering: boolean;
  requireApproval: boolean;
  approverRole: string;
  versioningEnabled: boolean;
  status: DocumentStatus;
  periodicReviewEnabled: boolean;
  reviewPeriodDays: number;
  autoPublishAfterApproval: boolean;
}

export interface IntelligentDocumentConfig {
  allowAsAISource: boolean;
  allowIndexing: boolean;
  allowEmbeddings: boolean;
  allowCitations: boolean;
  allowNotes: boolean;
  allowAutoSummary: boolean;
  allowFaq: boolean;
  allowStudyGuide: boolean;
  allowGeneratedChecklist: boolean;
  allowFutureAudio: boolean;
}

export interface DocumentTemplate {
  id: string;
  companyId: string | null;
  name: string;
  documentType: DocumentType;
  description: string;
  version: string;
  isActive: boolean;
  isDefault: boolean;
  isSystemTemplate: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  referenceContent: string;
  sections: DocumentSection[];
  promptConfig: DocumentPromptConfig;
  variables: DocumentVariable[];
  attachmentRules: AttachmentRuleConfig;
  approvalVersioning: ApprovalVersioningConfig;
  intelligentConfig: IntelligentDocumentConfig;
}

export interface DocumentGenerationSettings {
  defaultTemplateId: string;
  requireApproval: boolean;
  approvalRole: string;
  versioningEnabled: boolean;
  reviewPeriodDays: number;
  autoPublishAfterApproval: boolean;
}

export interface DocumentationState {
  templates: DocumentTemplate[];
  generationSettings: DocumentGenerationSettings;
}

export interface DocumentPreviewData {
  title: string;
  contentMarkdown: string;
  contentText: string;
  summary: string;
  pointsOfAttention: string[];
  suggestedRisks: string[];
  suggestedIndicators: string[];
  generationMetadata: Record<string, unknown>;
}

export interface DocumentRevisionEntry {
  revision: string;
  revisedBy: string;
  revisedAt: string;
  reason: string;
  previousStatus: DocumentStatus;
}

export interface DocumentApprovalEntry {
  decision: "Aprovado" | "Reprovado";
  responsibleName: string;
  responsibleRole: string;
  decidedAt: string;
  comment: string;
}

export interface DocumentDistributionEntry {
  recipient: string;
  distributedAt: string;
  distributedBy: string;
  revision: string;
  version: string;
}

export interface GeneratedDocumentRecord extends DocumentPreviewData {
  id: string;
  code: string;
  sourceMode: DocumentSourceMode;
  companyId: string | null;
  processId: string | null;
  processMappingId: string | null;
  processName: string;
  processLink: string | null;
  processStatusAtGeneration: string;
  linkedMapRevision: string;
  linkedMapApprovedAt: string;
  mapVersionLabel: string;
  area: string;
  templateId: string;
  documentOrigin: DocumentOrigin;
  documentType: DocumentType;
  procedureCategory: ProcedureCategory;
  documentOwner: string;
  status: DocumentStatus;
  version: string;
  revision: string;
  revisionNumber: number;
  approverName: string;
  approverRole: string;
  distributedTo: string[];
  updatedAt: string;
  createdBy: string;
  createdAt: string;
  descriptionInput?: string;
  aiModel?: string;
  aiPromptUsed?: string;
  revisionHistory: DocumentRevisionEntry[];
  approvalHistory: DocumentApprovalEntry[];
  distributionHistory: DocumentDistributionEntry[];
}

export interface ManualDescriptionInput {
  title: string;
  documentType: DocumentType;
  templateId: string;
  area: string;
  objective: string;
  generalDescription: string;
  inputs: string;
  outputs: string;
  stakeholders: string;
  systems: string;
  relatedDocuments: string;
  businessRules: string;
  knownRisks: string;
  existingControls: string;
  desiredIndicators: string;
  additionalNotes: string;
}

export interface MappedProcessDetailedData {
  descricao: string;
  indicadores: ProcessoFormData["indicadores"];
  melhorias: NonNullable<DiagnosticoResult["fase4"]>["melhorias"];
}

export interface MappedProcessPayload {
  process: ProcessoListItem;
  detailed: MappedProcessDetailedData;
  form: ProcessoFormData;
  normalized: {
    nomeProcesso: string;
    area: string;
    donoProcesso: string;
    status: ProcessoListItem["status"];
    criticidade: ProcessoListItem["criticidade"];
    dataCriacao: string;
    mapaRevisao: string;
    mapaAprovadoEm: string;
    objetivo: string;
    clientePrincipal: string;
    areasEnvolvidas: string;
    entradas: string;
    etapas: ProcessoFormData["etapas"];
    decisoes: string;
    saidas: string;
    problemasTexto: string;
    riscos: ProcessoFormData["riscos"];
    indicadores: ProcessoFormData["indicadores"];
    melhorias: MappedProcessDetailedData["melhorias"];
    descricao: string;
  };
}

const DEFAULT_SYSTEM_PROMPT = `Você é um consultor sênior especialista em gestão de processos, BPM, padronização operacional, ISO 9001 e melhoria contínua.

Sua função é elaborar um documento de processo claro, profissional e aplicável à realidade da empresa.

Use somente as informações fornecidas pelo usuário e pelo sistema.
Não invente dados críticos.
Quando alguma informação não for fornecida, registre como "não informado" ou sugira validação pela empresa.
Organize o documento conforme o modelo selecionado.
Use linguagem clara, objetiva e orientada à execução.
Gere o conteúdo em markdown estruturado.`;

const DEFAULT_GENERATION_INSTRUCTIONS = "Gerar documento estruturado, com seções claras, mantendo rastreabilidade entre insumos, riscos, indicadores, ações e anexos.";

const DEFAULT_REFERENCE_CONTENT = `Sugestão de estrutura documental:
- Objetivo
- Aplicação
- Responsáveis
- Entradas
- Saídas
- Sistemas utilizados
- Documentos relacionados
- Descrição do processo
- Etapas do processo
- Riscos
- Controles
- Indicadores
- Registros
- Anexos
- Histórico de revisão`;

const STANDARD_VARIABLES: Omit<DocumentVariable, "id">[] = [
  {
    variableKey: "{{nome_processo}}",
    variableLabel: "Nome do processo",
    variableDescription: "Nome oficial do processo mapeado ou informado livremente.",
    sourceField: "nomeProcesso",
    isRequired: true,
    dataType: "texto",
    exampleValue: "Gestão de Vendas",
  },
  {
    variableKey: "{{area_responsavel}}",
    variableLabel: "Área responsável",
    variableDescription: "Área principal dona do processo.",
    sourceField: "area",
    isRequired: true,
    dataType: "texto",
    exampleValue: "Comercial",
  },
  {
    variableKey: "{{responsavel_processo}}",
    variableLabel: "Responsável pelo processo",
    variableDescription: "Responsável principal pela execução e governança.",
    sourceField: "donoProcesso",
    isRequired: true,
    dataType: "texto",
    exampleValue: "Ana Silva",
  },
  {
    variableKey: "{{objetivo_processo}}",
    variableLabel: "Objetivo do processo",
    variableDescription: "Resultado de negócio esperado com o processo.",
    sourceField: "objetivo",
    isRequired: true,
    dataType: "texto longo",
    exampleValue: "Garantir fechamento de negócios com lead time reduzido.",
  },
  {
    variableKey: "{{riscos}}",
    variableLabel: "Riscos do processo",
    variableDescription: "Riscos relevantes associados ao fluxo atual.",
    sourceField: "riscos",
    isRequired: false,
    dataType: "lista",
    exampleValue: "Dependência de aprovação manual; falha em planilhas.",
  },
  {
    variableKey: "{{indicadores}}",
    variableLabel: "Indicadores",
    variableDescription: "Indicadores usados para acompanhar o desempenho do processo.",
    sourceField: "indicadores",
    isRequired: false,
    dataType: "lista",
    exampleValue: "Tempo de ciclo; taxa de conversão.",
  },
  {
    variableKey: "{{descricao_livre}}",
    variableLabel: "Descrição livre",
    variableDescription: "Texto narrativo usado no modo sem processo mapeado.",
    sourceField: "description_input",
    isRequired: false,
    dataType: "texto longo",
    exampleValue: "Processo começa com entrada do pedido e termina com faturamento.",
  },
];

function uuid() {
  return crypto.randomUUID();
}

function parseJsonObject<T extends object>(value: Json | null | undefined, fallback: T): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : fallback;
}

export function createStandardSections(documentType: DocumentType): DocumentSection[] {
  const sectionTitles =
    documentType === "raci"
      ? ["Cabeçalho", "Matriz RACI", "Pendências"]
      : documentType === "ficha_processo"
        ? ["Identificação", "Entradas e Saídas", "Recursos Necessários", "Indicadores", "Riscos Identificados", "Documentos Relacionados", "Nível de Maturidade"]
        : documentType === "pop_v5"
          ? ["1. Objetivo", "2. Campo de Aplicação", "3. Referências Normativas", "4. Definições e Siglas", "5. Responsabilidades", "6. Descrição das Atividades", "7. Pontos de Decisão", "8. Fluxograma", "9. Indicadores de Desempenho", "10. Registros e Evidências", "11. Histórico de Revisões"]
    : documentType === "Checklist Operacional"
      ? [
          "Objetivo",
          "Pré-requisitos",
          "Checklist por etapa",
          "Pontos de atenção",
          "Evidências",
          "Histórico de revisão",
        ]
      : documentType === "Instrução de Trabalho"
        ? [
            "Objetivo",
            "Processo",
            "Norma ISO 9001",
            "Documentos complementares",
            "Definições",
            "Recursos",
            "Riscos e contingência",
            "Descrição das atividades",
            "Responsabilidades",
            "Anexos",
            "Controle de informação documentada",
          ]
      : [
          "Objetivo",
          "Aplicação",
          "Responsáveis",
          "Entradas",
          "Saídas",
          "Sistemas utilizados",
          "Documentos relacionados",
          "Descrição do processo",
          "Etapas do processo",
          "Riscos",
          "Controles",
          "Indicadores",
          "Registros",
          "Anexos",
          "Histórico de revisão",
        ];

  const descriptions: Partial<Record<DocumentType, string[]>> = {
    raci: [
      "Processo, data, versão e legenda RACI.",
      "Tabela com atividades × responsáveis. R=Responsável, A=Aprovador, C=Consultado, I=Informado.",
      "Atividades sem R ou A definidos — marcar como ⚠️ DEFINIR.",
    ],
    ficha_processo: [
      "Nome, código, macroprocesso, classificação, área, gestor, frequência e gatilho.",
      "Tabela SIPOC: fornecedores, entradas, saídas e clientes.",
      "Pessoas, sistemas e documentos de referência.",
      "Tabela: KPI, fórmula, meta, frequência e responsável.",
      "Tabela: risco, probabilidade, impacto e controle existente.",
      "POPs, formulários e normas vinculadas.",
      "Inicial / Estruturado / Padronizado / Monitorado / Otimizado.",
    ],
  };

  return sectionTitles.map((title, index) => ({
    id: uuid(),
    sectionKey: title.toLowerCase().normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_"),
    sectionTitle: title,
    sectionDescription: descriptions[documentType]?.[index] || `Seção ${title} do documento.`,
    sortOrder: index + 1,
    isRequired: documentType === "raci" ? index < 2 : documentType === "ficha_processo" ? index < 4 : documentType === "pop_v5" ? [0, 1, 4, 5, 10].includes(index) : index < 4,
    isActive: true,
    sourceType: index < 9 ? "processo_mapeado" : "hibrido",
    generatedByAI: true,
    allowsAttachments: title === "Anexos" || title === "Registros",
    includeInFinalDocument: true,
    includeInAIIndexing: true,
  }));
}

function createPromptConfig(): DocumentPromptConfig {
  return {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    generationInstructions: DEFAULT_GENERATION_INSTRUCTIONS,
    tone: "Operacional",
    detailLevel: "Detalhado",
    targetAudience: "Gestores, analistas e responsáveis operacionais",
    includeRisks: true,
    includeIndicators: true,
    includeImprovements: true,
    includeAutomationOpportunities: true,
    includeActionPlan: true,
    includeChecklist: false,
    generateExecutiveSummary: true,
    generateManagerVersion: true,
    generateCollaboratorVersion: false,
  };
}

function createAttachmentRules(): AttachmentRuleConfig {
  return {
    requiredTypes: ["BPMN", "Evidências do processo"],
    optionalTypes: ["PDF", "Imagens", "Planilhas", "Gravações/transcrições"],
    perPhase: true,
    perDocumentType: true,
    maxSizeMb: 25,
    allowedFormats: ["pdf", "png", "jpg", "jpeg", "webp", "xlsx", "docx", "txt"],
    includeInFinalDocument: true,
    includeInFutureIndexing: true,
  };
}

function createApprovalSettings(): ApprovalVersioningConfig {
  return {
    autoVersionNumbering: true,
    requireApproval: true,
    approverRole: "gestor",
    versioningEnabled: true,
    status: "Rascunho",
    periodicReviewEnabled: true,
    reviewPeriodDays: 180,
    autoPublishAfterApproval: false,
  };
}

function createIntelligentConfig(): IntelligentDocumentConfig {
  return {
    allowAsAISource: true,
    allowIndexing: true,
    allowEmbeddings: true,
    allowCitations: true,
    allowNotes: true,
    allowAutoSummary: true,
    allowFaq: true,
    allowStudyGuide: true,
    allowGeneratedChecklist: true,
    allowFutureAudio: true,
  };
}

function createVariables(): DocumentVariable[] {
  return STANDARD_VARIABLES.map((variable) => ({
    id: uuid(),
    ...variable,
  }));
}

function createTemplate(
  name: string,
  documentType: DocumentType,
  isDefault: boolean,
  isSystemTemplate: boolean,
  createdBy: string,
  companyId: string | null,
  description: string,
): DocumentTemplate {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    companyId,
    name,
    documentType,
    description,
    version: "1.0",
    isActive: true,
    isDefault,
    isSystemTemplate,
    createdBy,
    createdAt: now,
    updatedAt: now,
    referenceContent: DEFAULT_REFERENCE_CONTENT,
    sections: createStandardSections(documentType),
    promptConfig: createPromptConfig(),
    variables: createVariables(),
    attachmentRules: createAttachmentRules(),
    approvalVersioning: createApprovalSettings(),
    intelligentConfig: createIntelligentConfig(),
  };
}

export function createDefaultDocumentationState(companyId: string | null, createdBy: string): DocumentationState {
  const templates = [
    createTemplate(
      "IT-XXX - Instrução de Trabalho",
      "Instrução de Trabalho",
      true,
      true,
      createdBy,
      companyId,
      "Template operacional padrão da empresa para instruções de trabalho e procedimentos controlados.",
    ),
    createTemplate(
      "Relatório Executivo de Processo",
      "Relatório de Análise do Processo",
      false,
      false,
      createdBy,
      companyId,
      "Modelo para consolidação executiva do diagnóstico do processo.",
    ),
    createTemplate(
      "Checklist Operacional IA",
      "Checklist Operacional",
      false,
      false,
      createdBy,
      companyId,
      "Modelo enxuto para operacionalizar rotinas e verificações recorrentes.",
    ),
  ];

  return {
    templates,
    generationSettings: {
      defaultTemplateId: templates[0].id,
      requireApproval: true,
      approvalRole: "gestor",
      versioningEnabled: true,
      reviewPeriodDays: 180,
      autoPublishAfterApproval: false,
    },
  };
}

export function storageKeyForDocumentation(companyId: string | null) {
  return `${DOCUMENTATION_STORAGE_PREFIX}:${companyId ?? "local"}`;
}

export function storageKeyForGeneratedDocuments(companyId: string | null) {
  return `${GENERATED_DOCUMENTS_STORAGE_PREFIX}:${companyId ?? "local"}`;
}

export function loadDocumentationState(companyId: string | null, createdBy: string): DocumentationState {
  const saved = localStorage.getItem(storageKeyForDocumentation(companyId));
  if (!saved) return createDefaultDocumentationState(companyId, createdBy);
  try {
    return JSON.parse(saved) as DocumentationState;
  } catch {
    return createDefaultDocumentationState(companyId, createdBy);
  }
}

export function saveDocumentationState(companyId: string | null, state: DocumentationState) {
  localStorage.setItem(storageKeyForDocumentation(companyId), JSON.stringify(state));
}

export function loadGeneratedDocuments(companyId: string | null): GeneratedDocumentRecord[] {
  const saved = localStorage.getItem(storageKeyForGeneratedDocuments(companyId));
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as Partial<GeneratedDocumentRecord>[];
    return normalizeGeneratedDocuments(parsed);
  } catch {
    return [];
  }
}

export function saveGeneratedDocuments(companyId: string | null, docs: GeneratedDocumentRecord[]) {
  localStorage.setItem(storageKeyForGeneratedDocuments(companyId), JSON.stringify(docs));
}

export function formatRevision(revisionNumber: number) {
  return `Rev.${String(revisionNumber).padStart(2, "0")}`;
}

export function nextDocumentCode(existingDocs: Array<Pick<GeneratedDocumentRecord, "code">>) {
  const max = existingDocs.reduce((acc, doc) => {
    const match = /IT-(\d+)/.exec(doc.code || "");
    if (!match) return acc;
    return Math.max(acc, Number(match[1]));
  }, 0);
  return `IT-${String(max + 1).padStart(3, "0")}`;
}

function normalizeGeneratedDocuments(parsed: Partial<GeneratedDocumentRecord>[]): GeneratedDocumentRecord[] {
  const ordered = [...parsed].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return aTime - bTime;
  });

  const result: GeneratedDocumentRecord[] = [];

  for (const doc of ordered) {
    const createdAt = doc.createdAt || new Date().toISOString();
    const revisionNumber = typeof doc.revisionNumber === "number"
      ? doc.revisionNumber
      : (() => {
          const match = /Rev\.(\d+)/.exec(doc.revision || "");
          return match ? Number(match[1]) : 0;
        })();
    const code = doc.code || nextDocumentCode(result);
    result.push({
      id: doc.id || crypto.randomUUID(),
      code,
      sourceMode: doc.sourceMode || (doc.processId ? "linked_process" : "independent"),
      companyId: doc.companyId ?? null,
      processId: doc.processId ?? null,
      processMappingId: doc.processMappingId ?? null,
      processName: doc.processName || "Processo não informado",
      processLink: doc.processLink || (doc.processId ? `/processos/${doc.processId}` : null),
      processStatusAtGeneration: doc.processStatusAtGeneration || (doc.processId ? "Mapeado" : ""),
      linkedMapRevision: doc.linkedMapRevision || "",
      linkedMapApprovedAt: doc.linkedMapApprovedAt || "",
      mapVersionLabel: doc.mapVersionLabel || "",
      area: doc.area || "",
      templateId: doc.templateId || "",
      documentOrigin: doc.documentOrigin || "mapped_process",
      documentType: doc.documentType || "Procedimento Operacional Padrão",
      procedureCategory: doc.procedureCategory || "Procedimento Operacional",
      documentOwner: doc.documentOwner || "",
      title: doc.title || "Documento sem título",
      contentMarkdown: doc.contentMarkdown || "",
      contentText: doc.contentText || "",
      summary: doc.summary || "",
      pointsOfAttention: Array.isArray(doc.pointsOfAttention) ? doc.pointsOfAttention : [],
      suggestedRisks: Array.isArray(doc.suggestedRisks) ? doc.suggestedRisks : [],
      suggestedIndicators: Array.isArray(doc.suggestedIndicators) ? doc.suggestedIndicators : [],
      generationMetadata: doc.generationMetadata || {},
      status: doc.status || "Rascunho",
      version: doc.version || "1.0",
      revision: doc.revision || formatRevision(revisionNumber),
      revisionNumber,
      approverName: doc.approverName || "",
      approverRole: doc.approverRole || "",
      distributedTo: Array.isArray(doc.distributedTo) ? doc.distributedTo : [],
      updatedAt: doc.updatedAt || createdAt,
      createdBy: doc.createdBy || "local-user",
      createdAt,
      descriptionInput: doc.descriptionInput,
      aiModel: doc.aiModel,
      aiPromptUsed: doc.aiPromptUsed,
      revisionHistory: Array.isArray(doc.revisionHistory) ? doc.revisionHistory : [],
      approvalHistory: Array.isArray(doc.approvalHistory) ? doc.approvalHistory : [],
      distributionHistory: Array.isArray(doc.distributionHistory) ? doc.distributionHistory : [],
    });
  }

  return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function buildMappedProcessPayload(processRow: ProcessoRow | null | undefined): MappedProcessPayload | null {
  if (!processRow) return null;

  const process = mapProcessRowToListItem(processRow);
  const form = mapProcessRowToForm(processRow);
  const diagnostico = parseJsonObject<Partial<DiagnosticoResult>>(processRow.diagnostico, {});
  const indicadores = form.indicadores.length > 0
    ? form.indicadores
    : Array.isArray(diagnostico.fase6?.indicadores)
      ? diagnostico.fase6.indicadores
      : [];
  const melhorias = Array.isArray(diagnostico.fase4?.melhorias) ? diagnostico.fase4.melhorias : [];
  const descricao = diagnostico.fase1?.descricaoPontaAPonta || processRow.objetivo || "";
  const entradas = form.entradas
    .map((item) => [item.entrada, item.fornecedor ? `Fornecedor: ${item.fornecedor}` : ""].filter(Boolean).join(" | "))
    .join("\n");
  const saidas = form.saidas
    .map((item) => [item.saida, item.cliente ? `Cliente: ${item.cliente}` : ""].filter(Boolean).join(" | "))
    .join("\n");
  const detailed: MappedProcessDetailedData = {
    descricao,
    indicadores,
    melhorias,
  };

  return {
    process,
    detailed,
    form,
    normalized: {
      nomeProcesso: process.nome,
      area: process.area,
      donoProcesso: process.responsavel,
      status: process.status,
      criticidade: process.criticidade,
      dataCriacao: process.data_criacao,
      mapaRevisao: process.mapa_revisao ?? "",
      mapaAprovadoEm: process.mapa_aprovado_em ?? "",
      objetivo: form.objetivo ?? "",
      clientePrincipal: form.clienteProcesso ?? "",
      areasEnvolvidas: form.areasEnvolvidas ?? "",
      entradas,
      etapas: form.etapas ?? [],
      decisoes: form.decisoes ?? "",
      saidas,
      problemasTexto: form.problemasTexto ?? "",
      riscos: form.riscos ?? [],
      indicadores,
      melhorias,
      descricao,
    },
  };
}

export function createEmptyManualDescription(defaultTemplateId: string): ManualDescriptionInput {
  return {
    title: "",
    documentType: "Documento avulso gerado por IA",
    templateId: defaultTemplateId,
    area: "",
    objective: "",
    generalDescription: "",
    inputs: "",
    outputs: "",
    stakeholders: "",
    systems: "",
    relatedDocuments: "",
    businessRules: "",
    knownRisks: "",
    existingControls: "",
    desiredIndicators: "",
    additionalNotes: "",
  };
}
