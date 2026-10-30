import { describe, expect, it } from "vitest";
import { emptyProcessoForm } from "@/data/processo-form-types";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import {
  MAX_APROFUNDAMENTOS,
  aplicarRespostasExtraidas,
  concluirAcao,
  confirmarEtapa,
  etapasConfirmadasAte,
  iniciarRoteiro,
  iniciarRoteiroDoProcesso,
  listarLacunas,
  progresso,
  proximoPasso,
  registrarResposta,
  type EstadoRoteiro,
} from "../../supabase/functions/_shared/roteiro-engine";

const roteiro = ROTEIRO_PADRAO;

function responderAtual(estado: EstadoRoteiro, overrides: { texto?: string; valor?: string; suficiente?: boolean; encerraRepeticao?: boolean } = {}) {
  const passo = proximoPasso(roteiro, estado);
  if (passo.tipo !== "pergunta") throw new Error(`esperava pergunta, veio ${passo.tipo}`);
  return registrarResposta(roteiro, estado, {
    perguntaId: passo.pergunta.id,
    texto: overrides.texto ?? `resposta para ${passo.pergunta.id}`,
    valor: overrides.valor ?? (passo.pergunta.tipo === "sim_nao" ? "sim" : undefined),
    suficiente: overrides.suficiente ?? true,
    encerraRepeticao: overrides.encerraRepeticao ?? true,
  });
}

function avancarAteConcluir(estado: EstadoRoteiro, limite = 200) {
  const perguntas: string[] = [];
  for (let i = 0; i < limite; i++) {
    const passo = proximoPasso(roteiro, estado);
    if (passo.tipo === "concluido") return { estado, perguntas };
    if (passo.tipo === "pergunta") {
      perguntas.push(passo.pergunta.id);
      estado = responderAtual(estado);
    } else if (passo.tipo === "acao_ia") {
      estado = concluirAcao(roteiro, estado, passo.acao);
    } else {
      estado = confirmarEtapa(roteiro, estado);
    }
  }
  throw new Error("roteiro não terminou");
}

