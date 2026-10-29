import { describe, expect, it } from "vitest";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import {
  concluirAcao,
  confirmarEtapa,
  iniciarRoteiro,
  proximoPasso,
  registrarResposta,
  type EstadoRoteiro,
} from "../../supabase/functions/_shared/roteiro-engine";
import {
  aplicarAnalise,
  aplicarAvaliacao,
  aplicarConfirmacao,
  aplicarExtracao,
  descreverPasso,
  filtrarCampos,
  iniciarTurno,
  perguntasEmAberto,
  promptAnalise,
  promptAvaliacao,
  promptExtracao,
  sanitizarEstado,
  sanitizarHistorico,
  schemaAnalise,
  schemaAvaliacao,
  schemaConfirmacao,
  schemaExtracao,
  textoDoPasso,
  validarArquivo,
} from "../../supabase/functions/_shared/roteiro-peter";
import { SCHEMA_DIAGNOSTICO, SCHEMA_PLANO } from "../../supabase/functions/_shared/roteiro-analise";

const roteiro = ROTEIRO_PADRAO;
const persona = { identidade: "Você é o Peter.", regras: "- Seja claro.", orientacoesEmpresa: "- Nenhuma." };

function avaliacao(overrides: Record<string, unknown> = {}) {
  return {
    suficiente: true,
    texto: "resposta",
    valor: null,
    encerraRepeticao: true,
    comentario: "",
    aprofundamento: "",
    alerta: null,
    oportunidade: null,
    campos: {},
    ...overrides,
  };
}

// Avança respondendo tudo com "sim" até a etapa indicada ficar aguardando confirmação.
function ateConfirmacao(numero: number): EstadoRoteiro {
  let estado = iniciarRoteiro(roteiro);
  for (let i = 0; i < 200; i++) {
    const passo = proximoPasso(roteiro, estado);
    if (passo.tipo === "confirmar_etapa" && passo.etapa.numero === numero) return estado;
    if (passo.tipo === "pergunta") {
      estado = registrarResposta(roteiro, estado, {
        perguntaId: passo.pergunta.id,
        texto: `r ${passo.pergunta.id}`,
        suficiente: true,
        valor: passo.pergunta.tipo === "sim_nao" ? "sim" : undefined,
        encerraRepeticao: true,
      });
    } else if (passo.tipo === "acao_ia") {
      estado = concluirAcao(roteiro, estado, passo.acao);
    } else if (passo.tipo === "confirmar_etapa") {
      estado = confirmarEtapa(roteiro, estado);
    }
  }
  throw new Error("etapa não alcançada");
}

// Regras do modo strict da OpenAI: todo objeto fecha additionalProperties e exige todas as chaves.
function verificarStrict(schema: unknown, caminho = "$"): void {
  if (!schema || typeof schema !== "object") return;
  const node = schema as Record<string, unknown>;
  const tipos = Array.isArray(node.type) ? node.type : [node.type];
  if (tipos.includes("object")) {
    expect(node.additionalProperties, `${caminho}.additionalProperties`).toBe(false);
    expect([...(node.required as string[])].sort(), `${caminho}.required`).toEqual(Object.keys(node.properties as object).sort());
    for (const [chave, filho] of Object.entries(node.properties as object)) verificarStrict(filho, `${caminho}.${chave}`);
  }
  if (node.items) verificarStrict(node.items, `${caminho}[]`);
  if (Array.isArray(node.anyOf)) node.anyOf.forEach((filho, indice) => verificarStrict(filho, `${caminho}|${indice}`));
}

