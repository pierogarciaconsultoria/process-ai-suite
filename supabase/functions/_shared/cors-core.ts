// Regras de origem do CORS, sem depender do ambiente Deno (também usadas nos testes do app).

export const ORIGEM_PRINCIPAL = "https://peterbypierogarcia.lovable.app";

// Prévias do Lovable trazem o id do projeto no endereço.
const ID_PROJETO_LOVABLE = "4731d530-677b-4df5-9a01-27f78891d369";
const PREVIA_LOVABLE = new RegExp(`^https://[a-z0-9-]*${ID_PROJETO_LOVABLE}[a-z0-9-]*\\.(lovable\\.app|lovableproject\\.com)$`);

export function semBarraFinal(valor: string): string {
  return valor.trim().replace(/\/+$/, "");
}

// ALLOWED_ORIGINS: lista separada por vírgula (domínio próprio ou desenvolvimento local).
export function origensExtras(variavel: string | undefined): string[] {
  return (variavel ?? "").split(",").map(semBarraFinal).filter(Boolean);
}

export function origemPermitida(origem: string | null | undefined, extras: string[] = []): boolean {
  if (!origem) return false;
  const limpa = semBarraFinal(origem);
  return limpa === ORIGEM_PRINCIPAL || PREVIA_LOVABLE.test(limpa) || extras.includes(limpa);
}
