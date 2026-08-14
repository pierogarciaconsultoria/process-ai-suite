// Types for the full process mapping form (aligned with PDF "Mapeamento de Processos")

export type Classificacao = "Negócio" | "Apoio" | "Gestão";

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
  _hipotese?: boolean;
}

export interface IndicadorForm {
  nome: string;
  objetivo: string;
  formulaCalculo: string;
  meta: string;
  periodicidade: string;
  responsavel: string;
  _hipotese?: boolean;
}

export interface PlanoAcao5W2H {
  oque: string;
  porque: string;
  quem: string;
  quando: string;
  onde: string;
  como: string;
  custo: string;
  _hipotese?: boolean;
}

export interface ProcessoFormData {
  // 1. Identificação
  data: string;
  analista: string;
  nomeProcesso: string;
  classificacao: Classificacao;
  area: string;
  donoProcesso: string;
  entrevistados: string;

  // 2. Contexto
  objetivo: string;
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

  // 9. Dores/Problemas
  problemas: {
    retrabalho: boolean;
    atrasos: boolean;
    erros: boolean;
    dependencia: boolean;
    faltaPadrao: boolean;
  };
  problemasTexto: string;

  // 10. Riscos
  riscosTexto: string;
  riscos: RiscoForm[];

  // 11. Indicadores
  indicadores: IndicadorForm[];

  // 12. Oportunidades de Melhoria
  oportunidadesMelhoria: string;

  // 13. Plano de Ação
  planoAcao: PlanoAcao5W2H[];

  // 14. BPMN Maps
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
  classificacaoMaturidade?: "Inicial" | "Estruturado" | "Padronizado" | "Monitorado" | "Otimizado" | "Baixa maturidade (analógico)" | "Média maturidade (digital básico)" | "Alta maturidade (digital estruturado)" | "Avançado (inteligente)";
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
  nomeProcesso: "",
  classificacao: "Negócio",
  area: "",
  donoProcesso: "",
  entrevistados: "",
  objetivo: "",
  clienteProcesso: "",
  areasEnvolvidas: "",
  gatilho: "",
  entradas: [{ fornecedor: "", entrada: "" }],
  etapas: [{ ordem: 1, atividade: "", responsavel: "", ferramentaDocumento: "" }],
  decisoes: "",
  saidas: [{ saida: "", cliente: "" }],
  recursos: "",
  problemas: { retrabalho: false, atrasos: false, erros: false, dependencia: false, faltaPadrao: false },
  problemasTexto: "",
  riscosTexto: "",
  riscos: [{ risco: "", consequencia: "", probabilidade: 1, impacto: 1 }],
  indicadores: [{ nome: "", objetivo: "", formulaCalculo: "", meta: "", periodicidade: "", responsavel: "" }],
  oportunidadesMelhoria: "",
  planoAcao: [{ oque: "", porque: "", quem: "", quando: "", onde: "", como: "", custo: "" }],
  bpmnAsIs: "",
  bpmnToBe: "",
};
