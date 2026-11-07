import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { atributo, descendentesNs, lerXml, textoDe } from "../../supabase/functions/_shared/xml-simples";
import {
  GUIA_DE_FONTES,
  lerDocumentoGerado,
  MAX_MAPA_NO_DOCUMENTO,
  montarFontesDoProcedimento,
} from "../../supabase/functions/_shared/procedimento-fontes";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import {
  concluirAcao,
  confirmarEtapa,
  iniciarRoteiro,
  proximoPasso,
  registrarResposta,
  type EstadoRoteiro,
} from "../../supabase/functions/_shared/roteiro-engine";

const documentEdge = readFileSync(resolve(process.cwd(), "supabase/functions/ai-generate-document/index.ts"), "utf8");

const NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";

const MAPA = `<?xml version="1.0" encoding="UTF-8"?>
<!-- exportado do modelador -->
<bpmn:definitions xmlns:bpmn="${NS}" id="Defs">
  <bpmn:process id="Compras" name="Compras">
    <bpmn:laneSet>
      <bpmn:lane id="L1" name="Comprador"><bpmn:flowNodeRef>Inicio</bpmn:flowNodeRef><bpmn:flowNodeRef>Cotar</bpmn:flowNodeRef><bpmn:flowNodeRef>Valor</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="L2" name="Diretoria"><bpmn:flowNodeRef>Aprovar</bpmn:flowNodeRef><bpmn:flowNodeRef>Fim</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Inicio" name="Requisição recebida" />
    <bpmn:userTask id="Cotar" name="Cotar com 3 fornecedores" />
    <bpmn:exclusiveGateway id="Valor" name="Valor &gt; R$ 10 mil?" />
    <bpmn:userTask id="Aprovar" name="Aprovar compra" />
    <bpmn:endEvent id="Fim" name="Pedido emitido" />
    <bpmn:sequenceFlow id="F1" sourceRef="Inicio" targetRef="Cotar" />
    <bpmn:sequenceFlow id="F2" sourceRef="Cotar" targetRef="Valor" />
    <bpmn:sequenceFlow id="F3" name="Sim" sourceRef="Valor" targetRef="Aprovar" />
    <bpmn:sequenceFlow id="F4" name="Não" sourceRef="Valor" targetRef="Fim" />
    <bpmn:sequenceFlow id="F5" sourceRef="Aprovar" targetRef="Fim" />
  </bpmn:process>
</bpmn:definitions>`;

const diagnostico = {
  resumo: "Aprovação depende da diretoria.",
  pontosFortes: [],
  achados: [],
  desperdiciosLean: [],
  riscosIso: [{ risco: "Compra sem cotação registrada", evidencia: "Cotações por e-mail" }],
  maturidade: { nivel: "Estruturado", justificativa: "Etapas conhecidas" },
  lacunas: ["Volume mensal"],
};

const plano = {
  resumoToBe: "Alçada por valor.",
  melhorias: [{ titulo: "Alçada", problema: "", solucao: "Gerente aprova até 10 mil", beneficio: "", prioridade: "Alta" }],
  planoAcao: [{ oque: "Publicar alçada", porque: "", quem: "Diretor", quando: "30 dias", onde: "", como: "", custo: "" }],
  indicadores: [
    { nome: "Prazo médio de compra", formula: "dias entre requisição e pedido", sentido: "menor", meta: "[a definir]", periodicidade: "Mensal", responsavel: "Comprador", motivo: "Medir a agilidade" },
    { nome: "Compras com 3 cotações", formula: "compras com 3 cotações / total", sentido: "maior", meta: "95%", periodicidade: "Mensal", responsavel: "Comprador", motivo: "" },
  ],
};

const respostas: Record<string, string> = {
  "e1.requisitos": "ISO 9001 e política de compras PC-01",
  "e3.decisoes": "Acima de 10 mil vai para a diretoria",
  "e3.excecoes": "Fornecedor único: dispensa de cotação com justificativa",
  "e4.sla": "5 dias úteis",
};

