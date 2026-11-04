import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import {
  confirmarEtapa,
  iniciarRoteiro,
  proximoPasso,
  registrarResposta,
  type EstadoRoteiro,
} from "../../supabase/functions/_shared/roteiro-engine";
import { aplicarAnalise, aplicarAvaliacao, aplicarConfirmacao, aplicarExtracao, sanitizarEstado } from "../../supabase/functions/_shared/roteiro-peter";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  linhaSalva: null as Record<string, unknown> | null,
  // Outros processos da empresa, usados na conferência de nome repetido.
  outros: [] as Record<string, unknown>[],
  excluidos: [] as string[],
  criarAcompanhamento: vi.fn(),
}));

vi.mock("@/lib/acompanhamento", () => ({ criarAcompanhamento: mocks.criarAcompanhamento }));

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
vi.mock("@/integrations/supabase/client", () => {
  const select = () => ({
    eq: () => ({
      single: async () => ({ data: mocks.linhaSalva, error: mocks.linhaSalva ? null : { message: "não encontrado" } }),
      order: async () => ({ data: mocks.outros, error: null }),
    }),
  });
  const processos = {
    select,
    insert: (payload: Record<string, unknown>) => {
      mocks.inserts.push(payload);
      return { select: () => ({ single: async () => ({ data: { id: "proc-1" }, error: null }) }) };
    },
    update: (payload: Record<string, unknown>) => {
      mocks.updates.push(payload);
      const filtro = { eq: () => filtro, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
      return filtro;
    },
    delete: () => {
      const filtro = {
        eq: (coluna: string, valor: string) => {
          if (coluna === "id") mocks.excluidos.push(valor);
          return filtro;
        },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      };
      return filtro;
    },
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
      from: () => processos,
      functions: { invoke: mocks.invoke },
    },
  };
});

import EntrevistaProcesso from "@/pages/EntrevistaProcesso";

const roteiro = ROTEIRO_PADRAO;

// Servidor simulado: a mesma lógica da edge function, com o Peter trocado por respostas fixas.
function servidor(analise?: unknown) {
  return async (_nome: string, { body }: { body: Record<string, unknown> }) => {
    const estado = sanitizarEstado(roteiro, body.estado);
    if (body.operacao === "analisar") return { data: aplicarAnalise(roteiro, estado, analise), error: null };
    if (body.operacao === "extrair") {
      return {
        data: aplicarExtracao(roteiro, estado, {
          respostas: [{ perguntaId: "e1.nome", texto: "Compras", valor: null }, { perguntaId: "e1.area", texto: "Suprimentos", valor: null }],
          comentario: "Anotei o processo e a área.",
          alerta: null,
          oportunidade: null,
          campos: { nomeProcesso: "Compras", area: "Suprimentos" },
        }, "texto_livre"),
        error: null,
      };
    }
    const passo = proximoPasso(roteiro, estado);
    if (passo.tipo === "confirmar_etapa") {
      return { data: aplicarConfirmacao(roteiro, estado, { confirmou: true, pedeAjuste: false, comentario: "Plano aprovado.", correcoes: [], campos: {} }, String(body.resposta)), error: null };
    }
    if (passo.tipo !== "pergunta") throw new Error(`passo inesperado: ${passo.tipo}`);
    const resposta = String(body.resposta);
    return {
      data: aplicarAvaliacao(roteiro, estado, {
        suficiente: true,
        texto: resposta,
        valor: passo.pergunta.tipo === "opcao" ? resposta : null,
        encerraRepeticao: true,
        comentario: "Anotado.",
        aprofundamento: "",
        alerta: null,
        oportunidade: null,
        campos: passo.pergunta.id === "e1.entrevistado"
          ? { entrevistados: resposta }
          : passo.pergunta.id === "e1.nome" ? { nomeProcesso: resposta } : {},
      }),
      error: null,
    };
  };
}

