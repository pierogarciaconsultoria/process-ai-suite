import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const functions = [
  "ai-fill-process",
  "ai-diagnose-process",
  "ai-generate-bpmn",
  "ai-interview",
  "ai-interview-roteiro",
  "ai-helpcenter",
  "ai-review-config",
  "ai-summarize-process",
  "ai-generate-document",
];

describe("Edge Function security contract", () => {
  for (const functionName of functions) {
    it(`${functionName} authenticates before resolving an external API key`, () => {
      const source = readFileSync(resolve("supabase/functions", functionName, "index.ts"), "utf8");
      const handler = source.slice(source.indexOf("serve("));
      const authIndex = handler.indexOf("authenticateRequest(req)");
      const externalKeyIndex = handler.search(/Deno\.env\.get\("(?:OPENAI|LOVABLE)_API_KEY"\)/);
      expect(authIndex).toBeGreaterThanOrEqual(0);
      expect(externalKeyIndex).toBeGreaterThan(authIndex);
      expect(source).not.toMatch(/SERVICE_ROLE|service_role/);
    });
  }

  it.each(["ai-diagnose-process", "ai-generate-bpmn", "ai-generate-document"])(
    "%s only invokes the configured Peter Assistant after tenant authorization",
    (functionName) => {
      const source = readFileSync(resolve("supabase/functions", functionName, "index.ts"), "utf8");
      const authorizationIndex = source.indexOf("await authorizeCompany(");
      const assistantIndex = source.indexOf("runConfiguredAssistant(");
      expect(authorizationIndex).toBeGreaterThanOrEqual(0);
      expect(assistantIndex).toBeGreaterThan(authorizationIndex);
    },
  );

  it("the shared Assistant client never uses a service role", () => {
    const source = readFileSync(resolve("supabase/functions/_shared/openai-assistant.ts"), "utf8");
    expect(source).not.toMatch(/SERVICE_ROLE|service_role/);
  });

  // Edge Functions ficam fora do typecheck do app: um import de export inexistente só quebra no deploy.
  it.each(readdirSync(resolve("supabase/functions")).filter((name) => !name.startsWith("_")))(
    "%s only imports names that _shared modules export",
    (functionName) => {
      const source = readFileSync(resolve("supabase/functions", functionName, "index.ts"), "utf8");
      for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\.\/_shared\/([^"]+)"/g)) {
        const shared = readFileSync(resolve("supabase/functions/_shared", match[2]), "utf8");
        const names = match[1].split(",").map((name) => name.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter(Boolean);
        for (const name of names) {
          expect(shared, `${match[2]} deveria exportar ${name}`).toMatch(new RegExp(`export\\s+(?:async\\s+)?(?:function|const|class|type|interface)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`));
        }
      }
    },
  );
});
