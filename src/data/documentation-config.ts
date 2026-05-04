import { processos, processosDetalhados, processosFormMock } from "@/data/mock-processos";

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
export type DocumentTone = typeof DOCUMENT_TONES[number];
export type DocumentDetailLevel = typeof DOCUMENT_DETAIL_LEVELS[number];
export type DocumentStatus = typeof DOCUMENT_STATUSES[number];
export type DocumentOrigin = typeof DOCUMENT_ORIGINS[number];

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

export interface GeneratedDocumentRecord extends DocumentPreviewData {
  id: string;
  companyId: string | null;
  processId: string | null;
  processMappingId: string | null;
  templateId: string;
  documentOrigin: DocumentOrigin;
  documentType: DocumentType;
  status: DocumentStatus;
  version: string;
  createdBy: string;
  createdAt: string;
  descriptionInput?: string;
  aiModel?: string;
  aiPromptUsed?: string;
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

function createStandardSections(documentType: DocumentType): DocumentSection[] {
  const sectionTitles =
    documentType === "Checklist Operacional"
      ? [
          "Objetivo",
          "Pré-requisitos",
          "Checklist por etapa",
          "Pontos de atenção",
          "Evidências",
          "Histórico de revisão",
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

  return sectionTitles.map((title, index) => ({
    id: uuid(),
    sectionKey: title.toLowerCase().normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_"),
    sectionTitle: title,
    sectionDescription: `Seção ${title} do documento.`,
    sortOrder: index + 1,
    isRequired: index < 4,
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
      "POP Padrão da Empresa",
      "Procedimento Operacional Padrão",
      true,
      true,
      createdBy,
      companyId,
      "Modelo base para procedimentos operacionais padronizados da empresa.",
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
    return JSON.parse(saved) as GeneratedDocumentRecord[];
  } catch {
    return [];
  }
}

export function saveGeneratedDocuments(companyId: string | null, docs: GeneratedDocumentRecord[]) {
  localStorage.setItem(storageKeyForGeneratedDocuments(companyId), JSON.stringify(docs));
}

export function buildMappedProcessPayload(processId: string) {
  const process = processos.find((item) => item.id === processId);
  if (!process) return null;
  const detailed = processosDetalhados[processId];
  const form = processosFormMock[processId];

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
      objetivo: form?.objetivo ?? "",
      clientePrincipal: form?.clienteProcesso ?? "",
      areasEnvolvidas: form?.areasEnvolvidas ?? "",
      entradas: form?.entradas ?? "",
      etapas: form?.etapas ?? [],
      decisoes: form?.decisoes ?? "",
      saidas: form?.saidas ?? "",
      problemasTexto: form?.problemasTexto ?? "",
      riscos: form?.riscos ?? [],
      indicadores: detailed?.indicadores ?? [],
      melhorias: detailed?.melhorias ?? [],
      descricao: detailed?.descricao ?? "",
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
