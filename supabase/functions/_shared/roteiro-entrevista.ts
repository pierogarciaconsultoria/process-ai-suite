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
  // Não é perguntada: é registrada quando aparece em outra resposta ou em material anexado
  // (por exemplo, o fornecedor citado junto com a entrada). Mantida para não perder o dado.
  somenteRegistro?: boolean;
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
  // A versão só muda se os ids mudarem: entrevistas em andamento e relatórios antigos dependem deles.
  versao: "1.0",
  etapas: [
    {
      numero: 1,
      titulo: "Sobre o processo",
      objetivo: "Compreender o processo, seu propósito e onde ele se situa na organização.",
      textoConfirmacao: "Esse é o resumo inicial do processo. Está certo ou quer ajustar algo?",
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
          texto: "Qual área cuida desse processo, e quem é o responsável por ele? Pode responder com o cargo.",
          tipo: "texto",
          campos: ["area", "donoProcesso"],
          criterio: "A área e quem responde pelo processo (cargo ou pessoa).",
          obrigatoria: true,
        },
        {
          id: "e1.dono",
          rotulo: "Responsável pelo processo",
          texto: "Quem é o responsável por esse processo?",
          tipo: "texto",
          campos: ["donoProcesso"],
          criterio: "Cargo ou pessoa que responde pelo resultado do processo.",
          obrigatoria: false,
          somenteRegistro: true,
        },
        {
          id: "e1.objetivo",
          rotulo: "Objetivo",
          texto: "Para que serve esse processo? O que ele precisa entregar ou garantir?",
          tipo: "texto",
          campos: ["objetivo"],
          criterio: "Resultado ou entrega esperada do processo, não uma lista de atividades.",
          obrigatoria: true,
        },
        {
          id: "e1.classificacao",
          rotulo: "Tipo de processo",
          texto: "Esse processo faz parte do negócio principal (vender, produzir, entregar ao cliente), apoia a operação (RH, TI, financeiro) ou é de gestão (planejamento, controle)?",
          tipo: "opcao",
          opcoes: ["Negócio", "Apoio", "Gestão"],
          campos: ["classificacao"],
          criterio: "Uma das opções: Negócio, Apoio ou Gestão.",
          obrigatoria: true,
        },
        {
          id: "e1.frequencia",
          rotulo: "Frequência",
          texto: "Com que frequência esse processo acontece? Se puder, diga mais ou menos quantas vezes por dia, semana ou mês.",
          ajuda: "Ex.: várias vezes ao dia, uns 200 pedidos por mês, uma vez no fim do mês.",
          tipo: "texto",
          campos: [],
          criterio: "Uma frequência identificável; a quantidade aproximada, se o entrevistado souber.",
          obrigatoria: true,
        },
        {
          id: "e1.requisitos",
          rotulo: "Normas e exigências",
          texto: "Existe alguma norma, lei, contrato ou auditoria que esse processo precisa seguir? Se não houver, é só dizer.",
          ajuda: "Ex.: ISO 9001, legislação trabalhista, contrato com cliente.",
          tipo: "texto",
          campos: [],
          criterio: "Requisitos citados ou a afirmação de que não há.",
          obrigatoria: false,
        },
      ],
    },
    {
      numero: 2,
      titulo: "Começo e fim",
      objetivo: "Delimitar as fronteiras do processo: o que entra, o que sai, quem fornece e quem recebe.",
      textoConfirmacao: "Esse é o começo e o fim do processo. Está certo ou quer ajustar algo?",
      perguntas: [
        {
          id: "e2.gatilho",
          rotulo: "O que dá início",
          texto: "O que dá início a esse processo?",
          ajuda: "Ex.: um pedido do cliente, uma data do mês, uma solicitação interna.",
          tipo: "texto",
          campos: ["gatilho"],
          criterio: "Evento, data ou solicitação concreta que inicia o processo.",
          obrigatoria: true,
        },
        {
          id: "e2.entradas",
          rotulo: "O que recebe",
          texto: "O que você precisa receber para começar (informações, documentos, materiais), e quem envia cada coisa?",
          tipo: "lista",
          campos: ["entradas"],
          criterio: "Ao menos uma entrada concreta e quem a fornece (área, pessoa, sistema ou empresa externa).",
          obrigatoria: true,
        },
        {
          id: "e2.fornecedores",
          rotulo: "Quem envia",
          texto: "De onde vem cada uma dessas entradas? Quem fornece?",
          tipo: "lista",
          campos: ["entradas"],
          criterio: "Um fornecedor (área, pessoa, sistema ou empresa externa) para cada entrada citada.",
          obrigatoria: false,
          somenteRegistro: true,
        },
        {
          id: "e2.saida_principal",
          rotulo: "O que entrega",
          texto: "O que o processo entrega no final, e para quem?",
          tipo: "texto",
          campos: ["saidas", "clienteProcesso"],
          criterio: "O que é produzido, entregue ou aprovado ao final, e quem recebe (área, pessoa ou cliente).",
          obrigatoria: true,
        },
        {
          id: "e2.cliente",
          rotulo: "Para quem entrega",
          texto: "Para quem vai essa saída? Quem é o cliente do processo, interno ou externo?",
          tipo: "texto",
          campos: ["saidas", "clienteProcesso"],
          criterio: "Área, pessoa ou cliente que recebe a saída.",
          obrigatoria: false,
          somenteRegistro: true,
        },
        {
          id: "e2.saidas_secundarias",
          rotulo: "Outras entregas",
          texto: "O processo gera outras saídas, como registros, relatórios ou notificações?",
          tipo: "lista",
          campos: ["saidas"],
          criterio: "Saídas secundárias citadas ou a afirmação de que não há.",
          obrigatoria: false,
          somenteRegistro: true,
        },
      ],
    },
    {
      numero: 3,
      titulo: "Passo a passo",
      objetivo: "Levantar as atividades na sequência, com executores, decisões e aprovações.",
      textoConfirmacao: "Esse é o passo a passo do processo. Está completo e na ordem certa?",
      perguntas: [
        {
          id: "e3.atividades",
          rotulo: "Atividades",
          texto: "Agora me conte o passo a passo, do início ao fim: o que é feito e quem faz cada parte (cargo ou área). Pode escrever do seu jeito, em tópicos ou num texto corrido.",
          tipo: "texto",
          campos: ["etapas"],
          criterio: "As atividades em ordem, cada uma com quem a executa (cargo ou área).",
          obrigatoria: true,
          repetir: {
            textoProxima: "O que acontece depois disso, e quem faz? Se o processo termina aí, é só me dizer.",
            maxIteracoes: 60,
          },
        },
        {
          id: "e3.sistemas",
          rotulo: "Sistemas e ferramentas",
          texto: "Quais sistemas, planilhas ou ferramentas vocês usam nesse processo?",
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
          somenteRegistro: true,
        },
        {
          id: "e3.terceiros",
          rotulo: "Atividades terceirizadas",
          texto: "Alguma atividade é feita por terceiros ou parceiros externos?",
          tipo: "sim_nao",
          campos: ["areasEnvolvidas"],
          criterio: "Sim ou não; se sim, quais atividades e quem executa.",
          obrigatoria: false,
          somenteRegistro: true,
        },
        {
          id: "e3.decisoes",
          rotulo: "Decisões e aprovações",
          texto: "Em algum ponto alguém precisa decidir o caminho ou aprovar algo para o processo seguir?",
          ajuda: "Ex.: se o pedido estiver incompleto, volta para o vendedor; acima de R$ 10 mil, o gerente aprova.",
          tipo: "sim_nao",
          campos: ["decisoes"],
          criterio: "Sim ou não; se sim, a condição, os caminhos de cada resposta e se há aprovação.",
          obrigatoria: true,
        },
        {
          id: "e3.aprovacoes",
          rotulo: "Aprovações",
          texto: "Alguma atividade precisa de aprovação antes de seguir?",
          tipo: "sim_nao",
          campos: ["decisoes"],
          criterio: "Sim ou não; se sim, quais atividades.",
          obrigatoria: false,
          somenteRegistro: true,
        },
        {
          id: "e3.aprovador",
          rotulo: "Aprovador e substituto",
          texto: "Quem aprova? E quem aprova quando essa pessoa não está?",
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
          somenteRegistro: true,
        },
        {
          id: "e3.excecoes",
          rotulo: "O que dá errado",
          texto: "O que costuma dar errado nesse processo (erros, retrabalho, devoluções), com que frequência, e como vocês resolvem?",
          tipo: "texto",
          campos: ["problemas", "problemasTexto"],
          criterio: "Os problemas que acontecem e como são tratados hoje, mesmo que informalmente, ou a afirmação de que não ocorrem.",
          obrigatoria: true,
        },
      ],
    },
    {
      numero: 4,
      titulo: "Prazos e números",
      objetivo: "Entender como o processo é medido hoje e como deveria ser medido.",
      textoConfirmacao: "Esses são os prazos e números do processo. Está certo?",
      perguntas: [
        {
          id: "e4.medicao_hoje",
          rotulo: "Como é acompanhado",
          texto: "Como você sabe se esse processo está indo bem ou mal? Acompanha algum número?",
          tipo: "texto",
          campos: [],
          criterio: "Forma de acompanhamento atual, ou a afirmação de que não há medição.",
          obrigatoria: true,
        },
        {
          id: "e4.sla",
          rotulo: "Prazo para concluir",
          texto: "Existe um prazo para o processo, ou alguma etapa dele, ficar pronto? O que acontece se atrasar?",
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
          obrigatoria: false,
          somenteRegistro: true,
        },
        {
          id: "e4.erros",
          rotulo: "Erros e retrabalho",
          texto: "Acontecem erros, retrabalhos ou devoluções nesse processo? Com que frequência?",
          tipo: "texto",
          campos: ["problemas", "problemasTexto"],
          criterio: "Tipos de erro ou retrabalho e uma noção de frequência, ou a afirmação de que não ocorrem.",
          obrigatoria: false,
          somenteRegistro: true,
        },
        {
          id: "e4.indicadores_ideais",
          rotulo: "Indicadores desejados",
          texto: "Se você pudesse acompanhar só 3 números para saber se o processo vai bem, quais seriam?",
          tipo: "lista",
          campos: ["indicadores"],
          criterio: "De 1 a 3 indicadores mensuráveis.",
          obrigatoria: false,
          somenteRegistro: true,
        },
      ],
    },
    {
      numero: 5,
      titulo: "Dificuldades",
      acaoIA: "diagnostico_as_is",
      objetivo: "Diagnosticar o processo atual (AS IS) com base em Lean, BPM e ISO 9001.",
      textoConfirmacao: "Esse diagnóstico reflete a realidade do processo? O que você corrigiria ou acrescentaria?",
      perguntas: [
        {
          id: "e5.dores",
          rotulo: "Dificuldades",
          texto: "Hoje, o que mais atrapalha esse processo? Onde ele trava, atrasa ou dá trabalho a mais?",
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
      titulo: "Melhorias",
      acaoIA: "plano_melhoria",
      objetivo: "Priorizar melhorias e montar o plano de ação 5W2H.",
      textoConfirmacao: "Esse é o plano de melhoria proposto. Podemos considerá-lo aprovado ou quer ajustar algo?",
      perguntas: [
        {
          id: "e6.prioridades",
          rotulo: "Prioridades",
          texto: "Das melhorias que apareceram no diagnóstico, quais são prioridade para vocês? Existe alguma limitação, como orçamento, prazo, pessoas ou sistema?",
          tipo: "lista",
          campos: [],
          criterio: "Ao menos uma oportunidade escolhida; as limitações, se houver.",
          obrigatoria: true,
        },
        {
          id: "e6.restricoes",
          rotulo: "Limitações",
          texto: "Existe alguma restrição de orçamento, prazo, pessoas ou tecnologia que limite as melhorias?",
          tipo: "texto",
          campos: [],
          criterio: "Restrições citadas ou a afirmação de que não há.",
          obrigatoria: false,
          somenteRegistro: true,
        },
        {
          id: "e6.prazo",
          rotulo: "Prazo de implantação",
          texto: "Quem vai conduzir essas mudanças, e em quanto tempo vocês esperam concluí-las?",
          tipo: "texto",
          campos: [],
          criterio: "O prazo esperado e quem conduz (cargo ou área), ou a afirmação de que ainda não foi definido.",
          obrigatoria: true,
        },
        {
          id: "e6.gestor_mudanca",
          rotulo: "Responsável pelas mudanças",
          texto: "Quem vai conduzir essas mudanças?",
          tipo: "texto",
          campos: [],
          criterio: "Cargo ou pessoa responsável pela implantação.",
          obrigatoria: false,
          somenteRegistro: true,
        },
      ],
    },
  ],
};
