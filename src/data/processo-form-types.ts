// Types for the full process mapping form (aligned with PDF "Mapeamento de Processos")

export type Classificacao = "Negócio" | "Apoio" | "Gestão";
export type Frequencia = "Diária" | "Semanal" | "Quinzenal" | "Mensal" | "Trimestral" | "Semestral" | "Anual" | "Sob demanda";

export interface EtapaForm {
  ordem: number;
  atividade: string;
  responsavel: string;
  ferramentaDocumento: string;
  comoHoje?: string;
  nivelMaturidade?: 0 | 1 | 2 | 3 | 4;
  nivelDesejado?: 0 | 1 | 2 | 3 | 4;
  nivelIdeal?: 0 | 1 | 2 | 3 | 4;
  gap?: number;
  problemaIdentificado?: string;
  oportunidadeMelhoria?: string;
  tipoSolucao?: "RPA" | "Workflow" | "API" | "IA";
  tecnologiaRecomendada?: string;
  acaoRecomendada?: string;
  gravidade?: number;
  urgencia?: number;
  tendencia?: number;
  nota?: number;
}

export interface EntradaForm {
  fornecedor: string;
  entrada: string;
}

export interface SaidaForm {
  saida: string;
  cliente: string;
}

export type NivelRisco = 1 | 2 | 3 | 4 | 5;

export interface RiscoForm {
  risco: string;
  consequencia: string;
  probabilidade: NivelRisco;
  impacto: NivelRisco;
}

export interface IndicadorForm {
  indicador: string;
  meta: string;
}

export interface PlanoAcao5W2H {
  oque: string;
  porque: string;
  quem: string;
  quando: string;
  onde: string;
  como: string;
  custo: string;
}

export interface CriticidadeDetalhada {
  impactoNegocio: 1 | 3 | 5;
  impactoCliente: 1 | 3 | 5;
  riscoOperacional: 1 | 3 | 5;
}

export interface ProcessoFormData {
  // 1. Identificação
  data: string;
  analista: string;
  empresa: string;
  nomeProcesso: string;
  classificacao: Classificacao;
  area: string;
  donoProcesso: string;
  entrevistados: string;
  infoAdicionais: string;

  // 2. Contexto
  objetivo: string;
  porqueExiste: string;
  clienteProcesso: string;
  areasEnvolvidas: string;

  // 3. Gatilho
  gatilho: string;

  // 4. Entradas (SIPOC: Supplier + Input)
  entradas: EntradaForm[];

  // 5. Atividades
  etapas: EtapaForm[];

  // 6. Decisões
  decisoes: string;

  // 7. Saídas (SIPOC: Output + Customer)
  saidas: SaidaForm[];

  // 8. Recursos
  recursos: string;

  // 9. Frequência
  frequencia: Frequencia;
  tempoExecucao: string;

  // 10. Dores/Problemas
  problemas: {
    retrabalho: boolean;
    atrasos: boolean;
    erros: boolean;
    dependencia: boolean;
    faltaPadrao: boolean;
  };
  problemasTexto: string;

  // 11. Gargalos
  gargalos: string;

  // 12. Riscos
  riscos: RiscoForm[];

  // 13. Controles
  controles: string;

  // 14. Indicadores
  indicadores: IndicadorForm[];

  // 15. Sugestões
  sugestoes: string;

  // 16. Automação
  automacao: string;

  // 17. Documentação
  documentacao: string;

  // 17b. Criticidade
  criticidadeDetalhada: CriticidadeDetalhada;

  // 18. Plano de Ação
  planoAcao: PlanoAcao5W2H[];

  // 19. Conclusão
  conclusao: string;

  // 20. BPMN Maps
  bpmnAsIs: string;
  bpmnToBe: string;
}

// ── Diagnóstico Result Types ──

export interface Fase1Mapeamento {
  resumoExecutivo: string;
  descricaoPontaAPonta: string;
  principaisAtores: string[];
  fluxoLogico: string;
}

export interface ProblemaEstruturado {
  problema: string;
  tipo: "gargalo" | "retrabalho" | "risco" | "ineficiencia";
  severidade: "alto" | "medio" | "baixo";
  impactoNegocio: string;
}

export interface Fase2Diagnostico {
  problemas: ProblemaEstruturado[];
  principaisGargalos: string[];
  pontosRetrabalho: string[];
  analiseRiscos: Array<{ risco: string; nivel: "alto" | "medio" | "baixo"; impacto: string }>;
}

