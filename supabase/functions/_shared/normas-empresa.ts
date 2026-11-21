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

/** Bloco de prompt com as normas da empresa; vazio quando não há normas. */
export function blocoDeNormas(normas: NormaEmpresa[], limite = LIMITE_NORMAS_NO_PROMPT): string {
  const validas = normas.filter((norma) => norma.nome?.trim() && norma.requisitos?.trim());
  if (validas.length === 0) return "";

  let restante = limite;
  let cortou = false;
  const partes: string[] = [];
  for (const norma of validas) {
    if (restante <= 0) { cortou = true; break; }
    const texto = norma.requisitos.trim();
    const trecho = texto.length > restante ? texto.slice(0, restante) : texto;
    if (trecho.length < texto.length) cortou = true;
    partes.push(`### ${norma.nome.trim()}\n${trecho}`);
    restante -= trecho.length;
  }

  return [
    "NORMAS E REQUISITOS QUE ESTA EMPRESA SEGUE (cadastrados pela empresa):",
    "- Avalie o processo considerando estes requisitos: aponte o que atende, o que não atende e o que falta evidenciar.",
    "- Ao citar um requisito, use o nome da norma e o item como aparecem no texto abaixo (ex.: \"ISO 9001 8.5.1\").",
    "- Na entrevista, pergunte pelos registros e evidências que estes requisitos exigem quando forem relevantes para o processo.",
    "- Não invente itens nem exigências que não estejam no texto abaixo.",
    ...(cortou ? ["- O texto foi cortado por tamanho; considere apenas o que aparece aqui."] : []),
    "",
    partes.join("\n\n"),
  ].join("\n");
}

/** Lê as normas ativas da empresa e devolve o bloco de prompt (vazio se não houver ou se a leitura falhar). */
export async function carregarBlocoDeNormas(client: unknown, companyId: string): Promise<string> {
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
  return blocoDeNormas((data ?? []) as NormaEmpresa[]);
}
