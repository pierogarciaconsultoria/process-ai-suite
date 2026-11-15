// Erros de senha do Supabase Auth em português. Com a checagem de senhas vazadas (HIBP) ligada,
// o cadastro e a troca de senha recusam senhas que aparecem em vazamentos conhecidos.
export function mensagemDoErroDeSenha(error: unknown): string {
  const registro = (error && typeof error === "object" ? error : {}) as { code?: unknown; message?: unknown; reasons?: unknown };
  const mensagem = typeof registro.message === "string" ? registro.message : error instanceof Error ? error.message : String(error ?? "");
  const razoes = Array.isArray(registro.reasons) ? registro.reasons.map(String) : [];
  const texto = mensagem.toLowerCase();
  if (razoes.includes("pwned") || /pwned|leak|known to be weak|easy to guess/.test(texto)) {
    return "Essa senha aparece em vazamentos de dados conhecidos. Escolha outra senha.";
  }
  if (razoes.includes("length") || /at least \d+ characters|should be at least/.test(texto)) {
    const minimo = texto.match(/at least (\d+)/)?.[1];
    return `A senha precisa ter pelo menos ${minimo ?? "6"} caracteres.`;
  }
  if (razoes.includes("characters") || registro.code === "weak_password") {
    return "Senha fraca. Use letras maiúsculas e minúsculas, números e símbolos.";
  }
  return mensagem || "Não foi possível salvar a senha.";
}
