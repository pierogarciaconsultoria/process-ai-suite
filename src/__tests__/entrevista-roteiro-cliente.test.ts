import { describe, expect, it } from "vitest";
import { emptyProcessoForm } from "@/data/processo-form-types";
import {
  historicoParaPeter,
  mapaVeioDoAnexo,
  mensagensDoTurno,
  mesclarCampos,
  restaurarMensagens,
} from "@/lib/entrevista-roteiro";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import { iniciarRoteiro } from "../../supabase/functions/_shared/roteiro-engine";
import { iniciarTurno } from "../../supabase/functions/_shared/roteiro-peter";

describe("Entrevista guiada — cliente", () => {
  it("substitui listas e textos pelos valores completos devolvidos pelo Peter", () => {
    const form = {
      ...emptyProcessoForm,
      area: "Compras",
      etapas: [{ ordem: 1, atividade: "Antiga", responsavel: "X", ferramentaDocumento: "" }],
    };
    const proximo = mesclarCampos(form, {
      etapas: [
        { atividade: "Receber pedido", responsavel: "Comercial" },
        { atividade: "Aprovar pedido", responsavel: "Gerente", ferramentaDocumento: "ERP" },
      ],
      classificacao: "Apoio",
      problemas: { retrabalho: true, inexistente: true },
      objetivo: "Garantir a compra no prazo",
    });
    expect(proximo.etapas).toEqual([
      { ordem: 1, atividade: "Receber pedido", responsavel: "Comercial", ferramentaDocumento: "" },
      { ordem: 2, atividade: "Aprovar pedido", responsavel: "Gerente", ferramentaDocumento: "ERP" },
    ]);
    expect(proximo.classificacao).toBe("Apoio");
    expect(proximo.problemas).toEqual({ ...emptyProcessoForm.problemas, retrabalho: true });
    expect(proximo.objetivo).toBe("Garantir a compra no prazo");
    expect(proximo.area).toBe("Compras");
    expect(form.etapas[0].atividade).toBe("Antiga");
  });

  it("ignora campos desconhecidos e valores fora do domínio", () => {
    const proximo = mesclarCampos(emptyProcessoForm, { classificacao: "Primário", inventado: "x" } as never);
    expect(proximo).toEqual(emptyProcessoForm);
  });

  it("monta as mensagens do turno na ordem: análise, alerta, oportunidade, fala do Peter", () => {
    const turno = {
      ...iniciarTurno(ROTEIRO_PADRAO, iniciarRoteiro(ROTEIRO_PADRAO)),
      alerta: "Aprovação sem substituto",
      oportunidade: "Automatizar o envio",
    };
    expect(mensagensDoTurno(turno).map((mensagem) => mensagem.tipo ?? "fala")).toEqual(["alerta", "oportunidade", "fala"]);
  });

  it("envia ao Peter só a conversa e restaura apenas mensagens válidas", () => {
    const mensagens = restaurarMensagens([
      { role: "assistant", content: "Pergunta" },
      { role: "user", content: "Resposta" },
      { role: "assistant", tipo: "alerta", content: "Atenção" },
      { role: "assistant", tipo: "analise", acao: "diagnostico_as_is", content: "{}" },
      { role: "system", content: "metadados" },
      { role: "user", content: 42 },
    ]);
    expect(mensagens).toHaveLength(4);
    expect(mensagens[3]).toEqual({ role: "assistant", tipo: "analise", acao: "diagnostico_as_is", content: "{}" });
    expect(mapaVeioDoAnexo(mensagens)).toBe(false);
    const comMapa = restaurarMensagens([{ role: "user", content: "📎 compras.bpmn (Diagrama BPMN)", mapaAnexado: true }, { role: "user", content: "x", mapaAnexado: "sim" }]);
    expect(comMapa).toEqual([{ role: "user", content: "📎 compras.bpmn (Diagrama BPMN)", mapaAnexado: true }, { role: "user", content: "x" }]);
    expect(mapaVeioDoAnexo(comMapa)).toBe(true);
    expect(historicoParaPeter(comMapa)[0]).toEqual({ role: "user", content: "📎 compras.bpmn (Diagrama BPMN)" });
    expect(historicoParaPeter(mensagens)).toEqual([
      { role: "assistant", content: "Pergunta" },
      { role: "user", content: "Resposta" },
    ]);
  });
});
