const chave = (nome: string) => nome.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

// Nomes de setores ou cargos vindos dos processos que ainda não existem no cadastro.
// Ignora vazios e repetidos, sem diferenciar maiúsculas ("Comprador" = "COMPRADOR").
export function nomesNovos(candidatos: unknown[], existentes: string[]): string[] {
  const vistos = new Set(existentes.map(chave));
  const novos: string[] = [];
  for (const candidato of candidatos) {
    if (typeof candidato !== "string") continue;
    const nome = candidato.trim().replace(/\s+/g, " ");
    if (!nome || nome.length > 120 || vistos.has(chave(nome))) continue;
    vistos.add(chave(nome));
    novos.push(nome);
  }
  return novos;
}