function estadoCompleto(): EstadoRoteiro {
  let estado = iniciarRoteiro(ROTEIRO_PADRAO);
  for (let i = 0; i < 400; i++) {
    const passo = proximoPasso(ROTEIRO_PADRAO, estado);
    if (passo.tipo === "pergunta") {
      estado = registrarResposta(ROTEIRO_PADRAO, estado, {
        perguntaId: passo.pergunta.id,
        texto: respostas[passo.pergunta.id] ?? "ok",
        suficiente: true,
        valor: passo.pergunta.tipo === "sim_nao" ? "sim" : undefined,
        encerraRepeticao: true,
      });
    } else if (passo.tipo === "acao_ia") {
      estado = concluirAcao(ROTEIRO_PADRAO, estado, passo.acao, passo.acao === "diagnostico_as_is" ? diagnostico : plano);
    } else if (passo.tipo === "confirmar_etapa") {
      estado = confirmarEtapa(ROTEIRO_PADRAO, estado);
    } else {
      break;
    }
  }
  return estado;
}

const processo = {
  id: "proc-1", nome: "Compras", area: "Suprimentos", responsavel: "Gerente de compras", objetivo: "Comprar no prazo",
  classificacao: "Apoio", areas_envolvidas: "Financeiro", entrevistados: "Comprador", data_mapeamento: "2026-10-26",
  mapa_revisao: "Rev.02", status: "Melhorias aprovadas", gatilho: "Requisição de compra", cliente_processo: "Produção",
  entradas: [{ fornecedor: "Produção", entrada: "Requisição" }, { fornecedor: "", entrada: "" }],
  saidas: [{ saida: "Pedido de compra", cliente: "Fornecedor" }],
  etapas: [
    { ordem: 1, atividade: "Receber requisição", responsavel: "Comprador", ferramentaDocumento: "ERP" },
    { ordem: 2, atividade: "", responsavel: "", ferramentaDocumento: "" },
    { ordem: 3, atividade: "Cotar com 3 fornecedores", responsavel: "Comprador", ferramentaDocumento: "Planilha de cotação" },
  ],
  indicadores: [{ nome: "prazo médio de compra", objetivo: "", formulaCalculo: "", meta: "", periodicidade: "", responsavel: "" }],
  riscos: [{ risco: "Fornecedor sem homologação", consequencia: "Material fora de especificação", probabilidade: "Média", impacto: "Alto" }, { risco: "Hipótese", consequencia: "", probabilidade: "", impacto: "", _hipotese: true }],
  decisoes: "Diretoria aprova acima de 10 mil",
  recursos: "ERP, e-mail",
  problemas_texto: "",
  riscos_texto: "",
  bpmn_as_is: MAPA,
  entrevista_roteiro: estadoCompleto(),
};

describe("Leitor de XML", () => {
  it("lê namespaces, entidades, CDATA e ignora comentários e declarações", () => {
    const raiz = lerXml(`\uFEFF<?xml version="1.0"?><!DOCTYPE x><!-- c --><a xmlns="urn:a" xmlns:b="urn:b" t='x &gt; y &#233; &#xE9;'><b:c>1 &amp; 2<![CDATA[ <cru> ]]></b:c><d/></a>`);
    expect(raiz).toMatchObject({ localName: "a", namespaceURI: "urn:a" });
    expect(atributo(raiz, "t")).toBe("x > y é é");
    expect(raiz.filhos.map((filho) => [filho.localName, filho.namespaceURI])).toEqual([["c", "urn:b"], ["d", "urn:a"]]);
    expect(textoDe(raiz)).toBe("1 & 2 <cru> ");
    expect(descendentesNs(raiz, "urn:b", "c")).toHaveLength(1);
  });

  it("aceita '>' dentro de atributo", () => {
    expect(atributo(lerXml('<a cond="x > 1" />'), "cond")).toBe("x > 1");
  });

  it("recusa XML malformado", () => {
    for (const ruim of ["<a><b></a>", "<a>", "<a/><b/>", "<p:a/>", "<a x=1/>", "texto", "", "<a><!-- sem fim </a>"]) {
      expect(() => lerXml(ruim), ruim).toThrow();
    }
  });
});

