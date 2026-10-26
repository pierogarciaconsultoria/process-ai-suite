// Roteiro da entrevista guiada do Peter, derivado das 6 etapas de
// supabase/config/system_prompt_peter_v5.md. O código conduz a sequência;
// o Peter só interpreta cada resposta, aprofunda quando falta algo e executa
// as análises (diagnóstico AS IS e plano de melhoria).

export type TipoResposta = "texto" | "lista" | "sim_nao" | "opcao";

export type AcaoIA = "diagnostico_as_is" | "plano_melhoria";

// Campos de ProcessoFormData (src/data/processo-form-types.ts) que uma resposta alimenta.
// Toda resposta também fica registrada por id da pergunta, mesmo sem campo associado.
export type CampoFormulario =
  | "entrevistados"
  | "nomeProcesso"
  | "area"
  | "donoProcesso"
  | "objetivo"
  | "classificacao"
  | "clienteProcesso"
  | "areasEnvolvidas"
  | "gatilho"
  | "entradas"
  | "etapas"
  | "decisoes"
  | "saidas"
  | "recursos"
  | "problemas"
  | "problemasTexto"
  | "riscosTexto"
  | "indicadores"
  | "oportunidadesMelhoria"
  | "planoAcao";

export interface CondicaoPergunta {
  perguntaId: string;
  valor: string;
}

export interface RepeticaoPergunta {
  textoProxima: string;
  maxIteracoes: number;
}

export interface PerguntaRoteiro {
  id: string;
  rotulo: string;
  texto: string;
  ajuda?: string;
  tipo: TipoResposta;
  opcoes?: string[];
  campos: CampoFormulario[];
  criterio: string;
  obrigatoria: boolean;
  condicao?: CondicaoPergunta;
  repetir?: RepeticaoPergunta;
}

export interface EtapaRoteiro {
  numero: number;
  titulo: string;
  objetivo: string;
  perguntas: PerguntaRoteiro[];
  acaoIA?: AcaoIA;
  textoConfirmacao: string;
}

export interface Roteiro {
  versao: string;
  etapas: EtapaRoteiro[];
}

