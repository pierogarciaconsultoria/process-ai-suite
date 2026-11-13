import { describe, expect, it } from "vitest";
import { documentoHtml, markdownParaHtml, RODAPE_PADRAO, tituloDoDocumento } from "@/lib/documento-pdf";

const dados = {
  titulo: "Procedimento PR-XXX - COMPRAS - AS IS",
  codigo: "PR-007",
  revisao: "Rev.01",
  aprovadoEm: "2026-11-10T15:00:00Z",
  elaboradoPor: "Ana",
  aprovadoPor: "Bruno",
  logo: "data:image/png;base64,aWZh",
};

describe("Formatação do documento", () => {
  it("converte negrito, itálico e código, escapando HTML", () => {
    expect(markdownParaHtml("O **Comprador** deve _conferir_ a `NF` <script>")).toBe(
      "<p>O <strong>Comprador</strong> deve <em>conferir</em> a <code>NF</code> &lt;script&gt;</p>",
    );
  });

  it("monta tabelas com cabeçalho e completa células faltantes", () => {
    const html = markdownParaHtml("| Risco | Contingência | Responsável |\n|---|---|---|\n| Separar errado | Nova conferência | Separador |\n| Atraso | Comunicar |");
    expect(html).toBe(
      '<table class="tabela"><thead><tr><th>Risco</th><th>Contingência</th><th>Responsável</th></tr></thead>'
        + "<tbody><tr><td>Separar errado</td><td>Nova conferência</td><td>Separador</td></tr>"
        + "<tr><td>Atraso</td><td>Comunicar</td><td></td></tr></tbody></table>",
    );
  });

  it("monta listas numeradas e simples, títulos e citações", () => {
    expect(markdownParaHtml("## 8 – DESCRIÇÃO\n\n### 8.1 – Emitir o pedido\n\n1. Abrir o CRM\n2. Registrar\n\n- Pedido\n- NF\n\n> Atenção")).toBe(
      "<h2>8 – DESCRIÇÃO</h2>\n<h3>8.1 – Emitir o pedido</h3>\n<ol><li>Abrir o CRM</li><li>Registrar</li></ol>\n<ul><li>Pedido</li><li>NF</li></ul>\n<blockquote>Atenção</blockquote>",
    );
    expect(markdownParaHtml("3. Terceiro\n4. Quarto")).toBe('<ol start="3"><li>Terceiro</li><li>Quarto</li></ol>');
  });

  it("tira o título principal quando ele já está no cabeçalho", () => {
    expect(markdownParaHtml("# Procedimento PR-XXX\n\n## 1 – OBJETIVO\nTexto", { semPrimeiroTitulo: true })).toBe("<h2>1 – OBJETIVO</h2>\n<p>Texto</p>");
    expect(markdownParaHtml("Texto\n\n# Título no meio", { semPrimeiroTitulo: true })).toContain("<h1>Título no meio</h1>");
  });

  it("limpa o marcador do modelo do título", () => {
    expect(tituloDoDocumento("Procedimento PR-XXX - COOPERA - PÓS VENDAS - AS IS")).toBe("COOPERA - PÓS VENDAS - AS IS");
    expect(tituloDoDocumento("IT-XXX - Instrução de Trabalho: COOPERA - Pós Vendas")).toBe("COOPERA - Pós Vendas");
    expect(tituloDoDocumento("Pós-vendas: separação e entrega")).toBe("Pós-vendas: separação e entrega");
  });
});

describe("Documento controlado (PDF)", () => {
  it("põe o cabeçalho em quadro, repetido em cada página, e o rodapé de propriedade", () => {
    const html = documentoHtml("# Procedimento PR-XXX\n\n## 1 – OBJETIVO\nComprar no prazo.", dados);
    expect(html).toContain("<title>PR-007 – COMPRAS - AS IS</title>");
    expect(html).toContain('<thead><tr><td><table class="cabecalho">');
    expect(html).toContain('<img src="data:image/png;base64,aWZh" alt="Logo" />');
    expect(html).toContain('<td class="titulo" colspan="3">COMPRAS - AS IS</td>');
    expect(html).toContain('<td class="codigo">PR-007</td>');
    expect(html).toContain('<span class="rotulo">Revisão</span><span class="valor">01</span>');
    expect(html).toContain('<span class="rotulo">Data de aprovação</span><span class="valor">10/11/2026</span>');
    expect(html).toContain('<span class="rotulo">Elaborado por</span><span class="valor">Ana</span>');
    expect(html).toContain('<span class="rotulo">Aprovado por</span><span class="valor">Bruno</span>');
    expect(html).toContain(`@bottom-left { content: "${RODAPE_PADRAO}"`);
    expect(html).toContain('content: "Pág. " counter(page) " de " counter(pages)');
    expect(html).not.toContain("<h1>Procedimento PR-XXX</h1>");
  });

  it("deixa em branco o que ainda não existe e esconde o código interno do aprovador", () => {
    const html = documentoHtml("Texto", { ...dados, aprovadoEm: null, aprovadoPor: "0a1b2c3d-1111-2222-3333-444455556666", logo: null });
    expect(html).toContain('<span class="rotulo">Data de aprovação</span><span class="valor">__/__/____</span>');
    expect(html).toContain('<span class="rotulo">Aprovado por</span><span class="valor">&nbsp;</span>');
    expect(html).not.toContain("<img");
  });
});
