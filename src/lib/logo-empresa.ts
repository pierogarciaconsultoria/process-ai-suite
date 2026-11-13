import { supabase } from "@/integrations/supabase/client";

// Logo do cliente no cabeçalho dos documentos (bucket "logos", migration 202611130001).
// Um arquivo por empresa: logos/<empresa_id>/logo.

export const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp"];
export const TAMANHO_MAX_LOGO = 1024 * 1024;

const caminho = (companyId: string) => `${companyId}/logo`;

export function validarLogo(arquivo: File): string | null {
  if (!TIPOS_LOGO.includes(arquivo.type)) return "Use uma imagem PNG, JPG ou WebP.";
  if (arquivo.size > TAMANHO_MAX_LOGO) return "O logo deve ter no máximo 1 MB.";
  return null;
}

export function urlDoLogo(companyId: string): string {
  return supabase.storage.from("logos").getPublicUrl(caminho(companyId)).data.publicUrl;
}

export async function enviarLogo(companyId: string, arquivo: File): Promise<void> {
  const erro = validarLogo(arquivo);
  if (erro) throw new Error(erro);
  const { error } = await supabase.storage.from("logos").upload(caminho(companyId), arquivo, {
    upsert: true,
    contentType: arquivo.type,
    cacheControl: "60",
  });
  if (error) throw error;
}

export async function removerLogo(companyId: string): Promise<void> {
  const { error } = await supabase.storage.from("logos").remove([caminho(companyId)]);
  if (error) throw error;
}

// O logo vai embutido no documento (data URL) para estar carregado na hora de imprimir.
// null quando a empresa não tem logo (ou ele não pôde ser lido).
export async function logoComoDataUrl(companyId: string | null): Promise<string | null> {
  if (!companyId) return null;
  try {
    const resposta = await fetch(`${urlDoLogo(companyId)}?t=${Date.now()}`, { cache: "no-store" });
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    if (!TIPOS_LOGO.includes(blob.type)) return null;
    return await new Promise<string | null>((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(typeof leitor.result === "string" ? leitor.result : null);
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
