import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ORIGEM_PRINCIPAL, origemPermitida, origensExtras } from "../../supabase/functions/_shared/cors-core.ts";

describe("CORS das edge functions", () => {
  it("aceita o endereço publicado e as prévias deste projeto", () => {
    expect(origemPermitida(ORIGEM_PRINCIPAL)).toBe(true);
    expect(origemPermitida(`${ORIGEM_PRINCIPAL}/`)).toBe(true);
    expect(origemPermitida("https://id-preview--4731d530-677b-4df5-9a01-27f78891d369.lovable.app")).toBe(true);
    expect(origemPermitida("https://4731d530-677b-4df5-9a01-27f78891d369.lovableproject.com")).toBe(true);
  });

  it("recusa outras origens, inclusive outros apps do Lovable e domínios parecidos", () => {
    expect(origemPermitida(null)).toBe(false);
    expect(origemPermitida("https://outro-app.lovable.app")).toBe(false);
    expect(origemPermitida("https://peterbypierogarcia.lovable.app.exemplo.test")).toBe(false);
    expect(origemPermitida("https://4731d530-677b-4df5-9a01-27f78891d369.exemplo.test")).toBe(false);
    expect(origemPermitida("http://localhost:8081")).toBe(false);
  });

  it("aceita o que estiver em ALLOWED_ORIGINS", () => {
    const extras = origensExtras(" https://app.exemplo.test/ , http://localhost:8081 ,");
    expect(extras).toEqual(["https://app.exemplo.test", "http://localhost:8081"]);
    expect(origemPermitida("http://localhost:8081", extras)).toBe(true);
    expect(origemPermitida("https://app.exemplo.test", extras)).toBe(true);
  });

  it.each(["org-invite", "org-members", "org-revoke-invite", "ai-generate-document", "ai-peter-chat"])(
    "%s usa o CORS restrito",
    (nome) => {
      const fonte = readFileSync(resolve("supabase/functions", nome, "index.ts"), "utf8");
      expect(fonte).toContain("cabecalhosCors(req)");
      expect(fonte).not.toContain('"Access-Control-Allow-Origin": "*"');
    },
  );

  it("org-invite não usa endereço vindo do corpo e confere quem dá o perfil Consultor", () => {
    const fonte = readFileSync(resolve("supabase/functions/org-invite/index.ts"), "utf8");
    expect(fonte).not.toContain("body?.appBaseUrl");
    expect(fonte).toContain("enderecoDoApp(req)");
    expect(fonte).toContain('rpc("user_gerencia_como_consultor"');
    expect(fonte).toContain("convidado_por: user.id");
  });

  it.each(["org-invite", "org-members", "org-revoke-invite"])("%s reconhece quem gerencia pela conta", (nome) => {
    const fonte = readFileSync(resolve("supabase/functions", nome, "index.ts"), "utf8");
    expect(fonte).toContain('rpc("user_can_manage_company"');
  });
});
