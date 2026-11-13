// Layout do documento controlado (PR/IT) para a tela e o PDF, no padrão do PA da consultoria:
// cabeçalho em quadro em todas as páginas (logo do cliente, título, código, revisão, data de
// aprovação, elaborado e aprovado por), conteúdo com tabelas e negrito, e rodapé de propriedade
// com "Pág. X de Y". O texto do documento continua sendo markdown editável.

export const RODAPE_PADRAO = "Este documento é de propriedade da empresa e sua reprodução é expressamente proibida sem prévia autorização.";

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Negrito, itálico e código dentro da linha (depois de escapar o HTML).
function inline(texto: string): string {
  return escaparHtml(texto)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!_)/g, "$1<em>$2</em>");
}

const SEPARADOR_TABELA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const ITEM_NUMERADO = /^\s*(\d+)[.)]\s+(.*)$/;
const ITEM_SIMPLES = /^\s*[-*•]\s+(.*)$/;

function celulas(linha: string): string[] {
  const conteudo = linha.trim().replace(/^\|/, "").replace(/\|$/, "");
  return conteudo.split("|").map((celula) => celula.trim());
}

// Markdown do documento (o que a IA e o editor produzem) para HTML: títulos, parágrafos, listas,
// tabelas, citações e linhas. Todo o texto é escapado antes; não há HTML do usuário no resultado.
export function markdownParaHtml(markdown: string, opcoes: { semPrimeiroTitulo?: boolean } = {}): string {
  const linhas = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let paragrafo: string[] = [];
  let primeiroTitulo = Boolean(opcoes.semPrimeiroTitulo);

  const fecharParagrafo = () => {
    if (paragrafo.length) html.push(`<p>${paragrafo.map(inline).join("<br />")}</p>`);
    paragrafo = [];
  };

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];
    const texto = linha.trim();

    if (!texto) {
      fecharParagrafo();
      continue;
    }

    const titulo = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(texto);
    if (titulo) {
      fecharParagrafo();
      // O título principal já está no cabeçalho do documento.
      if (primeiroTitulo && titulo[1].length === 1) {
        primeiroTitulo = false;
        continue;
      }
      primeiroTitulo = false;
      const nivel = titulo[1].length;
      html.push(`<h${nivel}>${inline(titulo[2])}</h${nivel}>`);
      continue;
    }
    primeiroTitulo = false;

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(texto)) {
      fecharParagrafo();
      html.push("<hr />");
      continue;
    }

    // Tabela: linha com "|" seguida da linha separadora.
    if (texto.includes("|") && i + 1 < linhas.length && SEPARADOR_TABELA.test(linhas[i + 1])) {
      fecharParagrafo();
      const cabecalho = celulas(texto);
      const corpo: string[][] = [];
      i += 2;
      while (i < linhas.length && linhas[i].trim().includes("|")) {
        corpo.push(celulas(linhas[i]));
        i += 1;
      }
      i -= 1;
      html.push(
        `<table class="tabela"><thead><tr>${cabecalho.map((celula) => `<th>${inline(celula)}</th>`).join("")}</tr></thead>`
          + `<tbody>${corpo.map((linhaTabela) => `<tr>${cabecalho.map((_, coluna) => `<td>${inline(linhaTabela[coluna] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
      );
      continue;
    }

    if (ITEM_NUMERADO.test(linha) || ITEM_SIMPLES.test(linha)) {
      fecharParagrafo();
      const numerada = ITEM_NUMERADO.test(linha);
      const inicio = numerada ? Number(ITEM_NUMERADO.exec(linha)![1]) : 1;
      const itens: string[] = [];
      while (i < linhas.length) {
        const atual = linhas[i];
        const item = numerada ? ITEM_NUMERADO.exec(atual) : ITEM_SIMPLES.exec(atual);
        if (item) {
          itens.push(inline(numerada ? item[2] : item[1]));
        } else if (atual.trim() && /^\s{2,}/.test(atual) && itens.length) {
          // Continuação do item (linha recuada).
          itens[itens.length - 1] += `<br />${inline(atual.trim())}`;
        } else {
          break;
        }
        i += 1;
      }
      i -= 1;
      const tag = numerada ? "ol" : "ul";
      html.push(`<${tag}${numerada && inicio !== 1 ? ` start="${inicio}"` : ""}>${itens.map((item) => `<li>${item}</li>`).join("")}</${tag}>`);
      continue;
    }

    if (texto.startsWith(">")) {
      fecharParagrafo();
      const citacao: string[] = [];
      while (i < linhas.length && linhas[i].trim().startsWith(">")) {
        citacao.push(inline(linhas[i].trim().replace(/^>\s?/, "")));
        i += 1;
      }
      i -= 1;
      html.push(`<blockquote>${citacao.join("<br />")}</blockquote>`);
      continue;
    }

    paragrafo.push(texto);
  }
  fecharParagrafo();
  return html.join("\n");
}

// "Procedimento PR-XXX - COOPERA - PÓS VENDAS" → "COOPERA - PÓS VENDAS": o código real vai no
// cabeçalho, e o marcador do modelo (PR-XXX, IT-XXX) não deve aparecer no documento.
export function tituloDoDocumento(titulo: string): string {
  const limpo = titulo
    .replace(/^\s*(procedimento|instru[çc][ãa]o de trabalho)\s*[:–-]?\s*/i, "")
    .replace(/\b(PR|IT|PA|POP)-X{2,}\b\s*[:–-]?\s*/gi, "")
    .replace(/^\s*(procedimento|instru[çc][ãa]o de trabalho)\s*[:–-]?\s*/i, "")
    .replace(/^\s*[:–-]\s*/, "")
    .trim();
  return limpo || titulo.trim();
}

function dataPtBr(valor: string | null | undefined): string {
  if (!valor) return "__/__/____";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "__/__/____" : data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// O nome do aprovador já foi gravado como o código do usuário (uuid); esse valor não vai ao papel.
function nomeLegivel(valor: string | null | undefined): string {
  const texto = (valor ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(texto) || texto === "local-user" ? "" : texto;
}

export interface DadosDoCabecalho {
  titulo: string;
  codigo: string;
  revisao: string;
  aprovadoEm: string | null;
  elaboradoPor: string;
  aprovadoPor: string;
  logo: string | null;
  rodape?: string;
}

const ESTILO = `
  @page { size: A4; margin: 12mm 14mm 16mm;
    @bottom-right { content: "Pág. " counter(page) " de " counter(pages); font: 8pt Arial, sans-serif; color: #444; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #111; background: #fff; }
  .pagina { width: 100%; border-collapse: collapse; }
  .pagina > thead > tr > td, .pagina > tbody > tr > td { padding: 0; }
  .cabecalho { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 14px; font-size: 8.5pt; }
  .cabecalho td { border: 1px solid #222; padding: 4px 6px; vertical-align: middle; }
  .cabecalho .logo { text-align: center; }
  .cabecalho .logo img { max-width: 100%; max-height: 52px; object-fit: contain; }
  .cabecalho .titulo { text-align: center; font-weight: bold; font-size: 11pt; text-transform: uppercase; }
  .cabecalho .codigo { text-align: center; font-weight: bold; font-size: 10pt; }
  .cabecalho .rotulo { display: block; font-size: 7pt; color: #444; font-weight: normal; }
  .cabecalho .valor { display: block; font-weight: bold; text-align: center; }
  .conteudo h1 { font-size: 13pt; text-transform: uppercase; margin: 18px 0 8px; }
  .conteudo h2 { font-size: 11pt; text-transform: uppercase; margin: 18px 0 6px; break-after: avoid; }
  .conteudo h3 { font-size: 10.5pt; margin: 14px 0 4px; break-after: avoid; }
  .conteudo h4, .conteudo h5, .conteudo h6 { font-size: 10.5pt; margin: 10px 0 4px; }
  .conteudo p { margin: 0 0 8px; text-align: justify; }
  .conteudo ul, .conteudo ol { margin: 0 0 8px; padding-left: 22px; }
  .conteudo li { margin-bottom: 3px; }
  .conteudo blockquote { margin: 8px 0; padding: 6px 10px; border-left: 3px solid #555; background: #f4f4f4; }
  .conteudo hr { border: 0; border-top: 1px solid #999; margin: 12px 0; }
  .conteudo code { font-family: "Courier New", monospace; font-size: 9.5pt; }
  .tabela { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9pt; }
  .tabela th, .tabela td { border: 1px solid #333; padding: 4px 6px; text-align: left; vertical-align: top; }
  .tabela th { background: #e8e8e8; }
  .tabela tr { break-inside: avoid; }
  .rodape-tela { margin-top: 24px; padding-top: 6px; border-top: 1px solid #999; font-size: 8pt; color: #444; text-align: center; }
  @media print { .rodape-tela { display: none; } }
  @media screen { body { padding: 24px; } }
`;

function cabecalhoHtml(dados: DadosDoCabecalho): string {
  const celula = (rotulo: string, valor: string) => `<span class="rotulo">${rotulo}</span><span class="valor">${escaparHtml(valor) || "&nbsp;"}</span>`;
  const revisao = dados.revisao.replace(/^rev\.?\s*/i, "") || "00";
  return `<table class="cabecalho">
  <colgroup><col style="width:20%" /><col style="width:12%" /><col style="width:20%" /><col style="width:24%" /><col style="width:24%" /></colgroup>
  <tr>
    <td class="logo" rowspan="2">${dados.logo ? `<img src="${escaparHtml(dados.logo)}" alt="Logo" />` : "&nbsp;"}</td>
    <td class="titulo" colspan="3">${escaparHtml(tituloDoDocumento(dados.titulo))}</td>
    <td class="codigo">${escaparHtml(dados.codigo)}</td>
  </tr>
  <tr>
    <td>${celula("Revisão", revisao)}</td>
    <td>${celula("Data de aprovação", dataPtBr(dados.aprovadoEm))}</td>
    <td>${celula("Elaborado por", nomeLegivel(dados.elaboradoPor))}</td>
    <td>${celula("Aprovado por", nomeLegivel(dados.aprovadoPor))}</td>
  </tr>
</table>`;
}

// Página completa: o cabeçalho fica no <thead>, que o navegador repete em cada página impressa;
// o rodapé de propriedade e a numeração ficam nas margens da página (@page).
export function documentoHtml(markdown: string, dados: DadosDoCabecalho): string {
  const rodape = dados.rodape?.trim() || RODAPE_PADRAO;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escaparHtml(`${dados.codigo} – ${tituloDoDocumento(dados.titulo)}`)}</title>
<style>@page { @bottom-left { content: "${rodape.replace(/["\\]/g, "")}"; font: 7.5pt Arial, sans-serif; color: #444; width: 75%; } }
${ESTILO}</style>
</head>
<body>
<table class="pagina">
  <thead><tr><td>${cabecalhoHtml(dados)}</td></tr></thead>
  <tbody><tr><td><div class="conteudo">${markdownParaHtml(markdown, { semPrimeiroTitulo: true })}</div>
  <div class="rodape-tela">${escaparHtml(rodape)}</div></td></tr></tbody>
</table>
</body>
</html>`;
}
