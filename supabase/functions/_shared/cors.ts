// CORS das edge functions: só o endereço publicado do Peter, as prévias deste projeto no Lovable
// e o que estiver em ALLOWED_ORIGINS. Chamadas sem Origin (servidor a servidor) não dependem de CORS.
import { ORIGEM_PRINCIPAL, origemPermitida, origensExtras, semBarraFinal } from "./cors-core.ts";

const CABECALHOS_PERMITIDOS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function extrasDoAmbiente(): string[] {
  return origensExtras(Deno.env.get("ALLOWED_ORIGINS"));
}

// Cabeçalhos de CORS para a resposta: devolve a própria origem quando ela é permitida; senão,
// o endereço principal (o navegador de outra origem bloqueia a leitura da resposta).
export function cabecalhosCors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origemPermitida(origem, extrasDoAmbiente()) ? semBarraFinal(origem as string) : ORIGEM_PRINCIPAL,
    "Access-Control-Allow-Headers": CABECALHOS_PERMITIDOS,
    Vary: "Origin",
  };
}

// Endereço usado nos links enviados por e-mail: nunca vem do corpo da requisição.
export function enderecoDoApp(req: Request): string {
  const fixo = semBarraFinal(Deno.env.get("INVITE_APP_BASE_URL") ?? "");
  if (fixo) return fixo;
  const origem = req.headers.get("origin");
  return origemPermitida(origem, extrasDoAmbiente()) ? semBarraFinal(origem as string) : ORIGEM_PRINCIPAL;
}
