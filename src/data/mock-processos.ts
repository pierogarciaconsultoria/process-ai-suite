export type Status = "Novo" | "Mapeado" | "Em Análise" | "Documentado" | "Aprovado";
export type Criticidade = "Baixa" | "Média" | "Alta" | "Crítica";

export interface Processo {
  id: string;
  nome: string;
  area: string;
  responsavel: string;
  status: Status;
  criticidade: Criticidade;
  data_criacao: string;
  mapa_revisao?: string;
  mapa_aprovado_em?: string;
}

export interface DiagnosticoItem {
  tipo: "Gargalo" | "Risco" | "Atenção";
  descricao: string;
}

export interface Indicador {
  nome: string;
  formula: string;
  meta: string;
}

export interface Melhoria {
  acao: string;
  responsavel: string;
  prazo: string;
  status: "Pendente" | "Em andamento" | "Concluído";
}

export interface ProcessoDetalhado extends Processo {
  descricao?: string;
  diagnostico: DiagnosticoItem[];
  indicadores: Indicador[];
  melhorias: Melhoria[];
}

export const processos: Processo[] = [
  { id: "1", nome: "Gestão de Vendas", area: "Comercial", responsavel: "Ana Silva", status: "Aprovado", criticidade: "Alta", data_criacao: "2024-03-01", mapa_revisao: "Rev.00", mapa_aprovado_em: "2026-05-10" },
  { id: "2", nome: "Onboarding de Clientes", area: "Operações", responsavel: "Carlos Souza", status: "Em Análise", criticidade: "Média", data_criacao: "2024-03-05", mapa_revisao: "Rev.00" },
  { id: "3", nome: "Fechamento Contábil", area: "Financeiro", responsavel: "Maria Oliveira", status: "Aprovado", criticidade: "Crítica", data_criacao: "2024-03-10", mapa_revisao: "Rev.01", mapa_aprovado_em: "2026-05-18" },
  { id: "4", nome: "Recrutamento e Seleção", area: "RH", responsavel: "Pedro Santos", status: "Novo", criticidade: "Baixa", data_criacao: "2024-03-12" },
  { id: "5", nome: "Atendimento ao Cliente", area: "Suporte", responsavel: "Julia Mendes", status: "Em Análise", criticidade: "Média", data_criacao: "2024-03-14" },
  { id: "6", nome: "Logística de Entrega", area: "Logística", responsavel: "Rafael Lima", status: "Aprovado", criticidade: "Alta", data_criacao: "2024-03-15", mapa_revisao: "Rev.00", mapa_aprovado_em: "2026-04-28" },
  { id: "7", nome: "Faturamento", area: "Financeiro", responsavel: "Paula Ferreira", status: "Documentado", criticidade: "Média", data_criacao: "2024-03-16" },
  { id: "8", nome: "Gestão de Contratos", area: "Jurídico", responsavel: "Bruno Almeida", status: "Novo", criticidade: "Baixa", data_criacao: "2024-03-17" },
];

