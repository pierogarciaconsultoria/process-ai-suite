// Painel "Minhas empresas": a situação de cada empresa que o usuário acompanha.

export interface EmpresaCarteira {
  id: string;
  nome: string;
  segmento: string | null;
}

export interface ResumoEmpresa extends EmpresaCarteira {
  processosMapeados: number;
  emEntrevista: number;
  acoesAbertas: number;
  acoesAtrasadas: number;
  indicadoresFora: number;
  indicadoresSemResultado: number;
  documentosPendentes: number;
  // Quanto maior, mais a empresa precisa de atenção.
  atencao: number;
}

type Linha = Record<string, unknown>;
const ABERTA = new Set(["A fazer", "Em andamento"]);
export const DOCUMENTO_PENDENTE = ["Em revisão", "Em aprovação"];

function contar<T>(itens: T[], empresa: string, chave: (item: T) => unknown, filtro: (item: T) => boolean): number {
  return itens.filter((item) => chave(item) === empresa && filtro(item)).length;
}

export function resumirCarteira(dados: {
  empresas: EmpresaCarteira[];
  processos: Linha[];
  acoes: Linha[];
  indicadores: Linha[];
  medicoes: Linha[];
  documentos: Linha[];
  hoje: string;
}): ResumoEmpresa[] {
  const ultimo = new Map<string, number>();
  for (const medicao of [...dados.medicoes].sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)))) {
    if (typeof medicao.valor === "number") ultimo.set(String(medicao.indicador_id), medicao.valor);
  }
  const fora = (indicador: Linha) => {
    const valor = ultimo.get(String(indicador.id));
    if (valor === undefined || typeof indicador.meta !== "number") return false;
    return indicador.sentido === "menor" ? valor > indicador.meta : valor < indicador.meta;
  };

  return dados.empresas
    .map((empresa) => {
      const resumo = {
        ...empresa,
        processosMapeados: contar(dados.processos, empresa.id, (item) => item.company_id, (item) => item.status !== "Em entrevista" && item.status !== "Rascunho" && item.status !== "Obsoleto"),
        emEntrevista: contar(dados.processos, empresa.id, (item) => item.company_id, (item) => item.status === "Em entrevista" || item.status === "Rascunho"),
        acoesAbertas: contar(dados.acoes, empresa.id, (item) => item.company_id, (item) => ABERTA.has(String(item.status))),
        acoesAtrasadas: contar(dados.acoes, empresa.id, (item) => item.company_id, (item) => ABERTA.has(String(item.status)) && typeof item.prazo === "string" && item.prazo < dados.hoje),
        indicadoresFora: contar(dados.indicadores, empresa.id, (item) => item.company_id, fora),
        indicadoresSemResultado: contar(dados.indicadores, empresa.id, (item) => item.company_id, (item) => !ultimo.has(String(item.id))),
        documentosPendentes: contar(dados.documentos, empresa.id, (item) => item.company_id, (item) => DOCUMENTO_PENDENTE.includes(String(item.status))),
      };
      return { ...resumo, atencao: resumo.acoesAtrasadas * 3 + resumo.indicadoresFora * 2 + resumo.documentosPendentes + resumo.emEntrevista };
    })
    .sort((a, b) => b.atencao - a.atencao || a.nome.localeCompare(b.nome, "pt-BR"));
}
