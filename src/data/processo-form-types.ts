// Types for the full process mapping form (aligned with PDF "Mapeamento de Processos")

export type Classificacao = "Negócio" | "Apoio" | "Gestão";
export type Frequencia = "Diária" | "Semanal" | "Quinzenal" | "Mensal" | "Trimestral" | "Semestral" | "Anual" | "Sob demanda";

export interface EtapaForm {
  ordem: number;
  atividade: string;
  responsavel: string;
  ferramentaDocumento: string;
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
  nivelMaturidade: 1 | 2 | 3 | 4 | 5;
  descricaoMaturidade: string;
  maturidadeDigital: "baixa" | "media" | "alta";
  descricaoMaturidadeDigital: string;
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
};
