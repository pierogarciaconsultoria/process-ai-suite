import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/relatorio/MapaBpmnImagem", () => ({ MapaBpmnImagem: () => <div>mapa</div> }));

import { RelatorioProcesso } from "@/components/relatorio/RelatorioProcesso";
import type { RelatorioProcesso as Relatorio } from "@/lib/relatorio-processo";

function relatorio(sipoc: Relatorio["sipoc"]): Relatorio {
  return {
    nome: "Pós vendas", area: "", dono: "", entrevistados: "", dataMapeamento: "", status: "", revisao: "", objetivo: "",
    ficha: [], sipoc, atividades: [], fluxo: [], medicao: [], indicadores: [], diagnostico: null, plano: null,
    lacunas: [], proximosPassos: [], bpmnAsIs: "", entrevista: null,
  };
}

describe("SIPOC do relatório", () => {
  it("põe cada fornecedor na linha da sua entrada e cada saída na linha do seu cliente", () => {
    render(<RelatorioProcesso relatorio={relatorio({
      inicio: "Pedido de venda liberado",
      entradas: [{ fornecedor: "Vendedor", entrada: "Pedido de venda" }, { fornecedor: "Comercial", entrada: "Prioridade" }],
      processo: ["Emitir o pedido", "Separar o material"],
      atividadesRestantes: 3,
      saidas: [{ saida: "Material separado", cliente: "Cliente externo" }],
    })} />);

    const linhas = within(screen.getByRole("table")).getAllByRole("row");
    expect(within(linhas[1]).getByText("Vendedor")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("Pedido de venda")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("Material separado")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("Cliente externo")).toBeInTheDocument();
    expect(within(linhas[2]).getByText("Comercial")).toBeInTheDocument();
    expect(within(linhas[2]).getByText("Prioridade")).toBeInTheDocument();
    expect(screen.getByText("Pedido de venda liberado")).toBeInTheDocument();
    expect(screen.getByText("+ 3 atividades no detalhamento do processo atual (AS IS).")).toBeInTheDocument();
  });

  it("mostra traço quando um lado não tem itens", () => {
    render(<RelatorioProcesso relatorio={relatorio({ inicio: "", entradas: [], processo: [], atividadesRestantes: 0, saidas: [] })} />);
    expect(within(screen.getByRole("table")).getAllByText("—")).toHaveLength(5);
  });
});
