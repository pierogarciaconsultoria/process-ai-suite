import { describe, expect, it } from "vitest";
import { loginRedirectFor, safeInternalRedirect } from "@/lib/auth-navigation";

describe("safe authentication redirects", () => {
  it("preserves safe internal routes", () => {
    expect(safeInternalRedirect("/processos/123?tab=mapa#top")).toBe("/processos/123?tab=mapa#top");
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)"])(
    "rejects unsafe redirect %s",
    (value) => expect(safeInternalRedirect(value)).toBe("/dashboard"),
  );

  it("builds a login URL containing only the internal destination", () => {
    expect(loginRedirectFor({ pathname: "/processos", search: "?page=2", hash: "#list" }))
      .toBe("/login?redirect=%2Fprocessos%3Fpage%3D2%23list");
  });
});