describe("Fontes do procedimento", () => {
  it("leva as respostas da entrevista com o nome de cada pergunta, por etapa", () => {
    const fontes = montarFontesDoProcedimento({ processo });
    const todas = fontes.entrevista.flatMap((etapa) => etapa.respostas);
    expect(fontes.entrevista[0].etapa).toBe("1. Sobre o processo");
    expect(todas).toContainEqual({ pergunta: "Normas e exigências", resposta: "ISO 9001 e política de compras PC-01" });
    expect(todas).toContainEqual({ pergunta: "Decisões e aprovações", resposta: "Acima de 10 mil vai para a diretoria" });
    expect(todas).toContainEqual({ pergunta: "O que dá errado", resposta: "Fornecedor único: dispensa de cotação com justificativa" });
    expect(todas).toContainEqual({ pergunta: "Prazo para concluir", resposta: "5 dias úteis" });
  });

  it("converte o mapa AS IS em texto, com raias e caminhos das decisões, sem o XML", () => {
    const { mapaAsIs } = montarFontesDoProcedimento({ processo });
    expect(mapaAsIs).toContain("Responsáveis (raias): Comprador, Diretoria");
    expect(mapaAsIs).toContain('[Decisão] Valor > R$ 10 mil? — Comprador → "Sim": 4; "Não": 5');
    expect(mapaAsIs).not.toContain("<bpmn:");
    expect(montarFontesDoProcedimento({ processo: { ...processo, bpmn_as_is: "" } }).mapaAsIs).toBe("Não há mapa AS IS desenhado.");
    expect(montarFontesDoProcedimento({ processo: { ...processo, bpmn_as_is: "<quebrado" } }).mapaAsIs).toBe("O mapa AS IS existe, mas não pôde ser lido.");
  });

  it("limita o tamanho do mapa", () => {
    const tarefas = Array.from({ length: 400 }, (_, i) => `<bpmn:task id="T${i}" name="Atividade com um nome bem comprido número ${i}" />`).join("");
    const grande = `<bpmn:definitions xmlns:bpmn="${NS}"><bpmn:process id="P">${tarefas}</bpmn:process></bpmn:definitions>`;
    const { mapaAsIs } = montarFontesDoProcedimento({ processo: { ...processo, bpmn_as_is: grande } });
    expect(mapaAsIs.length).toBeLessThan(MAX_MAPA_NO_DOCUMENTO + 100);
    expect(mapaAsIs).toMatch(/\[mapa resumido: o restante foi omitido\]$/);
  });

  it("junta atividades, SIPOC, diagnóstico e riscos, sem linhas vazias nem hipóteses", () => {
    const fontes = montarFontesDoProcedimento({ processo });
    expect(fontes.atividades).toEqual([
      { ordem: 1, atividade: "Receber requisição", responsavel: "Comprador", ferramentaOuDocumento: "ERP" },
      { ordem: 2, atividade: "Cotar com 3 fornecedores", responsavel: "Comprador", ferramentaOuDocumento: "Planilha de cotação" },
    ]);
    expect(fontes.inicioEFim.entradas).toEqual([{ fornecedor: "Produção", entrada: "Requisição" }]);
    expect(fontes.identificacao).toMatchObject({ revisaoDoMapa: "Rev.02", responsavelPeloProcesso: "Gerente de compras" });
    expect(fontes.registrosDoProcesso).toEqual({ decisoes: "Diretoria aprova acima de 10 mil", recursosESistemas: "ERP, e-mail" });
    expect(fontes.diagnostico).toMatchObject({
      resumo: "Aprovação depende da diretoria.",
      riscosIso9001: [{ risco: "Compra sem cotação registrada", evidencia: "Cotações por e-mail" }],
      riscosRegistrados: [{ risco: "Fornecedor sem homologação", consequencia: "Material fora de especificação", probabilidade: "Média", impacto: "Alto" }],
      maturidade: "Estruturado — Etapas conhecidas",
    });
  });

  it("usa os indicadores do módulo primeiro e não repete o mesmo nome", () => {
    const { indicadores } = montarFontesDoProcedimento({
      processo,
      indicadores: [
        { nome: "Prazo médio de compra", formula: "dias", sentido: "menor", meta: 5, unidade: "dias", periodicidade: "Mensal", responsavel: "Gerente", ativo: true },
        { nome: "Indicador desativado", ativo: false },
      ],
    });
    expect(indicadores.map((item) => [item.nome, item.meta, item.origem])).toEqual([
      ["Prazo médio de compra", "≤ 5 dias", "acompanhado no módulo Indicadores"],
      ["Compras com 3 cotações", "95%", "sugerido no plano de melhoria"],
    ]);
  });

  it("separa as melhorias planejadas do processo atual", () => {
    const fontes = montarFontesDoProcedimento({ processo, acoes: [{ oque: "Publicar alçada", quem: "Diretor", prazo: "2026-12-01", status: "A fazer" }] });
    expect(fontes.melhoriasPlanejadas).toEqual({
      resumoToBe: "Alçada por valor.",
      melhorias: ["Alçada: Gerente aprova até 10 mil"],
      acoes: [{ oque: "Publicar alçada", quem: "Diretor", prazo: "2026-12-01", status: "A fazer" }],
    });
    expect(GUIA_DE_FONTES).toContain("não as descreva como prática atual");
  });

  it("aceita processo sem entrevista guiada", () => {
    const fontes = montarFontesDoProcedimento({ processo: { ...processo, entrevista_roteiro: null, riscos: [] } });
    expect(fontes.entrevista).toEqual([]);
    expect(fontes.diagnostico).toBeNull();
    expect(fontes.melhoriasPlanejadas).toBeNull();
    expect(fontes.indicadores.map((item) => item.nome)).toEqual(["prazo médio de compra"]);
  });
});