export interface ClassificacaoAtividade {
  atividade: string;
  classificacao: "valor_agregado" | "suporte" | "desperdicio";
}

export interface Fase3Maturidade {
  classificacaoAtividades: ClassificacaoAtividade[];
  scoreProcesso: number;
  nivelMaturidade: 0 | 1 | 2 | 3 | 4;
  descricaoMaturidade: string;
  maturidadeDigital: "baixa" | "media" | "alta";
  descricaoMaturidadeDigital: string;
  mediaMaturidade?: number;
  classificacaoMaturidade?: "Baixa maturidade (analógico)" | "Média maturidade (digital básico)" | "Alta maturidade (digital estruturado)" | "Avançado (inteligente)";
}

export interface MelhoriaToBe {
  problemaIdentificado: string;
  solucaoProposta: string;
  tipoTecnologia: "RPA" | "Workflow" | "API" | "IA" | "BI" | "Manual";
  impactoEsperado: string;
  complexidade: "Baixa" | "Media" | "Alta";
  prioridade: "Alta" | "Media" | "Baixa";
}

export interface Fase4ToBe {
  melhorias: MelhoriaToBe[];
  reducaoTempoEstimada: string;
  potencialAutomacao: string;
}

export interface PlanoAcaoDiag {
  oque: string;
  porque: string;
  quem: string;
  quando: string;
  onde: string;
  como: string;
  custo: string;
  prioridade: "Alta" | "Media" | "Baixa";
}

export interface Fase5PlanoAcao {
  acoes: PlanoAcaoDiag[];
}

export interface IndicadorKPI {
  nome: string;
  objetivo: string;
  formulaCalculo: string;
  meta: string;
  periodicidade: string;
  responsavel: string;
  classificacao: "Estrategico" | "Tatico" | "Operacional";
  tipo: "Leading" | "Lagging";
}

export interface Fase6Indicadores {
  indicadores: IndicadorKPI[];
}

export interface AnaliseFinal {
  diagnosticoGeral: string;
  top5Problemas: string[];
  top5Oportunidades: string[];
  recomendacaoEstrategica: string;
}

export interface DiagnosticoResult {
  fase1: Fase1Mapeamento;
  fase2: Fase2Diagnostico;
  fase3: Fase3Maturidade;
  fase4: Fase4ToBe;
  fase5: Fase5PlanoAcao;
  fase6: Fase6Indicadores;
  analiseFinal: AnaliseFinal;
}

export const emptyProcessoForm: ProcessoFormData = {
  data: new Date().toISOString().split("T")[0],
  analista: "",
  empresa: "",
  nomeProcesso: "",
  classificacao: "Negócio",
  area: "",
  donoProcesso: "",
  entrevistados: "",
  infoAdicionais: "",
  objetivo: "",
  porqueExiste: "",
  clienteProcesso: "",
  areasEnvolvidas: "",
  gatilho: "",
  entradas: [{ fornecedor: "", entrada: "" }],
  etapas: [{ ordem: 1, atividade: "", responsavel: "", ferramentaDocumento: "" }],
  decisoes: "",
  saidas: [{ saida: "", cliente: "" }],
  recursos: "",
  frequencia: "Sob demanda",
  tempoExecucao: "",
  problemas: { retrabalho: false, atrasos: false, erros: false, dependencia: false, faltaPadrao: false },
  problemasTexto: "",
  gargalos: "",
  riscos: [{ risco: "", consequencia: "", probabilidade: 1, impacto: 1 }],
  controles: "",
  indicadores: [{ indicador: "", meta: "" }],
  sugestoes: "",
  automacao: "",
  documentacao: "",
  criticidadeDetalhada: { impactoNegocio: 1, impactoCliente: 1, riscoOperacional: 1 },
  planoAcao: [{ oque: "", porque: "", quem: "", quando: "", onde: "", como: "", custo: "" }],
  conclusao: "",
  bpmnAsIs: "",
  bpmnToBe: "",
};