export const ROTEIRO_PADRAO: Roteiro = {
  versao: "1.0",
  etapas: [
    {
      numero: 1,
      titulo: "Identificação e contexto",
      objetivo: "Compreender o processo, seu propósito e onde ele se situa na organização.",
      textoConfirmacao: "Esse é o retrato inicial do processo. Está correto ou quer ajustar algo antes de seguirmos?",
      perguntas: [
        {
          id: "e1.entrevistado",
          rotulo: "Entrevistado",
          texto: "Para começar, qual é o seu nome e o seu cargo?",
          tipo: "texto",
          campos: ["entrevistados"],
          criterio: "Nome e cargo ou função do entrevistado.",
          obrigatoria: true,
        },
        {
          id: "e1.nome",
          rotulo: "Nome do processo",
          texto: "Qual é o nome do processo que vamos mapear?",
          ajuda: "Ex.: Compra de materiais, Admissão de colaboradores, Faturamento.",
          tipo: "texto",
          campos: ["nomeProcesso"],
          criterio: "Nome curto que identifique o processo, não uma descrição longa.",
          obrigatoria: true,
        },
        {
          id: "e1.area",
          rotulo: "Área",
          texto: "A qual área ou departamento esse processo pertence?",
          tipo: "texto",
          campos: ["area"],
          criterio: "Nome de uma área, setor ou departamento.",
          obrigatoria: true,
        },
        {
          id: "e1.dono",
          rotulo: "Dono do processo",
          texto: "Quem é o responsável (dono) por esse processo? Pode responder com o cargo.",
          tipo: "texto",
          campos: ["donoProcesso"],
          criterio: "Cargo ou pessoa que responde pelo resultado do processo.",
          obrigatoria: true,
        },
        {
          id: "e1.objetivo",
          rotulo: "Objetivo",
          texto: "Qual é o objetivo principal desse processo? O que ele precisa entregar ou garantir?",
          tipo: "texto",
          campos: ["objetivo"],
          criterio: "Resultado ou entrega esperada do processo, não uma lista de atividades.",
          obrigatoria: true,
        },
        {
          id: "e1.classificacao",
          rotulo: "Classificação",
          texto: "Esse processo faz parte da atividade-fim da empresa (vender, produzir, entregar ao cliente), é de apoio (RH, TI, financeiro, jurídico) ou é de gestão (planejamento, controle)?",
          tipo: "opcao",
          opcoes: ["Negócio", "Apoio", "Gestão"],
          campos: ["classificacao"],
          criterio: "Uma das opções: Negócio, Apoio ou Gestão.",
          obrigatoria: true,
        },
        {
          id: "e1.frequencia",
          rotulo: "Frequência",
          texto: "Com que frequência esse processo acontece?",
          tipo: "opcao",
          opcoes: ["Contínuo", "Diário", "Semanal", "Mensal", "Sob demanda"],
          campos: [],
          criterio: "Uma frequência identificável.",
          obrigatoria: true,
        },
        {
          id: "e1.requisitos",
          rotulo: "Requisitos normativos",
          texto: "Existe alguma norma, lei, contrato ou auditoria que esse processo precisa atender?",
          ajuda: "Ex.: ISO 9001, legislação trabalhista, contrato com cliente. Se não houver, é só dizer.",
          tipo: "texto",
          campos: [],
          criterio: "Requisitos citados ou a afirmação de que não há.",
          obrigatoria: false,
        },
      ],
    },
    {
      numero: 2,
      titulo: "Entradas e saídas (SIPOC)",
      objetivo: "Delimitar as fronteiras do processo: o que entra, o que sai, quem fornece e quem recebe.",
      textoConfirmacao: "Esse é o SIPOC do processo. Está correto ou quer ajustar algo?",
      perguntas: [
        {
          id: "e2.gatilho",
          rotulo: "Gatilho",
          texto: "O que dispara (inicia) esse processo?",
          ajuda: "Ex.: um pedido do cliente, uma data do mês, uma solicitação interna.",
          tipo: "texto",
          campos: ["gatilho"],
          criterio: "Evento, data ou solicitação concreta que inicia o processo.",
          obrigatoria: true,
        },
        {
          id: "e2.entradas",
          rotulo: "Entradas",
          texto: "O que é necessário para executar o processo? Informações, documentos, materiais, aprovações...",
          tipo: "lista",
          campos: ["entradas"],
          criterio: "Ao menos uma entrada concreta.",
          obrigatoria: true,
        },
        {
          id: "e2.fornecedores",
          rotulo: "Fornecedores",
          texto: "De onde vem cada uma dessas entradas? Quem fornece?",
          tipo: "lista",
          campos: ["entradas"],
          criterio: "Um fornecedor (área, pessoa, sistema ou empresa externa) para cada entrada citada.",
          obrigatoria: true,
        },
        {
          id: "e2.saida_principal",
          rotulo: "Saída principal",
          texto: "Qual é a saída principal do processo? O que é produzido, entregue ou aprovado ao final?",
          tipo: "texto",
          campos: ["saidas"],
          criterio: "Produto, serviço, documento ou decisão concreta.",
          obrigatoria: true,
        },
        {
          id: "e2.cliente",
          rotulo: "Cliente do processo",
          texto: "Para quem vai essa saída? Quem é o cliente do processo, interno ou externo?",
          tipo: "texto",
          campos: ["saidas", "clienteProcesso"],
          criterio: "Área, pessoa ou cliente que recebe a saída.",
          obrigatoria: true,
        },
        {
          id: "e2.saidas_secundarias",
          rotulo: "Saídas secundárias",
          texto: "O processo gera outras saídas, como registros, relatórios ou notificações?",
          tipo: "lista",
          campos: ["saidas"],
          criterio: "Saídas secundárias citadas ou a afirmação de que não há.",
          obrigatoria: false,
        },
      ],
    },
    {
      numero: 3,
      titulo: "Atividades e responsáveis",
      objetivo: "Levantar as atividades na sequência, com executores, decisões e aprovações.",
      textoConfirmacao: "Esse é o fluxo do processo do início ao fim. Está completo e na ordem certa?",
      perguntas: [
        {
          id: "e3.atividades",
          rotulo: "Atividades",
          texto: "Começando pelo início: qual é a primeira atividade depois que o processo é disparado, e quem a executa (cargo ou área)?",
          tipo: "texto",
          campos: ["etapas"],
          criterio: "Uma atividade (verbo + objeto) e quem a executa, por cargo ou área.",
          obrigatoria: true,
          repetir: {
            textoProxima: "E depois disso, qual é a próxima atividade e quem a executa? Se o processo terminou aqui, é só me dizer.",
            maxIteracoes: 30,
          },
        },
        {
          id: "e3.sistemas",
          rotulo: "Sistemas e ferramentas",
          texto: "Quais sistemas, planilhas ou ferramentas são usados nessas atividades?",
          tipo: "lista",
          campos: ["recursos", "etapas"],
          criterio: "Ferramentas citadas ou a afirmação de que o processo é todo manual.",
          obrigatoria: true,
        },
        {
          id: "e3.paralelo",
          rotulo: "Atividades em paralelo",
          texto: "Alguma dessas atividades acontece ao mesmo tempo que outra?",
          tipo: "sim_nao",
          campos: [],
          criterio: "Sim ou não; se sim, quais atividades.",
          obrigatoria: false,
        },
        {
          id: "e3.terceiros",
          rotulo: "Atividades terceirizadas",
          texto: "Alguma atividade é feita por terceiros ou parceiros externos?",
          tipo: "sim_nao",
          campos: ["areasEnvolvidas"],
          criterio: "Sim ou não; se sim, quais atividades e quem executa.",
          obrigatoria: false,
        },
        {
          id: "e3.decisoes",
          rotulo: "Decisões",
          texto: "Em algum momento existe uma decisão do tipo \"se sim, faz X; se não, faz Y\"?",
          tipo: "sim_nao",
          campos: ["decisoes"],
          criterio: "Sim ou não; se sim, a condição e os caminhos de cada resposta.",
          obrigatoria: true,
        },
        {
          id: "e3.aprovacoes",
          rotulo: "Aprovações",
          texto: "Alguma atividade precisa de aprovação antes de seguir?",
          tipo: "sim_nao",
          campos: ["decisoes"],
          criterio: "Sim ou não; se sim, quais atividades.",
          obrigatoria: true,
        },
        {
          id: "e3.aprovador",
          rotulo: "Aprovador e substituto",
          texto: "Quem aprova? Existe um substituto quando essa pessoa não está?",
          tipo: "texto",
          campos: ["decisoes"],
          criterio: "Cargo do aprovador e se há substituto.",
          obrigatoria: true,
          condicao: { perguntaId: "e3.aprovacoes", valor: "sim" },
        },
        {
          id: "e3.aprovacao_negada",
          rotulo: "Aprovação negada",
          texto: "E o que acontece quando a aprovação é negada?",
          tipo: "texto",
          campos: ["decisoes"],
          criterio: "O caminho seguido após a negativa.",
          obrigatoria: true,
          condicao: { perguntaId: "e3.aprovacoes", valor: "sim" },
        },
        {
          id: "e3.prazos",
          rotulo: "Regras de prazo",
          texto: "Existem regras de prazo? Por exemplo: se não for respondido em 24h, escala para o gerente.",
          tipo: "texto",
          campos: [],
          criterio: "Regras de prazo citadas ou a afirmação de que não há.",
          obrigatoria: false,
        },
        {
          id: "e3.excecoes",
          rotulo: "Erros e exceções",
          texto: "Quando algo dá errado nesse processo, o que acontece?",
          tipo: "texto",
          campos: [],
          criterio: "Como erros e exceções são tratados hoje, mesmo que informalmente.",
          obrigatoria: true,
        },
      ],
    },
    {
      numero: 4,
      titulo: "Indicadores e métricas",
      objetivo: "Entender como o processo é medido hoje e como deveria ser medido.",
      textoConfirmacao: "Esses são os números e indicadores do processo. Está correto?",
      perguntas: [
        {
          id: "e4.medicao_hoje",
          rotulo: "Medição atual",
          texto: "Como você sabe hoje se esse processo está funcionando bem ou mal?",
          tipo: "texto",
          campos: [],
          criterio: "Forma de acompanhamento atual, ou a afirmação de que não há medição.",
          obrigatoria: true,
        },
        {
          id: "e4.sla",
          rotulo: "Prazo / SLA",
          texto: "Existe algum prazo ou SLA que o processo precisa cumprir?",
          tipo: "texto",
          campos: [],
          criterio: "Prazo citado ou a afirmação de que não há.",
          obrigatoria: true,
        },
        {
          id: "e4.volume",
          rotulo: "Volume",
          texto: "Quantas vezes esse processo acontece por período (dia, semana ou mês)?",
          tipo: "texto",
          campos: [],
          criterio: "Quantidade aproximada por período.",
          obrigatoria: true,
        },
        {
          id: "e4.erros",
          rotulo: "Erros e retrabalho",
          texto: "Acontecem erros, retrabalhos ou devoluções nesse processo? Com que frequência?",
          tipo: "texto",
          campos: ["problemas", "problemasTexto"],
          criterio: "Tipos de erro ou retrabalho e uma noção de frequência, ou a afirmação de que não ocorrem.",
          obrigatoria: true,
        },
        {
          id: "e4.indicadores_ideais",
          rotulo: "Indicadores ideais",
          texto: "Se você pudesse acompanhar só 3 números para saber se o processo vai bem, quais seriam?",
          tipo: "lista",
          campos: ["indicadores"],
          criterio: "De 1 a 3 indicadores mensuráveis.",
          obrigatoria: false,
        },
      ],
    },
    {
      numero: 5,
      titulo: "Gargalos, riscos e desperdícios",
      objetivo: "Diagnosticar o processo atual (AS IS) com base em Lean, BPM e ISO 9001.",
      acaoIA: "diagnostico_as_is",
      textoConfirmacao: "Esse diagnóstico reflete a realidade do processo? O que você corrigiria ou acrescentaria?",
      perguntas: [
        {
          id: "e5.dores",
          rotulo: "Dificuldades e gargalos",
          texto: "Na sua visão, quais são hoje as maiores dificuldades ou gargalos desse processo?",
          tipo: "lista",
          campos: ["problemasTexto"],
          criterio: "Ao menos uma dificuldade concreta, de preferência com um exemplo real.",
          obrigatoria: true,
        },
        {
          id: "e5.riscos",
          rotulo: "Riscos",
          texto: "O que de pior pode acontecer se esse processo falhar? Isso já aconteceu?",
          tipo: "texto",
          campos: ["riscosTexto"],
          criterio: "Consequência concreta de uma falha.",
          obrigatoria: true,
        },
      ],
    },
    {
      numero: 6,
      titulo: "Redesenho e plano de melhoria",
      objetivo: "Priorizar melhorias e montar o plano de ação 5W2H.",
      acaoIA: "plano_melhoria",
      textoConfirmacao: "Esse é o plano de melhoria proposto. Podemos considerá-lo aprovado ou quer ajustar algo?",
      perguntas: [
        {
          id: "e6.prioridades",
          rotulo: "Prioridades",
          texto: "Das oportunidades que apareceram no diagnóstico, quais você considera prioritárias?",
          tipo: "lista",
          campos: [],
          criterio: "Ao menos uma oportunidade escolhida.",
          obrigatoria: true,
        },
        {
          id: "e6.restricoes",
          rotulo: "Restrições",
          texto: "Existe alguma restrição de orçamento, prazo, pessoas ou tecnologia que limite as melhorias?",
          tipo: "texto",
          campos: [],
          criterio: "Restrições citadas ou a afirmação de que não há.",
          obrigatoria: false,
        },
        {
          id: "e6.prazo",
          rotulo: "Prazo de implantação",
          texto: "Em quanto tempo vocês esperam implantar essas melhorias?",
          tipo: "texto",
          campos: [],
          criterio: "Um prazo ou horizonte de tempo.",
          obrigatoria: true,
        },
        {
          id: "e6.gestor_mudanca",
          rotulo: "Responsável pelas mudanças",
          texto: "Quem vai conduzir essas mudanças?",
          tipo: "texto",
          campos: [],
          criterio: "Cargo ou pessoa responsável pela implantação.",
          obrigatoria: true,
        },
      ],
    },
  ],
};
