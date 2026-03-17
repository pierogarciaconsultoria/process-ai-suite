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

export interface RiscoForm {
  risco: string;
  consequencia: string;
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

  // 7. Saídas
  saidas: string;

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
  entradas: "",
  etapas: [{ ordem: 1, atividade: "", responsavel: "", ferramentaDocumento: "" }],
  decisoes: "",
  saidas: "",
  recursos: "",
  frequencia: "Sob demanda",
  tempoExecucao: "",
  problemas: { retrabalho: false, atrasos: false, erros: false, dependencia: false, faltaPadrao: false },
  problemasTexto: "",
  gargalos: "",
  riscos: [{ risco: "", consequencia: "" }],
  controles: "",
  indicadores: [{ indicador: "", meta: "" }],
  sugestoes: "",
  automacao: "",
  documentacao: "",
  criticidadeDetalhada: { impactoNegocio: 1, impactoCliente: 1, riscoOperacional: 1 },
  planoAcao: [{ oque: "", porque: "", quem: "", quando: "", onde: "", como: "", custo: "" }],
  conclusao: "",
};
