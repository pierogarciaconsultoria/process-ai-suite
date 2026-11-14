// Contas do Peter (migrations 202611140001 e 202611140002): rótulos e o link do convite.

export const TIPO_CONTA: Record<string, string> = { consultoria: "Consultoria", empresa: "Empresa" };

export const PAPEL_CONTA: Record<string, string> = { admin: "Administrador", consultor: "Consultor" };

export const DESCRICAO_PAPEL_CONTA: Record<string, string> = {
  admin: "Vê e gerencia todas as empresas da conta, convida pessoas e muda papéis.",
  consultor: "Vê só as empresas em que foi incluído; cadastra empresas na conta.",
};

export function linkDoConviteDeConta(token: string, origem = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origem}/convite-conta/${token}`;
}