function renderizar(caminho = "/processos/novo/entrevista") {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Routes>
        <Route path="/processos/novo/entrevista" element={<EntrevistaProcesso />} />
        <Route path="/processos/:id/entrevista" element={<EntrevistaProcesso />} />
        <Route path="/processos/:id" element={<div>Detalhe do processo</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function responder(texto: string) {
  fireEvent.change(screen.getByPlaceholderText("Digite sua resposta…"), { target: { value: texto } });
  fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
}

describe("Entrevista guiada — tela", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    mocks.invoke.mockReset();
    mocks.inserts.length = 0;
    mocks.updates.length = 0;
    mocks.linhaSalva = null;
    mocks.outros = [];
    mocks.excluidos.length = 0;
    mocks.criarAcompanhamento.mockReset();
  });

  it("ao aprovar o plano, cria os indicadores sugeridos e as ações nos módulos", async () => {
    const diagnostico = {
      resumo: "Processo informal.", pontosFortes: [], desperdiciosLean: [], riscosIso: [], lacunas: [],
      achados: [{ prioridade: "critico", descricao: "Cotação lenta", impacto: "Atrasos", causaProvavel: "E-mail", fundamento: "Lean — Espera" }],
      maturidade: { nivel: "Inicial", justificativa: "Sem padrão" },
    };
    const plano = {
      resumoToBe: "Cotação no ERP.",
      melhorias: [{ titulo: "Cotação no ERP", problema: "Cotação lenta", solucao: "ERP", beneficio: "Prazo", prioridade: "Alta" }],
      planoAcao: [{ oque: "Configurar cotação no ERP", porque: "Prazo", quem: "[a definir]", quando: "[a definir]", onde: "", como: "", custo: "" }],
      indicadores: [{ nome: "Tempo de cotação", formula: "dias entre requisição e cotação", sentido: "menor", meta: "≤ 2 dias", periodicidade: "Mensal", responsavel: "Comprador", motivo: "Cotação lenta" }],
    };
    let estado: EstadoRoteiro = iniciarRoteiro(roteiro);
    for (let i = 0; i < 300; i++) {
      const passo = proximoPasso(roteiro, estado);
      if (passo.tipo === "pergunta") estado = registrarResposta(roteiro, estado, { perguntaId: passo.pergunta.id, texto: "ok", suficiente: true, valor: "nao", encerraRepeticao: true });
      else if (passo.tipo === "acao_ia") estado = aplicarAnalise(roteiro, estado, passo.acao === "diagnostico_as_is" ? diagnostico : plano).estado;
      else if (passo.tipo === "confirmar_etapa" && estado.etapaAtual < 6) estado = confirmarEtapa(roteiro, estado);
      else break;
    }
    expect(proximoPasso(roteiro, estado)).toMatchObject({ tipo: "confirmar_etapa", etapa: { numero: 6 } });
    mocks.linhaSalva = {
      id: "proc-1", company_id: "empresa-1", status: "Diagnosticado", nome: "Compras", entrevista_roteiro: estado,
      interview_messages: [
        { role: "assistant", tipo: "analise", acao: "plano_melhoria", content: JSON.stringify(estado.analises.plano_melhoria) },
        { role: "assistant", content: "Esse plano está bom?" },
      ],
      data_mapeamento: "2026-11-04", indicadores: [], etapas: [], entradas: [], saidas: [],
    };
    mocks.invoke.mockImplementation(servidor());
    mocks.criarAcompanhamento.mockResolvedValue({ indicadores: 1, acoes: 1 });

    renderizar("/processos/proc-1/entrevista");
    expect(await screen.findByText("Indicadores sugeridos pelo Peter")).toBeInTheDocument();
    expect(screen.getByText("Tempo de cotação")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Está correto" }));

    await waitFor(() => expect(mocks.criarAcompanhamento).toHaveBeenCalledTimes(1));
    const [processo, usuario] = mocks.criarAcompanhamento.mock.calls[0];
    expect(usuario).toBe("user-1");
    expect(processo).toMatchObject({ id: "proc-1", company_id: "empresa-1", status: "Melhorias aprovadas" });
    expect(await screen.findByText("✓ 1 indicador criado em Indicadores e 1 ação criada no Plano de Ação.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver relatório e mapa AS IS/ })).toBeInTheDocument();
  });

  async function chegarAoNomeRepetido() {
    mocks.invoke.mockImplementation(servidor());
    mocks.outros = [{ id: "proc-9", nome: "COMPRAS", status: "Implementado", created_at: "2026-10-29T12:00:00Z" }];
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Entrevista guiada" }));
    responder("Ana, compradora");
    await screen.findByText(/Qual é o nome do processo que vamos mapear\?/);
    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    await waitFor(() => expect(screen.getByPlaceholderText("Digite sua resposta…")).not.toBeDisabled());
    responder("Compras");
    expect(await screen.findByText(/Já existe um processo com esse nome/)).toHaveTextContent("COMPRAS (Implementado, criado em 29/10/2026)");
  }

  it("não salva um nome que outro processo da empresa já usa e pergunta se é o mesmo processo", async () => {
    await chegarAoNomeRepetido();
    expect(mocks.updates).toHaveLength(1);
    expect(screen.queryByPlaceholderText("Digite sua resposta…")).not.toBeInTheDocument();
    expect(screen.getByText("Nome repetido")).toBeInTheDocument();
  });

  it("muda o nome quando é outro processo e volta a salvar", async () => {
    await chegarAoNomeRepetido();
    fireEvent.click(screen.getByRole("button", { name: "É outro processo, vou mudar o nome" }));
    const campo = screen.getByRole("textbox", { name: "Novo nome do processo" });
    expect(campo).toHaveValue("Compras");

    fireEvent.change(campo, { target: { value: "compras " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(await screen.findByText(/Esse nome ainda é igual ao do processo existente/)).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: "Compras de serviços" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(await screen.findByText(/Combinado: este processo vai se chamar "Compras de serviços"/)).toBeInTheDocument();
    await waitFor(() => expect(mocks.updates).toHaveLength(2));
    expect(mocks.updates[1].nome).toBe("Compras de serviços");
    expect(mocks.updates[1].entrevista_roteiro).toMatchObject({ respostas: { "e1.nome": { textos: ["Compras de serviços"] } } });
    expect(screen.queryByText(/Já existe um processo com esse nome/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Digite sua resposta…")).toBeInTheDocument();
  });

  it("abre o processo existente e descarta a entrevista nova", async () => {
    await chegarAoNomeRepetido();
    fireEvent.click(screen.getByRole("button", { name: "Abrir o existente" }));
    expect(await screen.findByText("Detalhe do processo")).toBeInTheDocument();
    expect(mocks.excluidos).toEqual(["proc-1"]);
  });

  it("começa pela primeira pergunta, salva o processo e avança a cada resposta", async () => {
    mocks.invoke.mockImplementation(servidor());
    renderizar();

    fireEvent.click(await screen.findByRole("button", { name: "Entrevista guiada" }));
    expect(await screen.findByText(/Para começar, qual é o seu nome e o seu cargo\?/)).toBeInTheDocument();
    // Na barra de progresso e no cabeçalho da etapa, dentro da conversa.
    expect(screen.getAllByText("Etapa 1 de 6 — Sobre o processo")).toHaveLength(2);
    await waitFor(() => expect(mocks.inserts).toHaveLength(1));
    expect(mocks.inserts[0].entrevista_roteiro).toMatchObject({ etapaAtual: 1 });
    expect(mocks.inserts[0].status).toBe("Em entrevista");

    responder("Ana, analista financeira");
    expect(await screen.findByText(/Qual é o nome do processo que vamos mapear\?/)).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith("ai-interview-roteiro", expect.objectContaining({
      body: expect.objectContaining({ operacao: "responder", resposta: "Ana, analista financeira", company_id: "empresa-1" }),
    }));
    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0].entrevistados).toBe("Ana, analista financeira");
  });

  it("oferece as opções da pergunta como botões", async () => {
    mocks.invoke.mockImplementation(servidor());
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Entrevista guiada" }));
    for (const texto of ["Ana", "Compras", "Suprimentos, gerente de compras", "Comprar no prazo"]) {
      await screen.findByPlaceholderText("Digite sua resposta…");
      await waitFor(() => expect(screen.getByPlaceholderText("Digite sua resposta…")).not.toBeDisabled());
      responder(texto);
    }
    expect(await screen.findByRole("button", { name: "Negócio" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apoio" }));
    // A frequência é respondida com as palavras do entrevistado, sem botões.
    expect(await screen.findByText(/Com que frequência esse processo acontece\?/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sob demanda" })).not.toBeInTheDocument();
  });

  it("aceita um texto livre no meio da entrevista e segue só com o que faltou", async () => {
    mocks.invoke.mockImplementation(servidor());
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Entrevista guiada" }));
    responder("Ana, compradora");
    await screen.findByText(/Qual é o nome do processo que vamos mapear\?/);
    await waitFor(() => expect(screen.getByRole("button", { name: "Colar um texto" })).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: "Colar um texto" }));
    expect(screen.getByText(/Pode contar com suas palavras como a rotina funciona/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText(/Pode contar com suas palavras/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Colar um texto" }));
    fireEvent.change(screen.getByPlaceholderText("Cole aqui a descrição do processo…"), { target: { value: "No setor de Suprimentos, o processo de Compras começa com a requisição." } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar texto/ }));

    expect(await screen.findByText(/Anotei o processo e a área\./)).toBeInTheDocument();
    expect(screen.getByText(/Para que serve esse processo\?/)).toBeInTheDocument();
    const chamada = mocks.invoke.mock.calls.at(-1)![1].body;
    expect(chamada).toMatchObject({ operacao: "extrair", origem: "texto_livre" });
    expect(chamada.estado.respostas["e1.entrevistado"]).toBeDefined();
    expect(screen.getByPlaceholderText("Digite sua resposta…")).toBeInTheDocument();
  });

  it("guarda o .bpmn anexado como mapa AS IS do processo", async () => {
    mocks.invoke.mockImplementation(servidor());
    const { container } = renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Entrevista guiada" }));
    await screen.findByText(/Para começar, qual é o seu nome e o seu cargo\?/);
    await waitFor(() => expect(mocks.inserts).toHaveLength(1));

    const xml = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI">
      <process id="p"><startEvent id="s" name="Pedido" /><task id="t" name="Registrar pedido" /><sequenceFlow id="f" sourceRef="s" targetRef="t" /></process>
      <bpmndi:BPMNDiagram id="d"><bpmndi:BPMNPlane id="pl" bpmnElement="p"><bpmndi:BPMNShape id="sh" bpmnElement="t" /></bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
    </definitions>`;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([xml], "compras.bpmn", { type: "" })] } });

    expect(await screen.findByText(/Anotei o processo e a área\./)).toBeInTheDocument();
    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0].bpmn_as_is).toBe(xml);
    expect(mocks.updates[0].interview_messages).toContainEqual({ role: "user", content: "📎 compras.bpmn (Diagrama BPMN)", mapaAnexado: true });
    expect(mocks.invoke.mock.calls.at(-1)![1].body).toMatchObject({ operacao: "extrair", origem: "anexo" });
  });

  it("mostra o erro, devolve o texto ao campo e não avança quando o servidor falha", async () => {
    mocks.invoke.mockResolvedValue({ data: { error: "Limite de IA excedido." }, error: null });
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Entrevista guiada" }));
    responder("Ana");
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite de IA excedido.");
    expect(screen.getByPlaceholderText("Digite sua resposta…")).toHaveValue("Ana");
    expect(screen.queryByText("Ana", { selector: "div.whitespace-pre-wrap" })).not.toBeInTheDocument();
  });

  it("retoma um rascunho e gera o diagnóstico sozinho quando ele é o próximo passo", async () => {
    let estado: EstadoRoteiro = iniciarRoteiro(roteiro);
    for (let i = 0; i < 200 && estado.etapaAtual <= 5; i++) {
      const passo = proximoPasso(roteiro, estado);
      if (passo.tipo === "acao_ia") break;
      estado = passo.tipo === "pergunta"
        ? registrarResposta(roteiro, estado, { perguntaId: passo.pergunta.id, texto: "ok", suficiente: true, valor: "nao", encerraRepeticao: true })
        : confirmarEtapa(roteiro, estado);
    }
    expect(proximoPasso(roteiro, estado).tipo).toBe("acao_ia");
    mocks.linhaSalva = {
      id: "proc-1", company_id: "empresa-1", status: "Rascunho", nome: "Compras", entrevista_roteiro: estado,
      interview_messages: [{ role: "assistant", content: "Vou montar o diagnóstico do processo." }],
      data_mapeamento: "2026-10-26", analista: "", classificacao: "Apoio", area: "", responsavel: "", entrevistados: "",
      objetivo: "", cliente_processo: "", areas_envolvidas: "", gatilho: "", entradas: [], etapas: [], decisoes: "", saidas: [],
      recursos: "", problemas: {}, problemas_texto: "", riscos_texto: "", riscos: [], indicadores: [], oportunidades_melhoria: "",
      plano_acao: [], bpmn_as_is: "", bpmn_to_be: "",
    };
    mocks.invoke.mockImplementation(servidor({
      resumo: "Processo informal.",
      pontosFortes: [],
      achados: [{ prioridade: "critico", descricao: "Aprovação sem substituto", impacto: "Atrasos", causaProvavel: "Centralização", fundamento: "Lean — Espera" }],
      desperdiciosLean: [],
      riscosIso: [],
      maturidade: { nivel: "Inicial", justificativa: "Sem padrão" },
      lacunas: [],
    }));

    renderizar("/processos/proc-1/entrevista");
    expect(await screen.findByText("Diagnóstico do processo (AS IS)")).toBeInTheDocument();
    expect(screen.getByText(/Aprovação sem substituto/)).toBeInTheDocument();
    expect(screen.getByText(/Esse diagnóstico reflete a realidade do processo\?/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Está correto" })).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke.mock.calls[0][1].body.operacao).toBe("analisar");
    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0].entrevista_roteiro).toMatchObject({ acoesConcluidas: ["diagnostico_as_is"] });
  });
});
