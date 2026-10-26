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
  aplicarAvaliacao,
  aplicarConfirmacao,
  aplicarExtracao,
  concluirAcaoTurno,
  filtrarCampos,
  iniciarTurno,
  promptAvaliacao,
  sanitizarEstado,
  sanitizarHistorico,
  schemaAvaliacao,
  schemaConfirmacao,
  schemaExtracao,
  validarArquivo,
} from "../../supabase/functions/_shared/roteiro-peter";

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
      for (const pergunta of etapa.perguntas) verificarStrict(schemaAvaliacao(pergunta));
    }
    verificarStrict(schemaExtracao(roteiro));
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
    const turno = aplicarConfirmacao(roteiro, ateConfirmacao(1), { confirmou: true, comentario: "Ótimo!", correcoes: [], campos: {} });
    expect(turno.estado.etapaAtual).toBe(2);
    expect(turno.mensagem).toContain("Etapa 2 de 6");
    expect(turno.passo.pergunta?.id).toBe("e2.gatilho");
  });

  it("aplica a correção e reapresenta o resumo atualizado em vez de avançar", () => {
    const turno = aplicarConfirmacao(roteiro, ateConfirmacao(1), {
      confirmou: true,
      comentario: "Ajustei a área.",
      correcoes: [{ perguntaId: "e1.area", texto: "Financeiro", valor: null }],
      campos: { area: "Financeiro" },
    });
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
      comentario: "Entendi, existe aprovação.",
      correcoes: [{ perguntaId: "e3.aprovacoes", texto: "Sim, o pedido é aprovado pelo gerente", valor: "sim" }],
      campos: {},
    });
    expect(turno.passo.pergunta?.id).toBe("e3.aprovador");
  });

  it("conclui a análise da IA e passa para a confirmação da etapa", () => {
    let estado = ateConfirmacao(4);
    estado = confirmarEtapa(roteiro, estado);
    while (proximoPasso(roteiro, estado).tipo === "pergunta") {
      estado = aplicarAvaliacao(roteiro, estado, avaliacao()).estado;
    }
    expect(() => concluirAcaoTurno(roteiro, estado, "plano_melhoria")).toThrow();
    const turno = concluirAcaoTurno(roteiro, estado, "diagnostico_as_is");
    expect(turno.passo.tipo).toBe("confirmar_etapa");
    expect(turno.mensagem).toContain("Esse diagnóstico reflete a realidade");
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
    expect(turno.mensagem).toMatch(/^Identifiquei o gatilho/);
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