describe("Roteiro da entrevista — estrutura", () => {
  it("tem as 6 etapas da metodologia, em ordem", () => {
    expect(roteiro.etapas.map((etapa) => etapa.numero)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("usa ids de pergunta únicos", () => {
    const ids = roteiro.etapas.flatMap((etapa) => etapa.perguntas.map((pergunta) => pergunta.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("só aponta para campos que existem no formulário do processo", () => {
    const camposValidos = Object.keys(emptyProcessoForm);
    for (const etapa of roteiro.etapas) {
      for (const pergunta of etapa.perguntas) {
        for (const campo of pergunta.campos) expect(camposValidos).toContain(campo);
      }
    }
  });

  it("condiciona perguntas apenas a perguntas anteriores da mesma etapa", () => {
    for (const etapa of roteiro.etapas) {
      etapa.perguntas.forEach((pergunta, indice) => {
        if (!pergunta.condicao) return;
        const anteriores = etapa.perguntas.slice(0, indice).map((item) => item.id);
        expect(anteriores).toContain(pergunta.condicao.perguntaId);
      });
    }
  });

  it("define opções para perguntas de múltipla escolha", () => {
    for (const pergunta of roteiro.etapas.flatMap((etapa) => etapa.perguntas)) {
      if (pergunta.tipo === "opcao") expect(pergunta.opcoes?.length).toBeGreaterThan(1);
    }
  });
});

describe("Roteiro da entrevista — motor", () => {
  it("começa pela primeira pergunta da Etapa 1", () => {
    const estado = iniciarRoteiro(roteiro);
    const passo = proximoPasso(roteiro, estado);
    expect(passo.tipo).toBe("pergunta");
    expect(passo.tipo === "pergunta" && passo.pergunta.id).toBe("e1.entrevistado");
    expect(progresso(roteiro, estado).rotulo).toBe("Etapa 1 de 6 — Sobre o processo");
  });

  it("percorre as 6 etapas, executando as análises da IA antes de confirmar as etapas 5 e 6", () => {
    let estado = iniciarRoteiro(roteiro);
    const passos: string[] = [];
    for (let i = 0; i < 200; i++) {
      const passo = proximoPasso(roteiro, estado);
      if (passo.tipo === "concluido") break;
      if (passo.tipo === "pergunta") {
        estado = responderAtual(estado);
      } else if (passo.tipo === "acao_ia") {
        passos.push(`${passo.etapa.numero}:${passo.acao}`);
        estado = concluirAcao(roteiro, estado, passo.acao);
      } else {
        passos.push(`${passo.etapa.numero}:confirmar`);
        estado = confirmarEtapa(roteiro, estado);
      }
    }
    expect(passos).toEqual([
      "1:confirmar",
      "2:confirmar",
      "3:confirmar",
      "4:confirmar",
      "5:diagnostico_as_is",
      "5:confirmar",
      "6:plano_melhoria",
      "6:confirmar",
    ]);
    expect(estado.etapasConfirmadas).toEqual([1, 2, 3, 4, 5, 6]);
    expect(progresso(roteiro, estado).rotulo).toBe("Entrevista concluída");
  });

  it("pula as perguntas sobre aprovação quando não há aprovação", () => {
    let estado = iniciarRoteiro(roteiro);
    for (let i = 0; i < 200; i++) {
      const passo = proximoPasso(roteiro, estado);
      if (passo.tipo === "concluido") break;
      if (passo.tipo === "pergunta") {
        estado = responderAtual(estado, { valor: passo.pergunta.id === "e3.aprovacoes" ? "Não" : undefined });
      } else if (passo.tipo === "acao_ia") {
        estado = concluirAcao(roteiro, estado, passo.acao);
      } else {
        estado = confirmarEtapa(roteiro, estado);
      }
    }
    expect(estado.respostas["e3.aprovador"]).toBeUndefined();
    expect(estado.respostas["e3.aprovacao_negada"]).toBeUndefined();
  });

  it("faz as perguntas sobre o aprovador quando a resposta sobre decisões registra uma aprovação", () => {
    let estado = iniciarRoteiro(roteiro);
    for (let passo = proximoPasso(roteiro, estado); !(passo.tipo === "pergunta" && passo.pergunta.id === "e3.decisoes"); passo = proximoPasso(roteiro, estado)) {
      estado = passo.tipo === "pergunta" ? responderAtual(estado) : confirmarEtapa(roteiro, estado);
    }
    estado = responderAtual(estado, { texto: "Sim, acima de 10 mil o gerente aprova" });
    // O Peter registra a aprovação citada na resposta (outrasRespostas).
    estado = aplicarRespostasExtraidas(roteiro, estado, [{ perguntaId: "e3.aprovacoes", texto: "Gerente aprova acima de 10 mil", valor: "sim" }], "entrevista", { encerrarRepeticao: false });
    const passo = proximoPasso(roteiro, estado);
    expect(passo.tipo === "pergunta" && passo.pergunta.id).toBe("e3.aprovador");
  });

  it("não faz as perguntas que só são registradas a partir de outras respostas", () => {
    const { perguntas } = avancarAteConcluir(iniciarRoteiro(roteiro));
    const somenteRegistro = roteiro.etapas.flatMap((etapa) => etapa.perguntas).filter((pergunta) => pergunta.somenteRegistro).map((pergunta) => pergunta.id);
    expect(somenteRegistro).toEqual(expect.arrayContaining(["e1.dono", "e2.fornecedores", "e2.cliente", "e3.aprovacoes", "e4.volume", "e6.gestor_mudanca"]));
    for (const id of somenteRegistro) expect(perguntas).not.toContain(id);
    // Sem aprovação registrada, as condicionais também não aparecem.
    expect(perguntas).toHaveLength(20);
  });

  it("não pergunta o nome quando o processo já tem nome", () => {
    const estado = iniciarRoteiroDoProcesso(roteiro, " COOPERA - Pós vendas ");
    expect(estado.respostas["e1.nome"]).toMatchObject({ textos: ["COOPERA - Pós vendas"], status: "respondida" });
    const { perguntas } = avancarAteConcluir(estado);
    expect(perguntas).not.toContain("e1.nome");
    expect(iniciarRoteiroDoProcesso(roteiro, "  ").respostas["e1.nome"]).toBeUndefined();
  });

  it("repete a pergunta de atividades até o entrevistado encerrar o fluxo", () => {
    let estado = iniciarRoteiro(roteiro);
    for (let atual = proximoPasso(roteiro, estado); !(atual.tipo === "pergunta" && atual.pergunta.id === "e3.atividades"); atual = proximoPasso(roteiro, estado)) {
      estado = atual.tipo === "pergunta" ? responderAtual(estado) : confirmarEtapa(roteiro, estado);
    }

    estado = responderAtual(estado, { texto: "Receber pedido — Comercial", encerraRepeticao: false });
    let passo = proximoPasso(roteiro, estado);
    expect(passo.tipo === "pergunta" && passo.pergunta.id).toBe("e3.atividades");
    expect(passo.tipo === "pergunta" && passo.iteracao).toBe(1);
    expect(passo.tipo === "pergunta" && passo.texto).toContain("O que acontece depois disso");

    estado = responderAtual(estado, { texto: "Aprovar pedido — Gerente", encerraRepeticao: false });
    estado = responderAtual(estado, { texto: "", encerraRepeticao: true });

    passo = proximoPasso(roteiro, estado);
    expect(passo.tipo === "pergunta" && passo.pergunta.id).toBe("e3.sistemas");
    expect(estado.respostas["e3.atividades"].textos).toEqual(["Receber pedido — Comercial", "Aprovar pedido — Gerente"]);
  });

  it("registra o passo a passo contado de uma vez, uma atividade por linha", () => {
    let estado = iniciarRoteiro(roteiro);
    for (let atual = proximoPasso(roteiro, estado); !(atual.tipo === "pergunta" && atual.pergunta.id === "e3.atividades"); atual = proximoPasso(roteiro, estado)) {
      estado = atual.tipo === "pergunta" ? responderAtual(estado) : confirmarEtapa(roteiro, estado);
    }
    estado = responderAtual(estado, { texto: "Receber pedido — Comercial\n Separar material — Almoxarifado \nEmitir NF — Faturamento", encerraRepeticao: true });
    expect(estado.respostas["e3.atividades"].textos).toEqual(["Receber pedido — Comercial", "Separar material — Almoxarifado", "Emitir NF — Faturamento"]);
    const passo = proximoPasso(roteiro, estado);
    expect(passo.tipo === "pergunta" && passo.pergunta.id).toBe("e3.sistemas");
  });

  it(`registra lacuna depois de ${MAX_APROFUNDAMENTOS} respostas insuficientes e segue em frente`, () => {
    let estado = iniciarRoteiro(roteiro);
    estado = responderAtual(estado, { suficiente: false, texto: "sei lá" });
    let passo = proximoPasso(roteiro, estado);
    expect(passo.tipo === "pergunta" && passo.pergunta.id).toBe("e1.entrevistado");
    expect(passo.tipo === "pergunta" && passo.aprofundamentos).toBe(1);

    estado = responderAtual(estado, { suficiente: false, texto: "não quero dizer" });
    passo = proximoPasso(roteiro, estado);
    expect(passo.tipo === "pergunta" && passo.pergunta.id).toBe("e1.nome");
    expect(estado.respostas["e1.entrevistado"].status).toBe("lacuna");

    while (estado.etapaAtual === 1) {
      const atual = proximoPasso(roteiro, estado);
      estado = atual.tipo === "pergunta" ? responderAtual(estado) : confirmarEtapa(roteiro, estado);
    }
    expect(listarLacunas(roteiro, estado).map((pergunta) => pergunta.id)).toEqual(["e1.entrevistado"]);
  });

  it("recusa resposta para uma pergunta que não é a atual", () => {
    const estado = iniciarRoteiro(roteiro);
    expect(() => registrarResposta(roteiro, estado, { perguntaId: "e2.gatilho", texto: "x", suficiente: true })).toThrow();
  });

  it("não confirma etapa com perguntas pendentes", () => {
    expect(() => confirmarEtapa(roteiro, iniciarRoteiro(roteiro))).toThrow();
  });

  it("usa respostas extraídas de texto livre e pergunta só o que faltou", () => {
    let estado = aplicarRespostasExtraidas(
      roteiro,
      iniciarRoteiro(roteiro),
      [
        { perguntaId: "e1.entrevistado", texto: "Ana, analista financeira" },
        { perguntaId: "e1.nome", texto: "Contas a pagar" },
        { perguntaId: "inexistente", texto: "ignorado" },
      ],
      "texto_livre",
    );
    const passo = proximoPasso(roteiro, estado);
    expect(passo.tipo === "pergunta" && passo.pergunta.id).toBe("e1.area");
    expect(estado.respostas["e1.nome"].origem).toBe("texto_livre");
    expect(estado.respostas.inexistente).toBeUndefined();

    estado = aplicarRespostasExtraidas(roteiro, estado, [{ perguntaId: "e1.nome", texto: "outro" }], "anexo");
    expect(estado.respostas["e1.nome"].textos).toEqual(["Contas a pagar"]);
  });

  it("libera o mapa AS IS só com as etapas 1 a 3 confirmadas", () => {
    let estado = iniciarRoteiro(roteiro);
    while (estado.etapaAtual <= 3) {
      expect(etapasConfirmadasAte(estado, 3)).toBe(false);
      const passo = proximoPasso(roteiro, estado);
      estado = passo.tipo === "pergunta" ? responderAtual(estado) : confirmarEtapa(roteiro, estado);
    }
    expect(etapasConfirmadasAte(estado, 3)).toBe(true);
  });
});
