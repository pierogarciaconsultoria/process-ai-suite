import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { resumirCarteira } from "@/lib/carteira";
import { EVENTO_EMPRESA_ATIVA, lerEmpresaAtiva, trocarEmpresaAtiva, useEmpresaAtiva } from "@/lib/empresa-ativa";

describe("Minhas empresas", () => {
  it("resume cada empresa e põe primeiro a que pede mais atenção", () => {
    const resumos = resumirCarteira({
      hoje: "2026-11-04",
      empresas: [{ id: "a", nome: "Alfa", segmento: null }, { id: "b", nome: "Beta", segmento: "Indústria" }, { id: "c", nome: "Gama", segmento: null }],
      processos: [
        { company_id: "a", status: "Implementado" }, { company_id: "a", status: "Em entrevista" },
        { company_id: "b", status: "Melhorias aprovadas" }, { company_id: "b", status: "Obsoleto" }, { company_id: "b", status: "Rascunho" },
      ],
      acoes: [
        { company_id: "b", status: "A fazer", prazo: "2026-10-01" }, { company_id: "b", status: "Em andamento", prazo: null },
        { company_id: "b", status: "Concluída", prazo: "2026-01-01" }, { company_id: "a", status: "A fazer", prazo: "2026-12-01" },
      ],
      indicadores: [
        { id: "i1", company_id: "b", meta: 95, sentido: "maior" }, { id: "i2", company_id: "b", meta: 2, sentido: "menor" },
        { id: "i3", company_id: "a", meta: 10, sentido: "maior" },
      ],
      medicoes: [
        { indicador_id: "i1", periodo: "2026-09-01", valor: 99 }, { indicador_id: "i1", periodo: "2026-10-01", valor: 90 },
        { indicador_id: "i2", periodo: "2026-10-01", valor: 1 },
      ],
      documentos: [{ company_id: "a", status: "Em aprovação" }, { company_id: "a", status: "Em revisão" }],
    });
    expect(resumos.map((item) => item.nome)).toEqual(["Beta", "Alfa", "Gama"]);
    expect(resumos[0]).toMatchObject({ processosMapeados: 1, emEntrevista: 1, acoesAbertas: 2, acoesAtrasadas: 1, indicadoresFora: 1, indicadoresSemResultado: 0, documentosPendentes: 0 });
    expect(resumos[1]).toMatchObject({ processosMapeados: 1, emEntrevista: 1, acoesAbertas: 1, acoesAtrasadas: 0, indicadoresFora: 0, indicadoresSemResultado: 1, documentosPendentes: 2 });
    expect(resumos[2]).toMatchObject({ atencao: 0 });
  });

  it("trocar a empresa ativa guarda a escolha e avisa as telas", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_EMPRESA_ATIVA, ouvinte);
    const { result } = renderHook(() => useEmpresaAtiva());
    act(() => trocarEmpresaAtiva("empresa-2", "Beta"));
    expect(lerEmpresaAtiva()).toBe("empresa-2");
    expect(window.localStorage.getItem("process:activeEmpresaNome")).toBe("Beta");
    expect(result.current).toBe("empresa-2");
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_EMPRESA_ATIVA, ouvinte);
  });
});
