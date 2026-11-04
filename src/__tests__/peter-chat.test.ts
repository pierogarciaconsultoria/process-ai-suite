import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  escolherRelevantes,
  lerRespostaChat,
  promptChat,
  SCHEMA_CHAT,
  sanitizarHistoricoChat,
  textoDoContexto,
  tituloDaConversa,
  type ContextoEmpresa,
} from "../../supabase/functions/_shared/peter-chat";
import { blocosDoMarkdown } from "@/lib/markdown-simples";

const persona = { identidade: "Você é o Peter.", regras: "", orientacoesEmpresa: "" };

function contexto(): ContextoEmpresa {
  return {
    hoje: "2026-11-04",
    processos: [
      { id: "p-coopera", nome: "COOPERA - Pós-vendas - AS IS", area: "Pós-vendas", dono: "Ludimila", status: "Implementado", objetivo: "Atender o cliente", atualizadoEm: "" },
      { id: "p-compras", nome: "Compras", area: "Suprimentos", dono: "", status: "Em entrevista", objetivo: "", atualizadoEm: "" },
    ],
    documentos: [{ id: "d1", codigo: "PR-001", titulo: "Procedimento de pós-vendas", tipo: "Procedimento", status: "Publicado", revisao: "Rev.01", processoId: "p-coopera" }],
    acoes: [
      { id: "a1", oque: "Configurar cotação no ERP", quem: "", prazo: "2026-10-31", quandoTexto: "", status: "Em andamento", processoId: "p-compras", origem: "plano_processo" },
      { id: "a2", oque: "Treinar equipe", quem: "Ana", prazo: "2026-10-01", quandoTexto: "", status: "Concluída", processoId: null, origem: "manual" },
    ],
    indicadores: [{ id: "i1", nome: "Reclamações resolvidas", processoId: "p-coopera", meta: "≥ 90 %", responsavel: "Ludimila", resultados: [{ periodo: "2026-10", valor: "85", situacao: "fora da meta" }] }],
    conteudos: [{ documentoId: "d1", texto: "1. Objetivo\nAtender reclamações em até 2 dias." }],
    detalhes: [],
  };
}

describe("Chat do Peter", () => {
  it("escolhe os processos e documentos mais ligados à pergunta", () => {
    const { processos, documentos } = contexto();
    expect(escolherRelevantes("Como funciona o processo de compras?", processos, documentos)).toEqual({ processos: ["p-compras"], documentos: [] });
    expect(escolherRelevantes("o que diz o PR-001?", processos, documentos).documentos).toEqual(["d1"]);
    expect(escolherRelevantes("bom dia", processos, documentos)).toEqual({ processos: [], documentos: [] });
  });

  it("manda os dados com referências curtas e o atraso já calculado", () => {
    const texto = textoDoContexto(contexto());
    expect(texto).toContain("HOJE: 2026-11-04");
    expect(texto).toContain("P1: COOPERA - Pós-vendas - AS IS | área: Pós-vendas | dono: Ludimila | status: Implementado");
    expect(texto).toContain("A1: Configurar cotação no ERP | quem: [a definir] | prazo: 2026-10-31 | status: Em andamento (ATRASADA) | processo: P2");
    expect(texto).toContain("A2: Treinar equipe | quem: Ana | prazo: 2026-10-01 | status: Concluída | processo: -");
    expect(texto).toContain("I1: Reclamações resolvidas | meta: ≥ 90 % | responsável: Ludimila | processo: P1 | resultados: 2026-10 = 85 (fora da meta)");
    expect(texto).toContain("## CONTEÚDO DE D1\n1. Objetivo");
  });

  it("instrui a não inventar, só consultar e convidar a mapear quando faz sentido", () => {
    const primeira = promptChat(persona, contexto(), true);
    expect(primeira).toContain("Nunca invente processo, documento, ação, indicador, número, nome ou data.");
    expect(primeira).toContain("Você só consulta.");
    expect(primeira).toContain('nesta resposta (é a primeira da conversa) e quando o assunto for um processo que não está na lista');
    expect(promptChat(persona, contexto(), false)).not.toContain("é a primeira da conversa");
    expect(SCHEMA_CHAT.required).toEqual(["resposta", "atalhos", "convidarMapear"]);
  });

  it("só aceita atalhos que existem nos dados e lê o convite", () => {
    const resposta = lerRespostaChat({
      resposta: "A ação **Configurar cotação no ERP** está atrasada.",
      atalhos: [{ ref: "a1", rotulo: "Abrir a ação" }, { ref: "P9", rotulo: "Inventado" }, { ref: "PLANO", rotulo: "" }, { ref: "A1", rotulo: "Repetido" }],
      convidarMapear: { ativo: true, nomeProcesso: "Compras" },
    }, contexto());
    expect(resposta.atalhos).toEqual([
      { tipo: "acao", id: "a1", rotulo: "Abrir a ação" },
      { tipo: "plano_de_acao", id: null, rotulo: "Abrir Plano de Ação" },
    ]);
    expect(resposta.convite).toEqual({ nomeProcesso: "Compras" });
    expect(lerRespostaChat({ resposta: "", atalhos: [], convidarMapear: { ativo: false, nomeProcesso: "" } }, contexto()))
      .toMatchObject({ convite: null, resposta: expect.stringContaining("Não consegui montar uma resposta") });
  });

  it("monta o título e limita o histórico", () => {
    expect(tituloDaConversa("  Quais   ações estão atrasadas? ")).toBe("Quais ações estão atrasadas?");
    expect(tituloDaConversa("x".repeat(80))).toHaveLength(58);
    const historico = sanitizarHistoricoChat(Array.from({ length: 20 }, (_, indice) => ({ role: indice % 2 ? "assistant" : "user", conteudo: `m${indice}` })).concat([{ role: "system", conteudo: "x" } as never]));
    expect(historico).toHaveLength(12);
    expect(historico.at(-1)).toEqual({ role: "assistant", content: "m19" });
  });

  it("quebra o markdown simples em parágrafos e listas", () => {
    expect(blocosDoMarkdown("Ações atrasadas:\n- **Cotar** no ERP\n- Treinar\n\n1. Primeiro\n2) Segundo\n### Próximos passos")).toEqual([
      { tipo: "p", texto: "Ações atrasadas:" },
      { tipo: "ul", itens: ["**Cotar** no ERP", "Treinar"] },
      { tipo: "ol", itens: ["Primeiro", "Segundo"] },
      { tipo: "titulo", texto: "Próximos passos" },
    ]);
  });

  it("grava pergunta e resposta com as mesmas colunas (inserção múltipla não usa o valor padrão)", () => {
    const funcao = readFileSync(resolve(process.cwd(), "supabase/functions/ai-peter-chat/index.ts"), "utf8");
    expect(funcao).toContain('role: "user", conteudo: mensagem, extras: {} }');
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202611040004_conversas_peter_extras.sql"), "utf8");
    expect(migration).toContain("new.extras := coalesce(new.extras, '{}'::jsonb);");
  });
});