export const processosDetalhados: Record<string, ProcessoDetalhado> = {
  "1": {
    ...processos.find((p) => p.id === "1")!,
    descricao: "Ciclo de vendas de propostas B2B com etapas de qualificação, proposta e fechamento.",
    diagnostico: [
      { tipo: "Gargalo", descricao: "Aprovação manual do gerente causa atraso médio de 2 dias." },
      { tipo: "Risco", descricao: "Dependência de planilhas Excel sem backup estruturado." },
      { tipo: "Atenção", descricao: "Atividades duplicadas entre pré-vendas e vendas." },
    ],
    indicadores: [
      { nome: "Tempo médio de ciclo", formula: "Soma do tempo / Nº negociações", meta: "≤ 15 dias" },
      { nome: "Taxa de conversão", formula: "Fechamentos / Propostas × 100", meta: "≥ 25%" },
      { nome: "Lead time de proposta", formula: "Data envio - Data qualificação", meta: "≤ 48h" },
    ],
    melhorias: [
      { acao: "Automatizar aprovação de propostas até R$10k", responsavel: "Ana Silva", prazo: "2024-04-30", status: "Em andamento" },
      { acao: "Migrar planilhas para CRM", responsavel: "Carlos Souza", prazo: "2024-05-15", status: "Pendente" },
    ],
  },
  "2": {
    ...processos.find((p) => p.id === "2")!,
    descricao: "Integração de novos clientes com coleta de dados, configuração e validação de acesso.",
    diagnostico: [
      { tipo: "Gargalo", descricao: "Coleta de documentos manual causa retrabalho frequente." },
      { tipo: "Risco", descricao: "Ausência de checklist padronizado por segmento." },
      { tipo: "Atenção", descricao: "Comunicação com cliente sem SLA definido." },
    ],
    indicadores: [
      { nome: "Tempo de ativação", formula: "Data ativação - Data contrato", meta: "≤ 7 dias" },
      { nome: "Retrabalho por falta de docs", formula: "Solicitações adicionais / Ativações × 100", meta: "≤ 10%" },
    ],
    melhorias: [
      { acao: "Criar checklist por segmento", responsavel: "Carlos Souza", prazo: "2024-04-20", status: "Em andamento" },
    ],
  },
  "3": {
    ...processos.find((p) => p.id === "3")!,
    descricao: "Fechamento contábil mensal com conciliações e geração de demonstrativos.",
    diagnostico: [
      { tipo: "Gargalo", descricao: "Conciliação bancária manual em múltiplas contas." },
      { tipo: "Risco", descricao: "Dependência de uma única analista para validação final." },
      { tipo: "Atenção", descricao: "Integração com ERP instável em picos de uso." },
    ],
    indicadores: [
      { nome: "Tempo de fechamento", formula: "Data fechamento - Fim do mês", meta: "≤ 5 dias" },
      { nome: "Erros de conciliação", formula: "Erros / Transações × 100", meta: "≤ 1%" },
    ],
    melhorias: [
      { acao: "Automatizar conciliação com regras", responsavel: "Maria Oliveira", prazo: "2024-05-10", status: "Pendente" },
    ],
  },
  "4": {
    ...processos.find((p) => p.id === "4")!,
    descricao: "Recrutamento e seleção para posições administrativas e técnicas.",
    diagnostico: [
      { tipo: "Gargalo", descricao: "Entrevistas agendadas manualmente sem integração de calendários." },
      { tipo: "Risco", descricao: "Base de currículos sem política de retenção." },
      { tipo: "Atenção", descricao: "Feedback para candidatos com atraso médio de 4 dias." },
    ],
    indicadores: [
      { nome: "Tempo até contratação", formula: "Data admissão - Data abertura", meta: "≤ 30 dias" },
      { nome: "Taxa de desistência", formula: "Desistências / Processos × 100", meta: "≤ 5%" },
    ],
    melhorias: [
      { acao: "Implantar agendamento automático", responsavel: "Pedro Santos", prazo: "2024-04-25", status: "Em andamento" },
    ],
  },
};

export interface EtapaForm {
  ordem: number;
  atividade: string;
  responsavel: string;
  sistema: string;
}

export interface RiscoForm {
  risco: string;
  impacto: string;
}

export interface ProcessoFormMock {
  objetivo: string;
  clienteProcesso: string;
  areasEnvolvidas: string;
  entradas: string;
  etapas: EtapaForm[];
  decisoes: string;
  saidas: string;
  problemas: { retrabalho: boolean; atrasos: boolean; erros: boolean; dependencia: boolean };
  problemasTexto: string;
  riscos: RiscoForm[];
  indicadores: string;
  sugestoes: string;
}