export const demoProcessoForm: ProcessoFormData = {
  data: "2024-03-05",
  analista: "Consultor Exemplo",
  empresa: "Empresa Demo Ltda",
  nomeProcesso: "Onboarding de Clientes",
  classificacao: "Negócio",
  area: "Operações",
  donoProcesso: "Carlos Souza",
  entrevistados: "Carlos Souza; Ana Suporte; Julia CS",
  infoAdicionais: "Processo focado em ativação de clientes SaaS B2B.",
  objetivo: "Ativar novos clientes com rapidez e qualidade, garantindo que iniciem o uso do produto em até 7 dias após a assinatura.",
  porqueExiste: "Evitar atrasos na ativação, reduzir retrabalhos com documentos pendentes e melhorar a experiência inicial do cliente.",
  clienteProcesso: "Novos clientes contratantes do produto SaaS.",
  areasEnvolvidas: "Comercial, Operações, Suporte, Financeiro",
  gatilho: "Assinatura do contrato pelo cliente (ou aceite digital da proposta).",
  entradas: [
    { fornecedor: "Comercial", entrada: "Contrato assinado e dados cadastrais" },
    { fornecedor: "Cliente", entrada: "Documentos obrigatórios (contrato social, dados fiscais)" },
  ],
  etapas: [
    { ordem: 1, atividade: "Receber contrato e cadastrais do Comercial", responsavel: "Operações", ferramentaDocumento: "CRM" },
    { ordem: 2, atividade: "Conferir dados e solicitar documentos faltantes", responsavel: "Operações", ferramentaDocumento: "Checklist Onboarding" },
    { ordem: 3, atividade: "Configurar ambiente do cliente", responsavel: "Implantação", ferramentaDocumento: "Plataforma SaaS" },
    { ordem: 4, atividade: "Realizar reunião de kick-off", responsavel: "Customer Success", ferramentaDocumento: "Apresentação Onboarding" },
    { ordem: 5, atividade: "Acompanhar primeiros acessos e uso inicial", responsavel: "Customer Success", ferramentaDocumento: "Relatórios de uso" },
  ],
  decisoes: "Documentos completos? Ambiente configurado com sucesso? Cliente participou do kick-off?",
  saidas: [
    { saida: "Cliente com acesso liberado e ambiente configurado", cliente: "Cliente (usuários finais)" },
    { saida: "Registro de onboarding concluído", cliente: "Equipe Comercial / Gestão" },
  ],
  recursos: "Plataforma SaaS; CRM; Checklist de onboarding; Equipe de Implantação e CS.",
  frequencia: "Semanal",
  tempoExecucao: "Média de 5 dias corridos",
  problemas: { retrabalho: true, atrasos: true, erros: false, dependencia: true, faltaPadrao: true },
  problemasTexto: "Retrabalho com solicitação de documentos; atraso em agendar kick-off; dependência de uma pessoa para configurar ambiente.",
  gargalos: "Validação manual de documentos; agenda cheia para reuniões de kick-off.",
  riscos: [
    { risco: "Cliente atrasar envio de documentos", consequencia: "Ativação demorada e frustração inicial", probabilidade: 3, impacto: 4 },
    { risco: "Configuração incorreta do ambiente", consequencia: "Erro na experiência inicial de uso", probabilidade: 2, impacto: 5 },
  ],
  controles: "Checklist obrigatório antes da ativação; conferência de ambiente por segunda pessoa em contas chave.",
  indicadores: [
    { indicador: "Tempo médio de ativação", meta: "≤ 7 dias" },
    { indicador: "Retrabalho por falta de documentos", meta: "≤ 10%" },
  ],
  sugestoes: "Automatizar checklist; oferecer envio de documentos via portal; padronizar roteiro de kick-off.",
  automacao: "Envio automático de e-mails e checklist; integração CRM ↔ plataforma para criação de ambiente.",
  documentacao: "Modelo de documento de processo armazenado na área de Documentação do Processo.",
  criticidadeDetalhada: { impactoNegocio: 5, impactoCliente: 5, riscoOperacional: 3 },
  planoAcao: [
    { oque: "Criar checklist digital de onboarding", porque: "Reduzir retrabalho com documentos", quem: "Carlos Souza", quando: "2024-04-30", onde: "Portal do Cliente", como: "Configuração em ferramenta de formulários", custo: "Baixo" },
    { oque: "Padronizar agenda de kick-off", porque: "Diminuir atrasos de reunião inicial", quem: "Equipe CS", quando: "2024-05-15", onde: "Online (Teams/Zoom)", como: "Slots fixos semanais", custo: "Médio" },
  ],
  conclusao: "Processo crítico para percepção inicial de valor. Ganhos rápidos virão de automação de checklist e padrão de kick-off.",
  bpmnAsIs: "",
  bpmnToBe: "",
};
