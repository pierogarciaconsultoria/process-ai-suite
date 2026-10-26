import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  DiagnosticoRoteiro,
  PlanoMelhoriaRoteiro,
  PrioridadeAchado,
} from "../../../supabase/functions/_shared/roteiro-analise";

const PRIORIDADES: Array<{ chave: PrioridadeAchado; titulo: string; classe: string }> = [
  { chave: "critico", titulo: "🔴 Crítico", classe: "border-red-300 bg-red-50 text-red-900" },
  { chave: "relevante", titulo: "🟡 Relevante", classe: "border-amber-300 bg-amber-50 text-amber-900" },
  { chave: "oportunidade", titulo: "🟢 Oportunidade", classe: "border-emerald-300 bg-emerald-50 text-emerald-900" },
];

// `junto`: mantém título e conteúdo na mesma página do PDF.
function Secao({ titulo, junto = false, children }: { titulo: string; junto?: boolean; children: React.ReactNode }) {
  return (
    <section className={`space-y-2 ${junto ? "print:break-inside-avoid" : ""}`}>
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {itens.map((item, indice) => <li key={indice}>{item}</li>)}
    </ul>
  );
}

export function DiagnosticoView({ diagnostico }: { diagnostico: DiagnosticoRoteiro }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Maturidade do processo:</span>
        <Badge>{diagnostico.maturidade.nivel}</Badge>
      </div>
      <p className="text-sm leading-6">{diagnostico.resumo}</p>

      {diagnostico.pontosFortes.length > 0 && (
        <Secao titulo="Pontos fortes"><Lista itens={diagnostico.pontosFortes} /></Secao>
      )}

      {diagnostico.achados.length > 0 && (
        <Secao titulo="Achados">
          <div className="space-y-2">
            {PRIORIDADES.flatMap(({ chave, titulo, classe }) =>
              diagnostico.achados
                .filter((achado) => achado.prioridade === chave)
                .map((achado, indice) => (
                  <div key={`${chave}-${indice}`} className={`rounded-md border p-3 text-sm print:break-inside-avoid ${classe}`}>
                    <div className="font-medium">{titulo} — {achado.descricao}</div>
                    {achado.impacto && <div className="mt-1">Impacto: {achado.impacto}</div>}
                    {achado.causaProvavel && <div>Causa provável: {achado.causaProvavel}</div>}
                    {achado.fundamento && <div className="mt-1 text-xs opacity-80">Fundamento: {achado.fundamento}</div>}
                  </div>
                )),
            )}
          </div>
        </Secao>
      )}

      {diagnostico.desperdiciosLean.length > 0 && (
        <Secao titulo="Desperdícios (Lean)">
          <Lista itens={diagnostico.desperdiciosLean.map((item) => `${item.tipo}: ${item.evidencia}`)} />
        </Secao>
      )}

      {diagnostico.riscosIso.length > 0 && (
        <Secao titulo="Riscos (ISO 9001)">
          <Lista itens={diagnostico.riscosIso.map((item) => (item.evidencia ? `${item.risco} — ${item.evidencia}` : item.risco))} />
        </Secao>
      )}

      {diagnostico.maturidade.justificativa && (
        <Secao titulo={`Por que "${diagnostico.maturidade.nivel}"`}>
          <p className="text-sm leading-6">{diagnostico.maturidade.justificativa}</p>
        </Secao>
      )}

      {diagnostico.lacunas.length > 0 && (
        <Secao titulo="❓ Informações que faltaram">
          <Lista itens={diagnostico.lacunas} />
        </Secao>
      )}
    </div>
  );
}

export function PlanoView({ plano }: { plano: PlanoMelhoriaRoteiro }) {
  return (
    <div className="space-y-5">
      {plano.resumoToBe && (
        <Secao titulo="Processo otimizado (TO BE)">
          <p className="text-sm leading-6">{plano.resumoToBe}</p>
        </Secao>
      )}

      {plano.melhorias.length > 0 && (
        <Secao titulo="Melhorias propostas">
          <div className="space-y-2">
            {plano.melhorias.map((melhoria, indice) => (
              <div key={indice} className="rounded-md border p-3 text-sm print:break-inside-avoid">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {melhoria.titulo}
                  <Badge variant={melhoria.prioridade === "Alta" ? "default" : "secondary"}>{melhoria.prioridade}</Badge>
                </div>
                {melhoria.problema && <div className="mt-1 text-muted-foreground">Problema: {melhoria.problema}</div>}
                {melhoria.solucao && <div>Solução: {melhoria.solucao}</div>}
                {melhoria.beneficio && <div>Benefício: {melhoria.beneficio}</div>}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {plano.planoAcao.length > 0 && (
        <Secao titulo="Plano de ação (5W2H)" junto>
          <div className="overflow-x-auto rounded-md border print:overflow-visible">
            <Table className="min-w-[720px] text-xs print:min-w-0">
              <TableHeader>
                <TableRow>
                  <TableHead>O quê</TableHead>
                  <TableHead>Por quê</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead>Onde</TableHead>
                  <TableHead>Como</TableHead>
                  <TableHead>Quanto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plano.planoAcao.map((acao, indice) => (
                  <TableRow key={indice} className="print:break-inside-avoid">
                    <TableCell className="font-medium">{acao.oque}</TableCell>
                    <TableCell>{acao.porque}</TableCell>
                    <TableCell>{acao.quem}</TableCell>
                    <TableCell>{acao.quando}</TableCell>
                    <TableCell>{acao.onde}</TableCell>
                    <TableCell>{acao.como}</TableCell>
                    <TableCell>{acao.custo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Secao>
      )}
    </div>
  );
}
