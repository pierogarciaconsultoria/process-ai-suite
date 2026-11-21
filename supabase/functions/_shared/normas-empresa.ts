// Só o trecho do client usado aqui: o arquivo também é importado pelos testes do front, que não resolvem esm.sh.
interface ClienteNormas {
  from(tabela: "normas_empresa"): {
    select(colunas: string): {
      eq(coluna: string, valor: unknown): {
        eq(coluna: string, valor: unknown): {
          order(coluna: string): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
}

export interface NormaEmpresa {
  nome: string;
  requisitos: string;
}

// Teto do bloco de normas no prompt (caracteres). Normas longas são cortadas com aviso ao modelo.
export const LIMITE_NORMAS_NO_PROMPT = 30000;

// Palavras comuns que não indicam assunto; ficam fora da comparação com o processo.
const PALAVRAS_VAZIAS = new Set(
  ("para pelo pela pelos pelas como mais quando onde qual quais deve devem pode podem sobre entre esta este estes estas " +
    "isso essa esse essas esses aquele aquela outro outra outros outras cada todo toda todos todas forma ser sendo sido " +
    "tem ter tendo foram sera seja sejam ainda tambem apenas assim caso conforme nao sim organizacao norma requisito requisitos").split(" "),
);
const TAMANHO_MAXIMO_TRECHO = 2000;

function termos(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra.length >= 4 && !PALAVRAS_VAZIAS.has(palavra));
}

/** Divide a norma em trechos por item numerado (ex.: "8.4.1 Generalidades") e por parágrafo. */
export function trechosDaNorma(texto: string): string[] {
  const partes = texto
    .split(/\n\s*\n|(?=(?:^|\s)\d{1,2}(?:\.\d{1,2}){1,3}\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/m)
    .map((parte) => parte.trim())
    .filter(Boolean);
  return partes.flatMap((parte) => {
    const pedacos: string[] = [];
    for (let i = 0; i < parte.length; i += TAMANHO_MAXIMO_TRECHO) pedacos.push(parte.slice(i, i + TAMANHO_MAXIMO_TRECHO));
    return pedacos;
  });
}

/** Escolhe os trechos mais ligados ao contexto até o limite, mantendo a ordem original de cada norma. */
function selecionarTrechos(normas: NormaEmpresa[], contexto: string, limite: number): string[] | null {
  const doContexto = new Set(termos(contexto));
  if (doContexto.size === 0) return null;

  const candidatos = normas.flatMap((norma, indiceNorma) =>
    trechosDaNorma(norma.requisitos).map((texto, indiceTrecho) => {
      const palavras = termos(texto);
      const acertos = new Set(palavras.filter((palavra) => doContexto.has(palavra))).size;
      return { indiceNorma, indiceTrecho, texto, nota: palavras.length ? acertos / Math.sqrt(palavras.length) : 0 };
    })
  ).filter((trecho) => trecho.nota > 0);
  if (candidatos.length === 0) return null;

  let restante = limite;
  const escolhidos = [...candidatos].sort((a, b) => b.nota - a.nota).filter((trecho) => {
    if (trecho.texto.length > restante) return false;
    restante -= trecho.texto.length;
    return true;
  });

  return normas.map((norma, indiceNorma) => {
    const daNorma = escolhidos
      .filter((trecho) => trecho.indiceNorma === indiceNorma)
      .sort((a, b) => a.indiceTrecho - b.indiceTrecho)
      .map((trecho) => trecho.texto);
    return daNorma.length ? `### ${norma.nome.trim()}\n${daNorma.join("\n[...]\n")}` : "";
  }).filter(Boolean);
}

/**
 * Bloco de prompt com as normas da empresa; vazio quando não há normas. Se passarem do limite, entram os
 * trechos mais ligados ao `contexto` (dados do processo); sem contexto útil, as normas são cortadas no limite.
 */
export function blocoDeNormas(normas: NormaEmpresa[], limite = LIMITE_NORMAS_NO_PROMPT, contexto = ""): string {
  const validas = normas.filter((norma) => norma.nome?.trim() && norma.requisitos?.trim());
  if (validas.length === 0) return "";

  const total = validas.reduce((soma, norma) => soma + norma.requisitos.trim().length, 0);
  const selecionadas = total > limite ? selecionarTrechos(validas, contexto, limite) : null;

  let aviso: string | null = null;
  let partes: string[];
  if (selecionadas) {
    partes = selecionadas;
    aviso = "- As normas são maiores que o espaço disponível: abaixo estão só os trechos mais ligados a este processo ([...] separa trechos).";
  } else {
    let restante = limite;
    partes = [];
    for (const norma of validas) {
      if (restante <= 0) { aviso = "- O texto foi cortado por tamanho; considere apenas o que aparece aqui."; break; }
      const texto = norma.requisitos.trim();
      const trecho = texto.length > restante ? texto.slice(0, restante) : texto;
      if (trecho.length < texto.length) aviso = "- O texto foi cortado por tamanho; considere apenas o que aparece aqui.";
      partes.push(`### ${norma.nome.trim()}\n${trecho}`);
      restante -= trecho.length;
    }
  }

  return [
    "NORMAS E REQUISITOS QUE ESTA EMPRESA SEGUE (cadastrados pela empresa):",
    "- Avalie o processo considerando estes requisitos: aponte o que atende, o que não atende e o que falta evidenciar.",
    "- Ao citar um requisito, use o nome da norma e o item como aparecem no texto abaixo (ex.: \"ISO 9001 8.5.1\").",
    "- Na entrevista, pergunte pelos registros e evidências que estes requisitos exigem quando forem relevantes para o processo.",
    "- Não invente itens nem exigências que não estejam no texto abaixo.",
    ...(aviso ? [aviso] : []),
    "",
    partes.join("\n\n"),
  ].join("\n");
}

/**
 * Lê as normas ativas da empresa e devolve o bloco de prompt (vazio se não houver ou se a leitura falhar).
 * `contexto`: texto do processo em análise, usado para escolher os trechos quando as normas são longas.
 */
export async function carregarBlocoDeNormas(client: unknown, companyId: string, contexto = ""): Promise<string> {
  const { data, error } = await (client as ClienteNormas)
    .from("normas_empresa")
    .select("nome, requisitos")
    .eq("company_id", companyId)
    .eq("ativa", true)
    .order("created_at");
  if (error) {
    // Sem a tabela (migration ainda não aplicada) ou sem acesso: o Peter segue sem as normas.
    console.error("[normas-empresa] não foi possível ler as normas:", error.message);
    return "";
  }
  return blocoDeNormas((data ?? []) as NormaEmpresa[], LIMITE_NORMAS_NO_PROMPT, contexto);
}
