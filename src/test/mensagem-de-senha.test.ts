import { describe, expect, it } from "vitest";
import { mensagemDoErroDeSenha } from "@/lib/mensagem-de-senha";

describe("mensagemDoErroDeSenha", () => {
  it("traduz senha vazada (HIBP)", () => {
    expect(mensagemDoErroDeSenha({ code: "weak_password", reasons: ["pwned"], message: "Password is known to be weak and easy to guess, please choose a different one." }))
      .toBe("Essa senha aparece em vazamentos de dados conhecidos. Escolha outra senha.");
  });

  it("traduz senha curta com o mínimo informado", () => {
    expect(mensagemDoErroDeSenha({ code: "weak_password", reasons: ["length"], message: "Password should be at least 8 characters." }))
      .toBe("A senha precisa ter pelo menos 8 caracteres.");
  });

  it("mantém outras mensagens", () => {
    expect(mensagemDoErroDeSenha(new Error("User already registered"))).toBe("User already registered");
  });
});
