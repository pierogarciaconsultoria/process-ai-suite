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
import { aplicarAnalise, aplicarAvaliacao, sanitizarEstado } from "../../supabase/functions/_shared/roteiro-peter";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  linhaSalva: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/active-company", () => ({ resolveAccessibleCompanyId: async () => "empresa-1" }));
vi.mock("@/integrations/supabase/client", () => {
  const select = () => ({
    eq: () => ({ single: async () => ({ data: mocks.linhaSalva, error: mocks.linhaSalva ? null : { message: "não encontrado" } }) }),
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
    const passo = proximoPasso(roteiro, estado);
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
        campos: passo.pergunta.id === "e1.entrevistado" ? { entrevistados: resposta } : {},
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
  });

  it("começa pela primeira pergunta, salva o processo e avança a cada resposta", async () => {
    mocks.invoke.mockImplementation(servidor());
    renderizar();

    fireEvent.click(await screen.findByRole("button", { name: "Entrevista guiada" }));
    expect(await screen.findByText(/Para começar, qual é o seu nome e o seu cargo\?/)).toBeInTheDocument();
    // Na barra de progresso e no cabeçalho da etapa, dentro da conversa.
    expect(screen.getAllByText("Etapa 1 de 6 — Identificação e contexto")).toHaveLength(2);
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
    for (const texto of ["Ana", "Compras", "Suprimentos", "Gerente de compras", "Comprar no prazo"]) {
      await screen.findByPlaceholderText("Digite sua resposta…");
      await waitFor(() => expect(screen.getByPlaceholderText("Digite sua resposta…")).not.toBeDisabled());
      responder(texto);
    }
    fireEvent.click(await screen.findByRole("button", { name: "Apoio" }));
    expect(await screen.findByText(/Com que frequência esse processo acontece\?/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sob demanda" })).toBeInTheDocument();
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
