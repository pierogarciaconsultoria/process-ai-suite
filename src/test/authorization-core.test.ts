import { describe, expect, it, vi } from "vitest";
import {
  authorizeCompany,
  authorizeProcess,
  extractBearerToken,
  HttpError,
  requireString,
  validateAuthenticatedUser,
  type AuthorizationClient,
} from "../../supabase/functions/_shared/authorization-core";

type RowMap = Record<string, Record<string, unknown> | null>;

function fakeClient(rows: RowMap): AuthorizationClient {
  return {
    from(table: string) {
      const filters: Record<string, string> = {};
      const builder = {
        select() { return builder; },
        eq(column: string, value: string) { filters[column] = value; return builder; },
        async maybeSingle() {
          const key = `${table}:${Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(",")}`;
          return { data: rows[key] ?? null, error: null };
        },
      };
      return builder as unknown as ReturnType<AuthorizationClient["from"]>;
    },
  };
}

describe("Edge authorization core", () => {
  it("returns 401 semantics for a missing or empty bearer token", () => {
    for (const header of [null, "", "Bearer "]) {
      expect(() => extractBearerToken(header)).toThrowError(HttpError);
      try { extractBearerToken(header); } catch (error) { expect((error as HttpError).status).toBe(401); }
    }
  });

  it("returns 401 when auth.getUser rejects the identity", async () => {
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("invalid") }) } };
    await expect(validateAuthenticatedUser(client)).rejects.toMatchObject({ status: 401 });
    expect(client.auth.getUser).toHaveBeenCalledOnce();
  });

  it("returns the validated user from auth.getUser", async () => {
    const user = { id: "user-a" };
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
    await expect(validateAuthenticatedUser(client)).resolves.toEqual(user);
  });

  it("returns 400 semantics for an invalid required payload", () => {
    expect(() => requireString(null, "company_id")).toThrowError(HttpError);
    try { requireString("", "company_id"); } catch (error) { expect((error as HttpError).status).toBe(400); }
  });

  it("authorizes a valid company member", async () => {
    const client = fakeClient({
      "membros:empresa_id=company-a,user_id=user-a": { perfil: "gestor" },
    });
    await expect(authorizeCompany(client, "user-a", "company-a")).resolves.toBe("gestor");
  });

  it("returns 403 and does not execute an external call for another company", async () => {
    const externalCall = vi.fn();
    const securedCall = async () => {
      await authorizeCompany(fakeClient({}), "user-a", "company-b");
      await externalCall();
    };
    await expect(securedCall()).rejects.toMatchObject({ status: 403 });
    expect(externalCall).not.toHaveBeenCalled();
  });

  it("requires admin or gestor for configuration review", async () => {
    const analyst = fakeClient({
      "membros:empresa_id=company-a,user_id=user-a": { perfil: "analista" },
    });
    await expect(authorizeCompany(analyst, "user-a", "company-a", ["admin", "gestor"]))
      .rejects.toMatchObject({ status: 403 });
  });

  it("accepts a process in the authorized company and returns 404 otherwise", async () => {
    const valid = fakeClient({
      "processos:id=process-a,company_id=company-a": { id: "process-a" },
    });
    await expect(authorizeProcess(valid, "process-a", "company-a")).resolves.toBeUndefined();
    await expect(authorizeProcess(fakeClient({}), "process-b", "company-a"))
      .rejects.toMatchObject({ status: 404 });
  });
});