describe("Resposta da IA", () => {
  it("lê o documento e tira cercas de código", () => {
    const documento = lerDocumentoGerado({
      title: "", content_markdown: "```markdown\n# PR-001\n\n## Objetivo\nComprar\n```", executive_summary: "ok",
      attention_points: ["Conferir prazo", ""], suggested_risks: [], suggested_indicators: [1],
    }, "Procedimento - Compras")!;
    expect(documento).toMatchObject({ title: "Procedimento - Compras", content_markdown: "# PR-001\n\n## Objetivo\nComprar", attention_points: ["Conferir prazo"], suggested_indicators: [] });
    expect(documento.content_text).toBe("PR-001\n\n Objetivo\nComprar");
  });

  it("recusa resposta sem documento", () => {
    expect(lerDocumentoGerado({ content_markdown: "  " }, "x")).toBeNull();
    expect(lerDocumentoGerado(null, "x")).toBeNull();
  });
});

describe("ai-generate-document", () => {
  it("lê o processo do banco e não usa os dados enviados pela tela", () => {
    expect(documentEdge).toContain("dadosDoProcesso = await carregarFontes(client, processId, companyId)");
    expect(documentEdge).toContain('.from("processos").select(COLUNAS_DO_PROCESSO).eq("id", processId).eq("company_id", companyId)');
    expect(documentEdge).not.toMatch(/mappedProcessData[,\s]*\n?\s*manualDescription,\n\s*\};/);
    expect(documentEdge).toContain("dadosDoProcesso ? GUIA_DE_FONTES");
  });

  it("exige resposta no formato do documento e não devolve conteúdo montado sem a IA", () => {
    expect(documentEdge).toContain("responseSchema: schema");
    expect(documentEdge).toContain("chamarIA(systemPrompt, userContent, SCHEMA_DOCUMENTO, OPENAI_API_KEY)");
    expect(documentEdge).toContain('throw new HttpError(502, "O Peter não devolveu o documento. Tente gerar de novo.")');
    expect(documentEdge).not.toContain("fallback");
  });
});
