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

// Pessoas ativas que recebem o documento: as dos cargos escolhidos e as de cargos dos setores escolhidos.
export function pessoasDaDistribuicao<P extends { id: string; cargo_id: string | null; ativa: boolean }>(
  pessoas: P[],
  cargos: { id: string; setor_id: string | null }[],
  setoresEscolhidos: string[],
  cargosEscolhidos: string[],
): P[] {
  const alvo = new Set(cargosEscolhidos);
  for (const cargo of cargos) if (cargo.setor_id && setoresEscolhidos.includes(cargo.setor_id)) alvo.add(cargo.id);
  return pessoas.filter((pessoa) => pessoa.ativa && pessoa.cargo_id !== null && alvo.has(pessoa.cargo_id));
}
