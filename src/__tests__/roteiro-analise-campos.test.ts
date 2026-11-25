import { describe, expect, it } from "vitest";
import { camposDoDiagnostico, camposDoPlano, normalizarDiagnostico, normalizarPlano } from "../../supabase/functions/_shared/roteiro-analise";
import { mesclarCampos } from "@/lib/entrevista-roteiro";
import { emptyProcessoForm } from "@/data/processo-form-types";
import { deriveCriticidade } from "@/lib/processos";

describe("campos do formulário vindos das análises", () => {
  it("riscos avaliados no diagnóstico preenchem a matriz e definem a criticidade", () => {
    const diagnostico = normalizarDiagnostico({
      resumo: "x",
      maturidade: { nivel: "Inicial", justificativa: "" },
      achados: [{ prioridade: "critico", descricao: "Erro de separação", impacto: "", causaProvavel: "Códigos parecidos", porques: ["Por que erra? Porque os códigos são parecidos."], fundamento: "" }],
      riscosIso: [
        { risco: "Separação errada", evidencia: "frequente", consequencia: "Material errado no cliente", probabilidade: 4, impacto: 4 },
        { risco: "Sem nota", evidencia: "", consequencia: "", probabilidade: 9, impacto: 2 },
      ],
    })!;
    expect(diagnostico.achados[0].porques).toHaveLength(1);
    const form = mesclarCampos(emptyProcessoForm, camposDoDiagnostico(diagnostico));
    expect(form.riscos).toEqual([{ risco: "Separação errada", consequencia: "Material errado no cliente", probabilidade: 4, impacto: 4 }]);
    expect(deriveCriticidade(form.riscos)).toBe("Crítica");
  });

  it("diagnóstico antigo, sem notas, não mexe nos riscos", () => {
    const diagnostico = normalizarDiagnostico({ resumo: "x", maturidade: { nivel: "Inicial" }, riscosIso: [{ risco: "a", evidencia: "b" }] })!;
    expect(camposDoDiagnostico(diagnostico)).toEqual({});
    expect(diagnostico.achados).toEqual([]);
  });

  it("indicadores do plano preenchem os indicadores do formulário", () => {
    const plano = normalizarPlano({
      resumoToBe: "x",
      melhorias: [],
      planoAcao: [],
      indicadores: [{ nome: "Erros de separação", formula: "erros ÷ requisições × 100", sentido: "menor", meta: "[a definir]", periodicidade: "Mensal", responsavel: "Conferente", motivo: "Reduzir retrabalho" }],
    })!;
    const form = mesclarCampos(emptyProcessoForm, camposDoPlano(plano));
    expect(form.indicadores).toEqual([{ nome: "Erros de separação", objetivo: "Reduzir retrabalho", formulaCalculo: "erros ÷ requisições × 100", meta: "[a definir]", periodicidade: "Mensal", responsavel: "Conferente" }]);
  });
});
