// Exportar e excluir os dados de uma empresa (migration 202611150003).
import { supabase } from "@/integrations/supabase/client";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";

export function nomeDoArquivoDeExportacao(nomeEmpresa: string, agora = new Date()): string {
  const slug = nomeEmpresa
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "empresa";
  const data = agora.toISOString().slice(0, 10);
  return `peter-${slug}-${data}.json`;
}

function baixar(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportarDadosDaEmpresa(empresaId: string, nomeEmpresa: string): Promise<{ erro?: string }> {
  const { data, error } = await supabase.rpc("exportar_dados_empresa", { _empresa_id: empresaId });
  if (error) return { erro: mensagemDoErroDoProcesso(error, "Não foi possível exportar os dados.") };
  baixar(nomeDoArquivoDeExportacao(nomeEmpresa), JSON.stringify(data, null, 2));
  return {};
}

export async function excluirEmpresa(empresaId: string, confirmacao: string): Promise<{ erro?: string }> {
  const { error } = await supabase.rpc("excluir_empresa", { _empresa_id: empresaId, _confirmacao: confirmacao });
  if (error) return { erro: mensagemDoErroDoProcesso(error, "Não foi possível excluir a empresa.") };
  return {};
}

export function confirmacaoConfere(nomeEmpresa: string, digitado: string): boolean {
  return digitado.trim().toLowerCase() === nomeEmpresa.trim().toLowerCase();
}
