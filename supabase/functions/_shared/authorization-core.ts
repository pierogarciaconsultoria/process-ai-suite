export type CompanyRole = "owner" | "admin" | "gestor" | "analista";

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly retryAfter?: number) {
    super(message);
    this.name = "HttpError";
  }
}

type QueryResult<T> = Promise<{ data: T | null; error: { message?: string } | null }>;

export type AuthorizationClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          maybeSingle(): QueryResult<Record<string, unknown>>;
        };
        maybeSingle(): QueryResult<Record<string, unknown>>;
      };
    };
  };
};

// Mensagem de qualquer erro, inclusive os objetos de erro do Supabase (PostgrestError), que não são Error.
export function mensagemDoErro(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const { message, details, hint } = error as { message?: unknown; details?: unknown; hint?: unknown };
    if (typeof message === "string" && message) {
      return [message, details, hint].filter((parte) => typeof parte === "string" && parte).join(" | ");
    }
  }
  return "Erro desconhecido";
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${field} é obrigatório.`);
  }
  return value.trim();
}

export function extractBearerToken(header: string | null): string {
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Token de autenticação ausente ou inválido.");
  }
  const token = header.slice(7).trim();
  if (!token) throw new HttpError(401, "Token de autenticação ausente ou inválido.");
  return token;
}

export async function validateAuthenticatedUser<T extends { id: string }>(client: {
  auth: { getUser(): Promise<{ data: { user: T | null }; error: unknown }> };
}): Promise<T> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sessão inválida ou expirada.");
  return data.user;
}

export async function authorizeCompany(
  client: AuthorizationClient,
  userId: string,
  companyId: string,
  allowedRoles?: readonly CompanyRole[],
): Promise<CompanyRole> {
  const { data: company, error: companyError } = await client
    .from("empresas")
    .select("id, owner_id")
    .eq("id", companyId)
    .maybeSingle();

  if (!companyError && company?.owner_id === userId) {
    return "owner";
  }

  const { data: membership, error: membershipError } = await client
    .from("membros")
    .select("perfil")
    .eq("empresa_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (companyError || membershipError || !membership) {
    throw new HttpError(403, "Acesso negado para a empresa informada.");
  }

  const role = membership.perfil as CompanyRole;
  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new HttpError(403, "Seu perfil não possui permissão para este recurso.");
  }
  return role;
}

export async function authorizeProcess(
  client: AuthorizationClient,
  processId: string,
  companyId: string,
): Promise<void> {
  const { data, error } = await client
    .from("processos")
    .select("id")
    .eq("id", processId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new HttpError(403, "Acesso negado ao processo solicitado.");
  }
  if (!data) {
    throw new HttpError(404, "Processo não encontrado na empresa informada.");
  }
}
