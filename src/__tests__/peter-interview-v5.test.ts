import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { emptyProcessoForm } from "@/data/processo-form-types";
import {
  clampEtapa,
  criarMensagemMetadados,
  normalizarResposta,
  restaurarMetadados,
} from "../../supabase/functions/_shared/peter-interview-contract";
import {
  CAMPOS_POR_ETAPA,
  combinarModo,
  extrairCamposPorEtapa,
  interpretarSelecaoModo,
} from "@/lib/peter-interview-state";

describe("Peter v5 — contrato da entrevista", () => {
  it("não aplica partialUpdate quando a resposta é inválida", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/EntrevistaProcesso.tsx"), "utf8");
    const guards = source.match(/response\.isValid === false/g) ?? [];
    expect(guards).toHaveLength(2);
    expect(source.indexOf("response.isValid === false")).toBeLessThan(source.indexOf("mergeFormUpdate(currentForm, response.partialUpdate"));
    expect(source.lastIndexOf("response.isValid === false")).toBeLessThan(source.indexOf("mergeFormUpdate(form, response.partialUpdate"));
  });

  it("limita etapas e impede conclusão fora da confirmação final", () => {
    expect(clampEtapa(99, 1)).toBe(6);
    const response = normalizarResposta({ done: true, etapa_atual: 6, etapa_confirmada: true }, 5, false);
    expect(response.done).toBe(false);
    expect(response.etapa_confirmada).toBe(false);
  });

  it("restaura apenas metadados íntegros", () => {
    const valid = criarMensagemMetadados({
      _tipo: "metadados_peter_v5",
      etapa_atual: 3,
      modo_entrada: "misto",
      aguardando_confirmacao: false,
      stage: "aiFlow",
      conteudo_pendente: "",
      atualizado_em: new Date().toISOString(),
    });
    expect(restaurarMetadados([valid])?.etapa_atual).toBe(3);
    const onboarding = criarMensagemMetadados({
      ...JSON.parse(valid.content),
      stage: "askArea",
    });
    expect(restaurarMetadados([onboarding])?.stage).toBe("askArea");
    expect(restaurarMetadados([{ ...valid, content: JSON.stringify({ _tipo: "x", etapa_atual: 9 }) }])).toBeNull();
  });

  it("usa nomes reais e faz parsing por etapa", () => {
    expect(CAMPOS_POR_ETAPA[3]).toContain("etapas");
    expect(CAMPOS_POR_ETAPA[6]).toContain("oportunidadesMelhoria");
    expect(extrairCamposPorEtapa("Solicitação do cliente", 2, emptyProcessoForm)).toEqual({ gatilho: "Solicitação do cliente" });
    const formComGatilho = { ...emptyProcessoForm, gatilho: "Pedido recebido" };
    expect(extrairCamposPorEtapa("Cliente - Pedido", 2, formComGatilho).entradas).toEqual([
      { fornecedor: "Cliente", entrada: "Pedido" },
    ]);
  });

  it("interpreta e combina fontes de entrada", () => {
    expect(interpretarSelecaoModo("entrevista")?.modo).toBe("entrevista");
    expect(combinarModo("texto_livre", "anexo")).toBe("misto");
  });
});
