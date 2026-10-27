import { describe, expect, it } from "vitest";
import {
  acoesDisponiveis,
  atualizacaoDaAcao,
  entrevistaEmAberto,
  normalizarStatus,
  podeGerarDocumentacao,
  promoverStatus,
  statusPelaEntrevista,
} from "@/lib/ciclo-processo";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import { iniciarRoteiro } from "../../supabase/functions/_shared/roteiro-engine";

describe("Ciclo de vida do processo", () => {
  it("converte os status antigos", () => {
    expect(normalizarStatus("Rascunho")).toBe("Em entrevista");
    expect(normalizarStatus("Em revisão")).toBe("Diagnosticado");
    expect(normalizarStatus("Aprovado")).toBe("Implementado");
    expect(normalizarStatus("Publicado")).toBe("Implementado");
    expect(normalizarStatus("Obsoleto")).toBe("Obsoleto");
    expect(normalizarStatus(null)).toBe("Em entrevista");
    expect(normalizarStatus("qualquer")).toBe("Em entrevista");
  });

  it("só avança, nunca regride, e não mexe em processo obsoleto", () => {
    expect(promoverStatus("Em entrevista", "Diagnosticado")).toBe("Diagnosticado");
    expect(promoverStatus("Implementado", "Diagnosticado")).toBe("Implementado");
    expect(promoverStatus("Obsoleto", "Melhorias aprovadas")).toBe("Obsoleto");
  });

  it("acompanha os marcos da entrevista: etapa 5 diagnostica, etapa 6 aprova as melhorias", () => {
    const base = iniciarRoteiro(ROTEIRO_PADRAO);
    expect(statusPelaEntrevista({ ...base, etapasConfirmadas: [1, 2, 3, 4] }, "Em entrevista")).toBe("Em entrevista");
    expect(statusPelaEntrevista({ ...base, etapasConfirmadas: [1, 2, 3, 4, 5] }, "Em entrevista")).toBe("Diagnosticado");
    expect(statusPelaEntrevista({ ...base, etapasConfirmadas: [1, 2, 3, 4, 5, 6] }, "Diagnosticado")).toBe("Melhorias aprovadas");
    expect(statusPelaEntrevista({ ...base, etapasConfirmadas: [1, 2, 3, 4, 5, 6] }, "Implementado")).toBe("Implementado");
  });

  it("libera documentação só para processo implementado, inclusive no status antigo", () => {
    expect(podeGerarDocumentacao("Implementado")).toBe(true);
    expect(podeGerarDocumentacao("Aprovado")).toBe(true);
    expect(podeGerarDocumentacao("Melhorias aprovadas")).toBe(false);
    expect(podeGerarDocumentacao(undefined)).toBe(false);
  });

  it("oferece as transições de cada status", () => {
    expect(acoesDisponiveis("Em entrevista")).toEqual([]);
    expect(acoesDisponiveis("Melhorias aprovadas")).toEqual(["implementar"]);
    expect(acoesDisponiveis("Implementado")).toEqual(["reabrir_implantacao", "tornar_obsoleto"]);
    expect(entrevistaEmAberto("Diagnosticado")).toBe(true);
    expect(entrevistaEmAberto("Melhorias aprovadas")).toBe(false);
  });

  it("grava as datas de cada transição", () => {
    const agora = "2026-10-27T12:00:00.000Z";
    expect(atualizacaoDaAcao("implementar", agora, null)).toEqual({ status: "Implementado", implementado_em: agora, mapa_aprovado_em: agora });
    expect(atualizacaoDaAcao("implementar", agora, "2026-01-01")).toMatchObject({ mapa_aprovado_em: "2026-01-01" });
    expect(atualizacaoDaAcao("reabrir_implantacao", agora, null)).toEqual({ status: "Melhorias aprovadas", implementado_em: null });
    expect(atualizacaoDaAcao("tornar_obsoleto", agora, null)).toEqual({ status: "Obsoleto", obsolete_at: agora });
  });
});
