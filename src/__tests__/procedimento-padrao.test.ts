import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  atividadesFaltando,
  ehProcedimento,
  escolherPadrao,
  ESTRUTURA_IT_PADRAO,
  ESTRUTURA_PR_PADRAO,
  EXEMPLO_ATIVIDADE_PADRAO,
  inserirDescricao,
  lerDocumentoDeApoio,
  MAX_DOCUMENTO_DE_APOIO,
  lerSubsecoes,
  lotesDeAtividades,
  MANUAL_PADRAO,
  MARCADOR_DESCRICAO,
  promptDasAtividades,
  promptDoCorpo,
  REGRAS_DO_CONTEUDO,
  semLinksInventados,
  subsecaoDosDados,
} from "../../supabase/functions/_shared/procedimento-padrao";

const documentEdge = readFileSync(resolve(process.cwd(), "supabase/functions/ai-generate-document/index.ts"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202611070001_padroes_documento.sql"), "utf8");

describe("Padrão do procedimento", () => {
  it("vale para Procedimento, POP e IT, não para os outros documentos", () => {
    expect(ehProcedimento("Procedimento")).toBe(true);
    expect(ehProcedimento("Procedimento Operacional Padrão")).toBe(true);
    expect(ehProcedimento("Instrução de Trabalho")).toBe(true);
    expect(ehProcedimento("pop_v5")).toBe(false);
    expect(ehProcedimento("raci")).toBe(false);
  });

  it("usa o padrão da empresa, senão o da plataforma, senão o genérico, parte por parte", () => {
    const linhas = [
      { company_id: null, tipo: "estrutura_pr", conteudo: "Estrutura da plataforma" },
      { company_id: null, tipo: "manual_escrita", conteudo: "Manual da plataforma" },
      { company_id: "empresa-a", tipo: "estrutura_pr", conteudo: "Estrutura do cliente A" },
      { company_id: "empresa-a", tipo: "manual_escrita", conteudo: "   " },
    ];
    expect(escolherPadrao(linhas, "empresa-a", "Procedimento")).toEqual({ estrutura: "Estrutura do cliente A", manual: "Manual da plataforma", exemplo: EXEMPLO_ATIVIDADE_PADRAO, origem: "empresa" });
    expect(escolherPadrao(linhas, "empresa-b", "Procedimento")).toEqual({ estrutura: "Estrutura da plataforma", manual: "Manual da plataforma", exemplo: EXEMPLO_ATIVIDADE_PADRAO, origem: "plataforma" });
    expect(escolherPadrao(linhas, "empresa-b", "Instrução de Trabalho").estrutura).toBe(ESTRUTURA_IT_PADRAO);
    expect(escolherPadrao([], "empresa-b", "Procedimento")).toEqual({ estrutura: ESTRUTURA_PR_PADRAO, manual: MANUAL_PADRAO, exemplo: EXEMPLO_ATIVIDADE_PADRAO, origem: "padrao" });
    // O exemplo da empresa substitui o genérico.
    expect(escolherPadrao([{ company_id: null, tipo: "exemplo_atividade", conteudo: "### 8.4 – Separar mercadorias\n\nTexto." }], "empresa-b", "Procedimento").exemplo).toBe("### 8.4 – Separar mercadorias\n\nTexto.");
  });

  it("separa dado da empresa de conhecimento técnico e proíbe cortes e links inventados", () => {
    expect(REGRAS_DO_CONTEUDO).toContain("DADO DA EMPRESA");
    expect(REGRAS_DO_CONTEUDO).toContain('"(sugerido pelo Peter — validar)"');
    expect(REGRAS_DO_CONTEUDO).toContain("cláusulas da ISO 9001:2015 aplicáveis");
    expect(REGRAS_DO_CONTEUDO).toContain('"link_to_download", "…", "[continua]"');
    const corpo = promptDoCorpo({ estrutura: "1. OBJETIVO", manual: "Use infinitivo.", origem: "plataforma" }, true, "07/11/2026");
    expect(corpo).toContain("## PADRÃO DE ESTRUTURA");
    expect(corpo).toContain("1. OBJETIVO");
    expect(corpo).toContain("Use infinitivo.");
    expect(corpo).toContain(`exatamente ${MARCADOR_DESCRICAO}`);
    expect(corpo).toContain('"00 | 07/11/2026 | Emissão inicial do procedimento"');
    expect(promptDoCorpo({ estrutura: "x", manual: "y", origem: "padrao" }, false, "07/11/2026")).not.toContain(MARCADOR_DESCRICAO);
  });

  it("exige atividades detalhadas, com exemplo, e marca o que falta em vez de inventar", () => {
    const prompt = promptDasAtividades({ estrutura: "", manual: "Manual X", exemplo: "EXEMPLO DA EMPRESA", origem: "plataforma" }, { de: 1, ate: 8 }, 8);
    expect(prompt).toContain("## NÍVEL DE DETALHE EXIGIDO EM CADA SUBSEÇÃO");
    expect(prompt).toContain("Escreva de 2 a 4 parágrafos, com texto descritivo completo, nunca genérico");
    expect(prompt).toContain("Controles e verificações");
    expect(prompt).toContain('Proibido: frases vagas como "realizar a atividade"');
    expect(prompt).toContain('marque o ponto com "[detalhar: <o que falta>]"');
    expect(prompt).toContain("## EXEMPLO DO NÍVEL DE DETALHE ESPERADO (imite o formato e a profundidade; não copie os dados)\nEXEMPLO DA EMPRESA");
    expect(prompt).toContain("## DOCUMENTO DE APOIO");
    expect(promptDasAtividades({ estrutura: "", manual: "", origem: "padrao" }, { de: 1, ate: 1 }, 1)).toContain(EXEMPLO_ATIVIDADE_PADRAO);
    expect(promptDoCorpo({ estrutura: "x", manual: "y", origem: "padrao" }, true, "13/11/2026")).toContain('cada "[detalhar: …]"');
  });

  it("aceita o documento de apoio só com texto, com limite de tamanho", () => {
    expect(lerDocumentoDeApoio(null)).toBeNull();
    expect(lerDocumentoDeApoio({ nome: "PA.pdf", texto: "   " })).toBeNull();
    expect(lerDocumentoDeApoio({ texto: "Separar o material." })).toEqual({ nome: "documento de apoio", texto: "Separar o material.", cortado: false });
    const longo = lerDocumentoDeApoio({ nome: "PA.pdf", texto: "x".repeat(MAX_DOCUMENTO_DE_APOIO + 10) })!;
    expect(longo.texto).toHaveLength(MAX_DOCUMENTO_DE_APOIO);
    expect(longo.cortado).toBe(true);
  });

  it("divide as atividades em lotes e pede todas as ordens de cada lote", () => {
    expect(lotesDeAtividades(0)).toEqual([]);
    expect(lotesDeAtividades(25)).toEqual([{ de: 1, ate: 8 }, { de: 9, ate: 16 }, { de: 17, ate: 24 }, { de: 25, ate: 25 }]);
    const prompt = promptDasAtividades({ estrutura: "", manual: "Manual X", origem: "padrao" }, { de: 9, ate: 16 }, 25);
    expect(prompt).toContain("O processo tem 25 atividades");
    expect(prompt).toContain("Escreva SOMENTE as atividades de ordem 9 a 16, todas, na ordem.");
    expect(prompt).toContain("Manual X");
  });

  it("lê as subseções, descarta texto cortado e acha as atividades que faltam", () => {
    const subsecoes = lerSubsecoes({
      subsecoes: [
        { titulo: "8.1 – Emitir o pedido", atividades: [1, 2], texto: "O **Vendedor** deve emitir…\n\n**Resultado esperado:** pedido emitido." },
        { titulo: "Separar o material", atividades: [3], texto: "Separar o material. [continua por 25 etapas]" },
        { titulo: "", atividades: [4], texto: "sem título" },
        { titulo: "Conferir", atividades: [5, 1.5], texto: "O **Conferente** deve conferir." },
      ],
    });
    expect(subsecoes.map((item) => [item.titulo, item.atividades])).toEqual([["Emitir o pedido", [1, 2]], ["Conferir", [5]]]);
    expect(atividadesFaltando(subsecoes, { de: 1, ate: 6 })).toEqual([3, 4, 6]);
    expect(lerSubsecoes(null)).toEqual([]);
  });

  it("descreve com os dados do mapeamento a atividade que a IA deixou de fora", () => {
    expect(subsecaoDosDados({ ordem: 7, atividade: "Separar o material", responsavel: "Separador", ferramentaOuDocumento: "Espelho do Pedido" })).toEqual({
      titulo: "Separar o material",
      atividades: [7],
      texto: "O **Separador** deve separar o material.\n\n**Recursos utilizados:** Espelho do Pedido.\n\n**Resultado esperado:** [a definir].",
    });
  });

  it("põe a descrição no lugar do marcador, numerada pela seção", () => {
    const subsecoes = [
      { titulo: "Emitir o pedido", atividades: [1], texto: "Texto 1." },
      { titulo: "Separar o material", atividades: [2], texto: "Texto 2." },
    ];
    const corpo = `# Pós-vendas\n\n## 7 – RISCOS\n\nTabela\n\n## 8 – DESCRIÇÃO\n\n${MARCADOR_DESCRICAO}\n\n## 9 – RESPONSABILIDADE\n\nTodos.`;
    const final = inserirDescricao(corpo, subsecoes);
    expect(final).toContain("## 8 – DESCRIÇÃO\n\n### 8.1 – Emitir o pedido\n\nTexto 1.\n\n### 8.2 – Separar o material\n\nTexto 2.\n\n## 9 – RESPONSABILIDADE");
    expect(final).not.toContain(MARCADOR_DESCRICAO);

    // Sem o marcador: logo depois do título da seção de descrição.
    const semMarcador = inserirDescricao("## 8. Descrição das atividades\n\n## 9. Responsabilidade", subsecoes);
    expect(semMarcador).toContain("## 8. Descrição das atividades\n\n### 8.1 – Emitir o pedido");
    // Sem seção de descrição: no fim.
    expect(inserirDescricao("# Doc", subsecoes)).toContain("## DESCRIÇÃO DAS ATIVIDADES\n\n### 1. Emitir o pedido");
  });

  it("tira links inventados e mantém os reais", () => {
    expect(semLinksInventados('[BP Modelagem BPMN - "COMPRAS"](link_to_download_bpmn) e [site](https://exemplo.com)')).toBe('BP Modelagem BPMN - "COMPRAS" e [site](https://exemplo.com)');
  });
});

describe("ai-generate-document — procedimento", () => {
  it("usa o padrão do banco e escreve as atividades em lotes paralelos, com segunda tentativa", () => {
    expect(documentEdge).toContain("if (dadosDoProcesso && ehProcedimento(tipoDocumento))");
    expect(documentEdge).toContain("const padrao = await carregarPadrao(client, companyId, tipoDocumento)");
    expect(documentEdge).toContain("...lotes.map((lote) => escrever(lote))");
    expect(documentEdge).toContain("ATENÇÃO: na tentativa anterior faltaram as atividades");
    expect(documentEdge).toContain("subsecoes.push(subsecaoDosDados(atividade))");
    expect(documentEdge).toContain("semLinksInventados(");
    expect(documentEdge).toContain("const documentoDeApoio = lerDocumentoDeApoio(documento_apoio)");
    expect(documentEdge).toContain("...(entrada.documentoDeApoio ? { documentoDeApoio: entrada.documentoDeApoio } : {})");
  });

  it("a migration guarda um padrão por tipo na plataforma e por empresa, editável só pelo super admin", () => {
    expect(migration).toContain("on public.padroes_documento (tipo) where company_id is null");
    expect(migration).toContain("on public.padroes_documento (company_id, tipo) where company_id is not null");
    expect(migration).toContain("using (company_id is null or company_id in (select public.user_empresa_ids()) or public.is_super_admin())");
    expect(migration.match(/public\.is_super_admin\(\)\)/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