describe("Peter no roteiro — schemas", () => {
  it("gera schemas compatíveis com o modo strict para todas as perguntas e etapas", () => {
    for (const etapa of roteiro.etapas) {
      verificarStrict(schemaConfirmacao(etapa));
      for (const pergunta of etapa.perguntas) {
        verificarStrict(schemaAvaliacao(pergunta));
        verificarStrict(schemaAvaliacao(pergunta, perguntasEmAberto(roteiro, iniciarRoteiro(roteiro), pergunta.id)));
      }
    }
    verificarStrict(schemaExtracao(roteiro));
    verificarStrict(schemaExtracao(roteiro, confirmarEtapa(roteiro, ateConfirmacao(1))));
    verificarStrict(SCHEMA_DIAGNOSTICO);
    verificarStrict(SCHEMA_PLANO);
  });

  it("restringe o valor às opções da pergunta", () => {
    const classificacao = roteiro.etapas[0].perguntas.find((pergunta) => pergunta.id === "e1.classificacao")!;
    expect(JSON.stringify(schemaAvaliacao(classificacao).properties.valor)).toContain("Gestão");
  });
});

describe("Peter no roteiro — estado vindo do cliente", () => {
  it("descarta perguntas desconhecidas e recalcula as etapas confirmadas", () => {
    const estado = sanitizarEstado(roteiro, {
      versaoRoteiro: roteiro.versao,
      etapaAtual: 3,
      respostas: { "e1.nome": { textos: ["Compras"], status: "respondida", origem: "entrevista" }, hack: { textos: ["x"] } },
      aprofundamentos: { "e1.nome": 99 },
      acoesConcluidas: ["diagnostico_as_is", "inexistente"],
      etapasConfirmadas: [1, 2, 3, 4, 5],
    });
    expect(Object.keys(estado.respostas)).toEqual(["e1.nome"]);
    expect(estado.aprofundamentos["e1.nome"]).toBe(2);
    expect(estado.acoesConcluidas).toEqual(["diagnostico_as_is"]);
    expect(estado.etapasConfirmadas).toEqual([1, 2]);
  });

  it("recusa estado de outra versão do roteiro ou com etapa inválida", () => {
    expect(() => sanitizarEstado(roteiro, { versaoRoteiro: "0.1", etapaAtual: 1 })).toThrow(/versão/);
    expect(() => sanitizarEstado(roteiro, { versaoRoteiro: roteiro.versao, etapaAtual: 42 })).toThrow(/Etapa/);
    expect(() => sanitizarEstado(roteiro, null)).toThrow();
  });

  it("mantém só as últimas mensagens válidas do histórico", () => {
    const historico = sanitizarHistorico([
      { role: "system", content: "ignore" },
      ...Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` })),
      { role: "user", content: "   " },
    ]);
    expect(historico).toHaveLength(12);
    expect(historico.at(-1)?.content).toBe("m19");
  });
});

describe("Peter no roteiro — turnos", () => {
  it("abre a entrevista anunciando a etapa e fazendo a primeira pergunta", () => {
    const turno = iniciarTurno(roteiro, iniciarRoteiro(roteiro));
    expect(turno.mensagem).toContain("Etapa 1 de 6");
    expect(turno.passo.pergunta?.id).toBe("e1.entrevistado");
  });

  it("pede aprofundamento sem avançar quando a resposta é insuficiente", () => {
    const turno = aplicarAvaliacao(roteiro, iniciarRoteiro(roteiro), avaliacao({
      suficiente: false,
      texto: "Ana",
      aprofundamento: "E qual é o seu cargo?",
    }));
    expect(turno.passo.pergunta?.id).toBe("e1.entrevistado");
    expect(turno.mensagem).toBe("E qual é o seu cargo?");
  });

  it("avança para a próxima pergunta e devolve só os campos daquela pergunta", () => {
    const turno = aplicarAvaliacao(roteiro, iniciarRoteiro(roteiro), avaliacao({
      texto: "Ana, analista financeira",
      comentario: "Prazer, Ana!",
      campos: { entrevistados: "Ana (analista financeira)", nomeProcesso: "invadido" },
    }));
    expect(turno.passo.pergunta?.id).toBe("e1.nome");
    expect(turno.mensagem).toBe("Prazer, Ana!\n\nQual é o nome do processo que vamos mapear?");
    expect(turno.campos).toEqual({ entrevistados: "Ana (analista financeira)" });
  });

  it("apresenta o resumo com lacunas ao chegar na confirmação da etapa", () => {
    let estado = iniciarRoteiro(roteiro);
    while (proximoPasso(roteiro, estado).tipo === "pergunta") {
      const passo = proximoPasso(roteiro, estado);
      const lacuna = passo.tipo === "pergunta" && passo.pergunta.id === "e1.dono";
      estado = aplicarAvaliacao(roteiro, estado, avaliacao({ suficiente: !lacuna, texto: lacuna ? "" : "ok", valor: passo.tipo === "pergunta" && passo.pergunta.opcoes ? passo.pergunta.opcoes[0] : null })).estado;
    }
    const turno = iniciarTurno(roteiro, estado);
    expect(turno.passo.tipo).toBe("confirmar_etapa");
    expect(turno.mensagem).toContain("✅ **Nome do processo:** ok");
    expect(turno.mensagem).toContain("❓ **Dono do processo:** não informado");
    expect(turno.mensagem).toContain("Está correto ou quer ajustar algo");
  });

  it("confirma a etapa e anuncia a seguinte", () => {
    const turno = aplicarConfirmacao(roteiro, ateConfirmacao(1), { confirmou: true, pedeAjuste: false, comentario: "Ótimo!", correcoes: [], campos: {} }, "Está correto");
    expect(turno.estado.etapaAtual).toBe(2);
    expect(turno.mensagem).toContain("Etapa 2 de 6");
    expect(turno.passo.pergunta?.id).toBe("e2.gatilho");
  });

  it("aplica a correção e reapresenta o resumo atualizado em vez de avançar", () => {
    const turno = aplicarConfirmacao(roteiro, ateConfirmacao(1), {
      confirmou: true,
      pedeAjuste: true,
      comentario: "Ajustei a área.",
      correcoes: [{ perguntaId: "e1.area", texto: "Financeiro", valor: null }],
      campos: { area: "Financeiro" },
    }, "A área é Financeiro");
    expect(turno.estado.etapaAtual).toBe(1);
    expect(turno.passo.tipo).toBe("confirmar_etapa");
    expect(turno.mensagem).toContain("✅ **Área:** Financeiro");
    expect(turno.campos).toEqual({ area: "Financeiro" });
  });

  it("faz a pergunta condicional que uma correção tornou aplicável", () => {
    let estado = iniciarRoteiro(roteiro);
    for (let i = 0; i < 200; i++) {
      const passo = proximoPasso(roteiro, estado);
      if (passo.tipo === "confirmar_etapa" && passo.etapa.numero === 3) break;
      if (passo.tipo === "pergunta") {
        estado = registrarResposta(roteiro, estado, {
          perguntaId: passo.pergunta.id,
          texto: "ok",
          suficiente: true,
          valor: passo.pergunta.tipo === "sim_nao" ? "nao" : undefined,
          encerraRepeticao: true,
        });
      } else if (passo.tipo === "confirmar_etapa") {
        estado = confirmarEtapa(roteiro, estado);
      }
    }
    const turno = aplicarConfirmacao(roteiro, estado, {
      confirmou: false,
      pedeAjuste: true,
      comentario: "Entendi, existe aprovação.",
      correcoes: [{ perguntaId: "e3.aprovacoes", texto: "Sim, o pedido é aprovado pelo gerente", valor: "sim" }],
      campos: {},
    }, "Na verdade o gerente aprova o pedido");
    expect(turno.passo.pergunta?.id).toBe("e3.aprovador");
  });

  it("extrai respostas de texto livre sem reabrir etapas confirmadas", () => {
    const estado = confirmarEtapa(roteiro, ateConfirmacao(1));
    const turno = aplicarExtracao(roteiro, estado, {
      respostas: [
        { perguntaId: "e1.nome", texto: "outro nome", valor: null },
        { perguntaId: "e2.gatilho", texto: "Pedido do cliente", valor: null },
        { perguntaId: "e3.atividades", texto: "Receber pedido — Comercial\nAprovar pedido — Gerente", valor: null },
      ],
      comentario: "Identifiquei o gatilho e duas atividades.",
      alerta: null,
      oportunidade: null,
      campos: { gatilho: "Pedido do cliente" },
    }, "texto_livre");
    expect(turno.estado.respostas["e1.nome"].textos).toEqual(["r e1.nome"]);
    expect(turno.estado.respostas["e2.gatilho"].origem).toBe("texto_livre");
    expect(turno.estado.respostas["e3.atividades"].textos).toEqual(["Receber pedido — Comercial", "Aprovar pedido — Gerente"]);
    expect(turno.passo.pergunta?.id).toBe("e2.entradas");
    expect(turno.mensagem).toMatch(/^Identifiquei o gatilho e duas atividades\.\n\nDo que você enviou, já anotei: Gatilho, Atividades\. Não vou perguntar de novo/);
  });

  it("com diagrama BPMN, aproveita respostas parciais e o que não aparece no diagrama", () => {
    const estado = confirmarEtapa(roteiro, ateConfirmacao(1));
    const prompt = promptExtracao(persona, roteiro, estado, {});
    expect(prompt).toContain('"Resumo do diagrama"');
    expect(prompt).toContain('"nao" com o texto "Não aparece no diagrama"');
    expect(prompt).toContain("Registre o que o diagrama mostra mesmo que não cubra todo o critério");

    const turno = aplicarExtracao(roteiro, estado, {
      respostas: [
        { perguntaId: "e2.gatilho", texto: "Pedido de venda", valor: null },
        { perguntaId: "e2.entradas", texto: "Pedido de venda", valor: null },
        { perguntaId: "e3.paralelo", texto: "Não aparece no diagrama", valor: "nao" },
      ],
      comentario: "",
      alerta: null,
      oportunidade: null,
      campos: {},
    }, "anexo");
    expect(turno.estado.respostas["e3.paralelo"]).toMatchObject({ valor: "nao", origem: "anexo" });
    expect(turno.passo.pergunta?.id).toBe("e2.fornecedores");
    expect(turno.mensagem).toMatch(/^Do que você enviou, já anotei: Gatilho, Entradas, Atividades em paralelo\./);
  });

  it("não diz que anotou algo quando o material não respondeu nenhuma pergunta", () => {
    const estado = confirmarEtapa(roteiro, ateConfirmacao(1));
    const turno = aplicarExtracao(roteiro, estado, {
      respostas: [], comentario: "Não encontrei informações do processo.", alerta: null, oportunidade: null, campos: {},
    }, "anexo");
    expect(turno.mensagem).not.toContain("já anotei");
    expect(turno.passo.pergunta?.id).toBe("e2.gatilho");
  });

  it("registra o que o entrevistado adiantou e não repete essas perguntas", () => {
    const turno = aplicarAvaliacao(roteiro, iniciarRoteiro(roteiro), avaliacao({
      texto: "Ana, compradora",
      comentario: "Prazer, Ana! Já anotei o processo e as primeiras atividades.",
      outrasRespostas: [
        { perguntaId: "e1.nome", texto: "Compras de materiais", valor: null },
        { perguntaId: "e3.atividades", texto: "Receber requisição — Compras\nCotar fornecedores — Compras", valor: null },
        { perguntaId: "e1.entrevistado", texto: "não é adiantável", valor: null },
      ],
      campos: {
        entrevistados: "Ana (compradora)",
        nomeProcesso: "Compras de materiais",
        etapas: [{ atividade: "Receber requisição", responsavel: "Compras", ferramentaDocumento: "" }],
        area: "não adiantada",
      },
    }));
    expect(turno.estado.respostas["e1.entrevistado"].textos).toEqual(["Ana, compradora"]);
    expect(turno.estado.respostas["e1.nome"]).toMatchObject({ textos: ["Compras de materiais"], origem: "entrevista" });
    expect(turno.estado.respostas["e3.atividades"]).toMatchObject({
      textos: ["Receber requisição — Compras", "Cotar fornecedores — Compras"],
      repeticaoEncerrada: false,
    });
    expect(turno.passo.pergunta?.id).toBe("e1.area");
    expect(turno.mensagem).toMatch(/^Prazer, Ana! Já anotei/);
    expect(turno.campos).toEqual({
      entrevistados: "Ana (compradora)",
      nomeProcesso: "Compras de materiais",
      etapas: [{ atividade: "Receber requisição", responsavel: "Compras", ferramentaDocumento: "", ordem: 1 }],
    });
  });

  it("ao chegar nas atividades adiantadas, mostra o que já foi anotado e pede a próxima", () => {
    const antes = ateConfirmacao(2);
    const comAtividades: EstadoRoteiro = {
      ...antes,
      respostas: {
        ...antes.respostas,
        "e3.atividades": { perguntaId: "e3.atividades", textos: ["Receber requisição — Compras"], status: "respondida", origem: "entrevista", repeticaoEncerrada: false },
      },
    };
    const estado = confirmarEtapa(roteiro, comAtividades);
    const passo = descreverPasso(roteiro, estado);
    expect(passo.pergunta?.id).toBe("e3.atividades");
    const texto = textoDoPasso(roteiro, estado, passo, 2);
    expect(texto).toContain("Até aqui anotei:\n1. Receber requisição — Compras");
    expect(texto).toContain("E depois disso, qual é a próxima atividade");
  });

  it("um texto colado substitui as atividades ainda em levantamento pela lista completa", () => {
    const base = confirmarEtapa(roteiro, ateConfirmacao(2));
    const estado = aplicarAvaliacao(roteiro, base, avaliacao({ texto: "Receber requisição — Compras", encerraRepeticao: false })).estado;
    expect(perguntasEmAberto(roteiro, estado).map((pergunta) => pergunta.id)).toContain("e3.atividades");
    expect(promptExtracao(persona, roteiro, estado, {})).toContain("Já registrado: Receber requisição — Compras");

    const turno = aplicarExtracao(roteiro, estado, {
      respostas: [{ perguntaId: "e3.atividades", texto: "Receber requisição — Compras\nCotar fornecedores — Compras\nEmitir pedido — Compras", valor: null }],
      comentario: "Identifiquei o fluxo completo.",
      alerta: null,
      oportunidade: null,
      campos: { nomeProcesso: "etapa confirmada", decisoes: "Valor acima de R$ 5 mil" },
    }, "texto_livre");
    expect(turno.estado.respostas["e3.atividades"]).toMatchObject({
      textos: ["Receber requisição — Compras", "Cotar fornecedores — Compras", "Emitir pedido — Compras"],
      repeticaoEncerrada: true,
      origem: "texto_livre",
    });
    expect(turno.passo.pergunta?.id).toBe("e3.sistemas");
    expect(turno.campos).toEqual({ decisoes: "Valor acima de R$ 5 mil" });
  });

  it("envia ao Peter os valores atuais dos campos na extração e as perguntas adiantáveis na avaliação", () => {
    const estado = confirmarEtapa(roteiro, ateConfirmacao(1));
    const extracao = promptExtracao(persona, roteiro, estado, { gatilho: "Pedido do cliente", nomeProcesso: "Compras" });
    expect(extracao).toContain('"gatilho":"Pedido do cliente"');
    expect(extracao).not.toContain('"nomeProcesso"');
    expect(extracao).not.toContain("e1.nome (");

    const avaliacaoPrompt = promptAvaliacao(persona, roteiro, iniciarRoteiro(roteiro), {});
    expect(avaliacaoPrompt).toContain("## INFORMAÇÕES ADIANTADAS");
    expect(avaliacaoPrompt).toContain("- e3.atividades (Atividades)");
    expect(avaliacaoPrompt).not.toContain("- e1.entrevistado (");
  });

  it("monta o prompt com a pergunta atual e o critério de suficiência", () => {
    const prompt = promptAvaliacao(persona, roteiro, iniciarRoteiro(roteiro), {});
    expect(prompt).toContain("Para começar, qual é o seu nome e o seu cargo?");
    expect(prompt).toContain("Nome e cargo ou função do entrevistado.");
    expect(prompt).toContain("Etapa 1 de 6");
  });
});

describe("Peter no roteiro — saneamento", () => {
  it("filtra campos não permitidos, nulos e valores fora do domínio", () => {
    expect(filtrarCampos({
      etapas: [{ atividade: "Receber pedido", responsavel: "Comercial", ferramentaDocumento: "" }, "lixo"],
      classificacao: "Primário",
      area: null,
      objetivo: "  Garantir entrega  ",
      entradas: "não é lista",
    }, ["etapas", "classificacao", "area", "objetivo", "entradas"])).toEqual({
      etapas: [{ atividade: "Receber pedido", responsavel: "Comercial", ferramentaDocumento: "", ordem: 1 }],
      objetivo: "Garantir entrega",
    });
  });

  it("converte anexos para o formato da Responses API e recusa tipos inválidos", () => {
    expect(validarArquivo([
      { type: "text", text: "Descrição do processo" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAAA", detail: "high" } },
    ])).toEqual([
      { type: "input_text", text: "Descrição do processo" },
      { type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "high" },
    ]);
    expect(() => validarArquivo([])).toThrow();
    expect(() => validarArquivo([{ type: "image_url", image_url: { url: "https://exemplo.com/a.png" } }])).toThrow();
    expect(() => validarArquivo([{ type: "file", data: "x" }])).toThrow();
  });
});

const diagnosticoValido = {
  resumo: "Processo manual e dependente do gerente.",
  pontosFortes: ["Gatilho claro"],
  achados: [
    { prioridade: "critico", descricao: "Aprovação sem substituto", impacto: "Fila parada nas férias", causaProvavel: "Centralização", fundamento: "Lean — Espera" },
    { prioridade: "invalida", descricao: "descartado", impacto: "", causaProvavel: "", fundamento: "" },
  ],
  desperdiciosLean: [{ tipo: "Espera", evidencia: "Pedidos aguardam o gerente" }, { tipo: "Inexistente", evidencia: "x" }],
  riscosIso: [{ risco: "Indicador sem meta", evidencia: "Não há meta de prazo" }],
  maturidade: { nivel: "Inicial", justificativa: "Informal" },
  lacunas: ["Volume mensal"],
};

const planoValido = {
  resumoToBe: "Aprovação com alçada e substituto.",
  melhorias: [{ titulo: "Definir alçada", problema: "Aprovação centralizada", solucao: "Alçada por valor", beneficio: "Menos espera", prioridade: "Alta" }],
  planoAcao: [{ oque: "Publicar política de alçada", porque: "Reduzir espera", quem: "Gerente financeiro", quando: "30 dias", onde: "Financeiro", como: "Reunião e documento", custo: "Baixo" }],
};

// Etapa 5 com as perguntas respondidas: o próximo passo é a análise.
function ateDiagnostico(): EstadoRoteiro {
  let estado = confirmarEtapa(roteiro, ateConfirmacao(4));
  while (proximoPasso(roteiro, estado).tipo === "pergunta") {
    estado = aplicarAvaliacao(roteiro, estado, avaliacao()).estado;
  }
  return estado;
}

describe("Peter no roteiro — análises", () => {
  it("gera o diagnóstico, guarda no estado e pede a validação", () => {
    const estado = ateDiagnostico();
    expect(JSON.stringify(schemaAnalise(roteiro, estado))).toContain("Superprodução");
    const prompt = promptAnalise(persona, roteiro, estado);
    expect(prompt).toContain("ETAPA 5: DIAGNÓSTICO AS IS");
    expect(prompt).toContain("- Dificuldades e gargalos: resposta");

    const turno = aplicarAnalise(roteiro, estado, diagnosticoValido);
    expect(turno.analise).toBe("diagnostico_as_is");
    expect(turno.passo.tipo).toBe("confirmar_etapa");
    expect(turno.mensagem).toBe("Esse diagnóstico reflete a realidade do processo? O que você corrigiria ou acrescentaria?");
    const salvo = turno.estado.analises.diagnostico_as_is as typeof diagnosticoValido;
    expect(salvo.achados).toHaveLength(1);
    expect(salvo.desperdiciosLean).toEqual([{ tipo: "Espera", evidencia: "Pedidos aguardam o gerente" }]);
  });

  it("recusa análise incompleta sem avançar", () => {
    expect(() => aplicarAnalise(roteiro, ateDiagnostico(), { resumo: "", maturidade: { nivel: "Lendário" } })).toThrow(/incompleta/);
  });

  it("refaz o diagnóstico com o ajuste pedido pelo entrevistado", () => {
    const comDiagnostico = aplicarAnalise(roteiro, ateDiagnostico(), diagnosticoValido).estado;
    const turno = aplicarConfirmacao(roteiro, comDiagnostico, {
      confirmou: false,
      pedeAjuste: true,
      comentario: "Vou ajustar o diagnóstico.",
      correcoes: [],
      campos: {},
    }, "O gerente tem substituto, sim: o coordenador.");
    expect(turno.passo.tipo).toBe("acao_ia");
    expect(turno.estado.observacoes[5]).toEqual(["O gerente tem substituto, sim: o coordenador."]);
    const prompt = promptAnalise(persona, roteiro, turno.estado);
    expect(prompt).toContain("O gerente tem substituto, sim: o coordenador.");
    expect(prompt).toContain("Aprovação sem substituto");
  });

  it("responde a uma dúvida sem refazer a análise", () => {
    const comDiagnostico = aplicarAnalise(roteiro, ateDiagnostico(), diagnosticoValido).estado;
    const turno = aplicarConfirmacao(roteiro, comDiagnostico, {
      confirmou: false,
      pedeAjuste: false,
      comentario: "Espera é quando o trabalho fica parado aguardando algo.",
      correcoes: [],
      campos: {},
    }, "O que é desperdício de espera?");
    expect(turno.passo.tipo).toBe("confirmar_etapa");
    expect(turno.estado.acoesConcluidas).toContain("diagnostico_as_is");
    expect(turno.mensagem).toMatch(/^Espera é quando/);
  });

  it("gera o plano com base no diagnóstico e preenche o 5W2H do processo", () => {
    let estado = aplicarAnalise(roteiro, ateDiagnostico(), diagnosticoValido).estado;
    estado = confirmarEtapa(roteiro, estado);
    while (proximoPasso(roteiro, estado).tipo === "pergunta") {
      estado = aplicarAvaliacao(roteiro, estado, avaliacao()).estado;
    }
    expect(promptAnalise(persona, roteiro, estado)).toContain("Aprovação sem substituto");

    const turno = aplicarAnalise(roteiro, estado, planoValido);
    expect(turno.analise).toBe("plano_melhoria");
    expect(turno.campos.planoAcao).toEqual(planoValido.planoAcao);
    expect(turno.campos.oportunidadesMelhoria).toBe("• Definir alçada (Alta): Alçada por valor");

    const fim = aplicarConfirmacao(roteiro, turno.estado, { confirmou: true, pedeAjuste: false, comentario: "", correcoes: [], campos: {} }, "Aprovado");
    expect(fim.passo.tipo).toBe("concluido");
  });

  it("mantém observações e análises válidas ao receber o estado do cliente", () => {
    const comDiagnostico = aplicarAnalise(roteiro, ateDiagnostico(), diagnosticoValido).estado;
    const vindoDoCliente = JSON.parse(JSON.stringify({
      ...comDiagnostico,
      observacoes: { 5: ["ajuste"], 2: ["etapa sem análise"] },
      analises: { ...comDiagnostico.analises, plano_melhoria: { resumoToBe: "" } },
    }));
    const estado = sanitizarEstado(roteiro, vindoDoCliente);
    expect(estado.observacoes).toEqual({ 5: ["ajuste"] });
    expect(Object.keys(estado.analises)).toEqual(["diagnostico_as_is"]);
  });
});
