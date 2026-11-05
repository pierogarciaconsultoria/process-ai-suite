import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";

// Erro da chamada a uma edge function em português: sem conexão com a função ou a causa que
// ela devolveu no corpo ({ error }), em vez do genérico "non-2xx status code".
export async function mensagemDaFuncao(error: unknown, padrao: string): Promise<string> {
  const falha = error as { name?: string; message?: string; context?: { json?: () => Promise<unknown> } };
  if (falha?.name === "FunctionsFetchError" || /Failed to send a request/i.test(falha?.message ?? "")) {
    return "O Peter não está disponível agora. Tente de novo em instantes; se continuar, avise o suporte.";
  }
  if (falha?.name === "FunctionsHttpError" && typeof falha.context?.json === "function") {
    try {
      const corpo = (await falha.context.json()) as { error?: unknown };
      if (typeof corpo?.error === "string" && corpo.error) return corpo.error;
    } catch {
      // Sem corpo legível: segue para a mensagem padrão.
    }
  }
  return mensagemDoErroDoProcesso(error, padrao);
}
