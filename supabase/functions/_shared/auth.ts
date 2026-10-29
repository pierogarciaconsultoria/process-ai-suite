import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { extractBearerToken, HttpError, mensagemDoErro, validateAuthenticatedUser } from "./authorization-core.ts";

export { authorizeCompany, authorizeProcess, HttpError, mensagemDoErro, requireString } from "./authorization-core.ts";

export type AuthContext = {
  client: SupabaseClient;
  user: User;
};

export async function authenticateRequest(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization") ?? "";
  extractBearerToken(authHeader);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase não configurado para autenticação.");
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await validateAuthenticatedUser(client);
  return { client, user };
}

export function errorResponse(error: unknown, corsHeaders: Record<string, string>): Response {
  const status = error instanceof HttpError ? error.status : 500;
  const message = mensagemDoErro(error);
  if (status >= 500) console.error(`[${status}]`, message, error);
  const retryHeaders = error instanceof HttpError && error.retryAfter
    ? { "Retry-After": String(error.retryAfter) }
    : {};
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, ...retryHeaders, "Content-Type": "application/json" },
  });
}