export const processosFormMock: Record<string, ProcessoFormMock> = {
  "1": {
    objetivo: "Fechar negócios B2B com maior taxa de conversão e lead time reduzido.",
    clienteProcesso: "Cliente corporativo",
    areasEnvolvidas: "Comercial, Pré-vendas, Financeiro",
    entradas: "Lead qualificado, briefing do cliente, políticas comerciais vigentes",
    etapas: [
      { ordem: 1, atividade: "Qualificação de oportunidade", responsavel: "Pré-vendas", sistema: "CRM" },
      { ordem: 2, atividade: "Elaboração de proposta", responsavel: "Comercial", sistema: "CRM" },
      { ordem: 3, atividade: "Aprovação de proposta", responsavel: "Gerente Comercial", sistema: "CRM" },
      { ordem: 4, atividade: "Negociação e ajuste", responsavel: "Comercial", sistema: "CRM" },
      { ordem: 5, atividade: "Fechamento e assinatura", responsavel: "Comercial", sistema: "CRM" },
    ],
    decisoes: "Aprovação obrigatória para propostas acima de R$10.000.",
    saidas: "Contrato assinado, pedido gerado, handoff para onboarding",
    problemas: { retrabalho: true, atrasos: true, erros: false, dependencia: false },
    problemasTexto: "Dados incompletos dos leads causam retrabalho na elaboração das propostas.",
    riscos: [
      { risco: "Dependência de aprovação manual em alto volume", impacto: "Atraso de ciclo" },
      { risco: "Propostas fora da política comercial", impacto: "Margem negativa" },
    ],
    indicadores: "Taxa de conversão, tempo de ciclo, lead time de proposta",
    sugestoes: "Automatizar aprovação até R$10k e checklist de dados mínimos para lead.",
  },
  "2": {
    objetivo: "Ativar clientes com experiência fluida e sem retrabalho.",
    clienteProcesso: "Cliente recém-contratado",
    areasEnvolvidas: "Operações, Suporte, Comercial",
    entradas: "Contrato fechado, dados cadastrais, documentos de compliance",
    etapas: [
      { ordem: 1, atividade: "Coleta de documentos", responsavel: "Operações", sistema: "Portal" },
      { ordem: 2, atividade: "Configuração inicial", responsavel: "Operações", sistema: "Sistema" },
      { ordem: 3, atividade: "Validação de acesso", responsavel: "Suporte", sistema: "Sistema" },
      { ordem: 4, atividade: "Handoff para CS", responsavel: "Operações", sistema: "CRM" },
    ],
    decisoes: "Checklist completo antes da ativação final.",
    saidas: "Cliente ativo, credenciais entregues, agenda de kick-off",
    problemas: { retrabalho: true, atrasos: false, erros: true, dependencia: false },
    problemasTexto: "Documentação incompleta gera múltiplas idas e vindas.",
    riscos: [{ risco: "Sem checklist por segmento", impacto: "Expectativas desalinhadas" }],
    indicadores: "Tempo de ativação, taxa de retrabalho, NPS inicial",
    sugestoes: "Checklist por segmento e SLA de comunicação com cliente.",
  },
  "3": {
    objetivo: "Fechar o mês com acurácia e demonstrações tempestivas.",
    clienteProcesso: "Diretoria e Auditoria",
    areasEnvolvidas: "Financeiro, Contábil, TI",
    entradas: "Extratos bancários, lançamentos, notas fiscais",
    etapas: [
      { ordem: 1, atividade: "Conciliação bancária", responsavel: "Financeiro", sistema: "ERP" },
      { ordem: 2, atividade: "Validação de lançamentos", responsavel: "Contábil", sistema: "ERP" },
      { ordem: 3, atividade: "Ajustes e provisões", responsavel: "Contábil", sistema: "ERP" },
      { ordem: 4, atividade: "Geração de DRE e balanço", responsavel: "Contábil", sistema: "ERP" },
    ],
    decisoes: "Critérios de materialidade para ajustes.",
    saidas: "Demonstrações financeiras, balancete fechado",
    problemas: { retrabalho: false, atrasos: true, erros: false, dependencia: true },
    problemasTexto: "Dependência de uma analista para validação cria fila.",
    riscos: [{ risco: "ERP instável em pico", impacto: "Atraso de fechamento" }],
    indicadores: "Tempo de fechamento, taxa de ajustes pós-fechamento",
    sugestoes: "Automação de conciliação e distribuição de validação por revezamento.",
  },
  "4": {
    objetivo: "Contratar com velocidade mantendo qualidade do processo.",
    clienteProcesso: "Gestores requisitantes",
    areasEnvolvidas: "RH, Áreas requisitantes",
    entradas: "Requisição de vaga, perfil do candidato",
    etapas: [
      { ordem: 1, atividade: "Triagem de currículos", responsavel: "RH", sistema: "ATS" },
      { ordem: 2, atividade: "Entrevista técnica", responsavel: "Gestor", sistema: "Calendário" },
      { ordem: 3, atividade: "Proposta de contratação", responsavel: "RH", sistema: "ATS" },
    ],
    decisoes: "Critérios mínimos para shortlist.",
    saidas: "Candidato contratado, documentação iniciada",
    problemas: { retrabalho: false, atrasos: true, erros: false, dependencia: false },
    problemasTexto: "Agendamentos manuais geram atraso médio.",
    riscos: [{ risco: "Base sem política de retenção", impacto: "Risco LGPD" }],
    indicadores: "Tempo até contratação, taxa de desistência",
    sugestoes: "Agendamento automático e feedback em até 48h.",
  },
};
