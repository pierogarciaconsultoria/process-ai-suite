// Leitor de XML mínimo, com namespaces, para ler diagramas BPMN no navegador e nas edge
// functions (o Deno das edge functions não tem DOMParser para XML). Não valida DTD nem
// esquema: lê elementos, atributos e texto, e recusa XML malformado.

export interface NoXml {
  localName: string;
  namespaceURI: string | null;
  atributos: Record<string, string>;
  filhos: NoXml[];
  pai: NoXml | null;
  // Texto e elementos na ordem do documento, para montar o texto completo do elemento.
  conteudo: Array<NoXml | string>;
}

const ENTIDADES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (original, entidade: string) => {
    if (entidade[0] === "#") {
      const codigo = entidade[1].toLowerCase() === "x" ? parseInt(entidade.slice(2), 16) : parseInt(entidade.slice(1), 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : original;
    }
    return ENTIDADES[entidade] ?? original;
  });
}

const ATRIBUTO = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const NOME = /^[A-Za-z_][\w.\-:]*$/;

// Lança erro quando o XML está malformado.
export function lerXml(xml: string): NoXml {
  const texto = xml.replace(/^﻿/, "");
  const pilha: Array<{ no: NoXml; prefixos: Record<string, string>; nome: string }> = [];
  let raiz: NoXml | null = null;
  let posicao = 0;

  const adicionarTexto = (trecho: string) => {
    if (!trecho) return;
    const atual = pilha[pilha.length - 1];
    if (atual) atual.no.conteudo.push(trecho);
    else if (trecho.trim()) throw new Error("Texto fora do elemento raiz.");
  };

  while (posicao < texto.length) {
    const abre = texto.indexOf("<", posicao);
    if (abre < 0) {
      adicionarTexto(decodificar(texto.slice(posicao)));
      break;
    }
    adicionarTexto(decodificar(texto.slice(posicao, abre)));

    if (texto.startsWith("<!--", abre)) {
      const fim = texto.indexOf("-->", abre + 4);
      if (fim < 0) throw new Error("Comentário sem fim.");
      posicao = fim + 3;
      continue;
    }
    if (texto.startsWith("<![CDATA[", abre)) {
      const fim = texto.indexOf("]]>", abre + 9);
      if (fim < 0) throw new Error("CDATA sem fim.");
      if (!pilha.length) throw new Error("CDATA fora do elemento raiz.");
      adicionarTexto(texto.slice(abre + 9, fim));
      posicao = fim + 3;
      continue;
    }
    if (texto.startsWith("<?", abre)) {
      const fim = texto.indexOf("?>", abre + 2);
      if (fim < 0) throw new Error("Instrução sem fim.");
      posicao = fim + 2;
      continue;
    }
    if (texto.startsWith("<!", abre)) {
      // DOCTYPE (sem subconjunto interno, que diagramas BPMN não usam).
      const fim = texto.indexOf(">", abre + 2);
      if (fim < 0) throw new Error("Declaração sem fim.");
      posicao = fim + 1;
      continue;
    }

    // Fim da tag, ignorando ">" dentro de valores de atributo.
    let fim = abre + 1;
    let aspas: string | null = null;
    for (; fim < texto.length; fim += 1) {
      const caractere = texto[fim];
      if (aspas) {
        if (caractere === aspas) aspas = null;
      } else if (caractere === '"' || caractere === "'") {
        aspas = caractere;
      } else if (caractere === ">") {
        break;
      }
    }
    if (fim >= texto.length) throw new Error("Tag sem fim.");
    const corpo = texto.slice(abre + 1, fim);
    posicao = fim + 1;

    if (corpo.startsWith("/")) {
      const nome = corpo.slice(1).trim();
      const atual = pilha.pop();
      if (!atual || atual.nome !== nome) throw new Error(`Fechamento inesperado: ${nome}.`);
      continue;
    }

    const autoFechada = corpo.endsWith("/");
    const semBarra = autoFechada ? corpo.slice(0, -1) : corpo;
    const nome = semBarra.match(/^[^\s/>]+/)?.[0] ?? "";
    if (!NOME.test(nome)) throw new Error(`Nome de elemento inválido: ${nome || "(vazio)"}.`);
    if (!pilha.length && raiz) throw new Error("Mais de um elemento raiz.");

    const restante = semBarra.slice(nome.length);
    const atributos: Record<string, string> = {};
    const herdados = pilha[pilha.length - 1]?.prefixos ?? {};
    const prefixos: Record<string, string> = { ...herdados };
    ATRIBUTO.lastIndex = 0;
    let consumido = 0;
    for (const encontrado of restante.matchAll(ATRIBUTO)) {
      if (restante.slice(consumido, encontrado.index).trim()) throw new Error(`Atributo malformado em ${nome}.`);
      consumido = (encontrado.index ?? 0) + encontrado[0].length;
      const chave = encontrado[1];
      const valor = decodificar(encontrado[2] ?? encontrado[3] ?? "");
      if (chave === "xmlns") prefixos[""] = valor;
      else if (chave.startsWith("xmlns:")) prefixos[chave.slice(6)] = valor;
      atributos[chave] = valor;
    }
    if (restante.slice(consumido).trim()) throw new Error(`Atributo malformado em ${nome}.`);

    const separador = nome.indexOf(":");
    const prefixo = separador > 0 ? nome.slice(0, separador) : "";
    const no: NoXml = {
      localName: separador > 0 ? nome.slice(separador + 1) : nome,
      namespaceURI: prefixos[prefixo] ?? null,
      atributos,
      filhos: [],
      pai: pilha[pilha.length - 1]?.no ?? null,
      conteudo: [],
    };
    if (prefixo && !(prefixo in prefixos)) throw new Error(`Prefixo sem namespace: ${prefixo}.`);
    if (no.pai) {
      no.pai.filhos.push(no);
      no.pai.conteudo.push(no);
    } else {
      raiz = no;
    }
    if (!autoFechada) pilha.push({ no, prefixos, nome });
  }

  if (pilha.length) throw new Error(`Elemento sem fechamento: ${pilha[pilha.length - 1].nome}.`);
  if (!raiz) throw new Error("XML vazio.");
  return raiz;
}

export function atributo(no: NoXml | undefined | null, nome: string): string | null {
  return no && Object.prototype.hasOwnProperty.call(no.atributos, nome) ? no.atributos[nome] : null;
}

export function textoDe(no: NoXml): string {
  return no.conteudo.map((parte) => (typeof parte === "string" ? parte : textoDe(parte))).join("");
}

// Descendentes na ordem do documento (sem o próprio elemento), como getElementsByTagNameNS.
export function descendentesNs(no: NoXml, namespace: string, nome = "*"): NoXml[] {
  const encontrados: NoXml[] = [];
  const visitar = (atual: NoXml) => {
    for (const filho of atual.filhos) {
      if (filho.namespaceURI === namespace && (nome === "*" || filho.localName === nome)) encontrados.push(filho);
      visitar(filho);
    }
  };
  visitar(no);
  return encontrados;
}
