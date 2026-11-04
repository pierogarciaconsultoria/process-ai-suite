import { Gauge, ListChecks, Pencil, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DiagnosticoView, PlanoView } from "@/components/entrevista/AnaliseRoteiro";
import { MapaBpmnImagem } from "@/components/relatorio/MapaBpmnImagem";
import type { SecaoEditavel } from "@/lib/edicao-processo";
import { formatarMeta, formatarValor, rotuloPeriodo, ROTULO_SITUACAO, situacao, type Indicador, type Medicao } from "@/lib/indicadores";
import { estaAtrasada, formatarPrazo, type Acao } from "@/lib/plano-de-acao";
import type { ItemRelatorio, RelatorioProcesso as Relatorio } from "@/lib/relatorio-processo";

function formatarData(data: string): string {
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T00:00:00`) : new Date(data);
  return Number.isNaN(valor.getTime()) ? data : valor.toLocaleDateString("pt-BR");
}

// Botão de edição da seção; some no PDF.
function BotaoEditar({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs font-normal print:hidden" onClick={onClick} aria-label={`Editar ${rotulo}`}>
      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
    </Button>
  );
}

// `junto`: seção curta que não deve ser partida entre páginas no PDF.
function Secao({ numero, titulo, junto = false, onEditar, children }: { numero: number; titulo: string; junto?: boolean; onEditar?: () => void; children: React.ReactNode }) {
  return (
    <section className={`space-y-3 ${junto ? "print:break-inside-avoid" : ""}`}>
      <div className="flex items-end justify-between gap-2 border-b pb-1 print:break-after-avoid">
        <h2 className="text-lg font-semibold text-foreground">
          <span className="mr-2 text-muted-foreground">{numero}.</span>{titulo}
        </h2>
        {onEditar && <BotaoEditar rotulo={titulo} onClick={onEditar} />}
      </div>
      {children}
    </section>
  );
}

function NaoInformado({ texto = "Não informado." }: { texto?: string }) {
  return <p className="text-sm text-muted-foreground">{texto}</p>;
}

function Itens({ itens }: { itens: ItemRelatorio[] }) {
  if (itens.length === 0) return <NaoInformado />;
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
      {itens.map((item) => (
        <div key={item.rotulo} className="contents">
          <dt className="font-medium text-foreground">{item.rotulo}</dt>
          <dd className="text-muted-foreground print:text-foreground">{item.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

const COLUNAS_SIPOC = [
  { letra: "S", titulo: "Fornecedores" },
  { letra: "I", titulo: "Entradas" },
  { letra: "P", titulo: "Processo" },
  { letra: "O", titulo: "Saídas" },
  { letra: "C", titulo: "Clientes" },
];

// A faixa colorida do cabeçalho também sai no PDF.
const IMPRIMIR_CORES = "[-webkit-print-color-adjust:exact] [print-color-adjust:exact]";
const CELULA_SIPOC = "border border-border px-3 py-2 align-top";

function Traco() {
  return <span className="text-muted-foreground">—</span>;
}

function ProcessoSipoc({ sipoc }: { sipoc: Relatorio["sipoc"] }) {
  return (
    <div className="space-y-2">
      {sipoc.inicio && (
        <p><span className="font-semibold">Início:</span> {sipoc.inicio}</p>
      )}
      {sipoc.processo.length > 0 ? (
        <ol className="list-decimal space-y-1 pl-4">
          {sipoc.processo.map((atividade, indice) => <li key={indice}>{atividade}</li>)}
        </ol>
      ) : (
        !sipoc.inicio && <Traco />
      )}
      {sipoc.atividadesRestantes > 0 && (
        <p className="text-muted-foreground print:text-foreground">
          + {sipoc.atividadesRestantes} atividade{sipoc.atividadesRestantes > 1 ? "s" : ""} no detalhamento do processo atual (AS IS).
        </p>
      )}
    </div>
  );
}

// Célula de um lado do SIPOC (S/I ou O/C). Abaixo do último item desse lado não há linhas
// horizontais: o item continua visualmente até o fim da tabela.
function CelulaLado({ indice, total, children, className = "" }: { indice: number; total: number; children: React.ReactNode; className?: string }) {
  const ultimo = Math.max(total, 1) - 1;
  const bordas = indice > ultimo ? "border-y-0" : indice === ultimo ? "border-b-0" : "";
  return <td className={`${CELULA_SIPOC} ${bordas} ${className}`}>{indice > ultimo ? null : children}</td>;
}

// Cada linha liga o fornecedor à entrada que ele fornece e a saída ao cliente que a recebe;
// a coluna Processo ocupa todas as linhas. As linhas de itens ficam com a altura do conteúdo
// (height: 1px) e a última linha, vazia, absorve a altura que sobra da coluna Processo.
function TabelaSipoc({ sipoc }: { sipoc: Relatorio["sipoc"] }) {
  const linhas = Math.max(sipoc.entradas.length, sipoc.saidas.length, 1);
  const nEntradas = sipoc.entradas.length;
  const nSaidas = sipoc.saidas.length;
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className={`w-full min-w-[680px] border-collapse border border-border text-xs leading-5 print:min-w-0 ${IMPRIMIR_CORES}`}>
        <colgroup>
          <col className="w-[17%]" />
          <col className="w-[18%]" />
          <col className="w-[30%]" />
          <col className="w-[18%]" />
          <col className="w-[17%]" />
        </colgroup>
        <thead>
          <tr>
            {COLUNAS_SIPOC.map((coluna) => (
              <th key={coluna.letra} scope="col" className="border border-primary bg-primary px-3 py-2 text-left font-normal text-primary-foreground">
                <span className="block text-lg font-bold leading-none">{coluna.letra}</span>
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider">{coluna.titulo}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: linhas }, (_, indice) => {
            const entrada = sipoc.entradas[indice];
            const saida = sipoc.saidas[indice];
            return (
              <tr key={indice} className="h-px print:break-inside-avoid">
                <CelulaLado indice={indice} total={nEntradas}>{entrada?.fornecedor || <Traco />}</CelulaLado>
                <CelulaLado indice={indice} total={nEntradas} className="font-medium">{entrada?.entrada || <Traco />}</CelulaLado>
                {indice === 0 && (
                  <td rowSpan={linhas + 1} className={`${CELULA_SIPOC} bg-muted/40`}>
                    <ProcessoSipoc sipoc={sipoc} />
                  </td>
                )}
                <CelulaLado indice={indice} total={nSaidas} className="font-medium">{saida?.saida || <Traco />}</CelulaLado>
                <CelulaLado indice={indice} total={nSaidas}>{saida?.cliente || <Traco />}</CelulaLado>
              </tr>
            );
          })}
          <tr aria-hidden="true">
            {[0, 1].map((coluna) => <td key={coluna} className="border-x border-y-0 border-border p-0" />)}
            {[3, 4].map((coluna) => <td key={coluna} className="border-x border-y-0 border-border p-0" />)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Com `onEditar`, cada seção ganha o botão Editar (página do processo); sem ele, o relatório é só leitura.
// Execução do plano: as ações que já estão no Plano de Ação, com status e prazo.
function ExecucaoDoPlano({ acoes }: { acoes: Acao[] }) {
  return (
    <div className="space-y-2 print:break-inside-avoid">
      <h3 className="text-sm font-semibold text-foreground">Execução do plano de ação</h3>
      <div className="overflow-x-auto rounded-md border print:overflow-visible">
        <Table className="min-w-[560px] text-xs print:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead>O quê</TableHead>
              <TableHead>Quem</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {acoes.map((acao) => (
              <TableRow key={acao.id} className="print:break-inside-avoid">
                <TableCell className="font-medium">{acao.oque}</TableCell>
                <TableCell>{acao.quem || "[a definir]"}</TableCell>
                <TableCell className={estaAtrasada(acao) ? "font-medium text-destructive" : ""}>
                  {formatarPrazo(acao)}{estaAtrasada(acao) ? " (atrasada)" : ""}
                </TableCell>
                <TableCell>{acao.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export type IndicadorAcompanhado = { indicador: Indicador; ultima?: Medicao };

// Indicadores acompanhados no módulo Indicadores, com o último resultado lançado.
function IndicadoresAcompanhados({ itens }: { itens: IndicadorAcompanhado[] }) {
  return (
    <div className="overflow-x-auto rounded-md border print:overflow-visible">
      <Table className="min-w-[620px] text-xs print:min-w-0">
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead>Fórmula</TableHead>
            <TableHead>Meta</TableHead>
            <TableHead>Último resultado</TableHead>
            <TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map(({ indicador, ultima }) => (
            <TableRow key={indicador.id} className="print:break-inside-avoid">
              <TableCell className="font-medium">{indicador.nome}</TableCell>
              <TableCell>{indicador.formula || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{formatarMeta(indicador)}</TableCell>
              <TableCell className="whitespace-nowrap">{ultima ? `${formatarValor(ultima.valor, indicador.unidade)} (${rotuloPeriodo(ultima.periodo)})` : "—"}</TableCell>
              <TableCell>{ROTULO_SITUACAO[situacao(indicador, ultima?.valor)]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Aviso para levar ao módulo o que ainda está só no mapeamento, ou abrir o módulo; some no PDF.
function AvisoModulo({ icone: Icone, pendentes, singular, plural, acompanhado, rotuloEnviar, rotuloAbrir, onEnviar, onAbrir }: {
  icone: typeof ListChecks; pendentes: number; singular: string; plural: string; acompanhado: string;
  rotuloEnviar: string; rotuloAbrir: string; onEnviar?: () => void; onAbrir?: () => void;
}) {
  if (!(onEnviar && pendentes > 0) && !onAbrir) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3 text-sm print:hidden">
      <Icone className="h-4 w-4 text-primary" aria-hidden />
      <span className="flex-1 text-muted-foreground">{pendentes > 0 ? (pendentes === 1 ? singular : plural.replace("{n}", String(pendentes))) : acompanhado}</span>
      {onEnviar && pendentes > 0 && <Button size="sm" onClick={onEnviar}>{rotuloEnviar}</Button>}
      {onAbrir && <Button size="sm" variant="outline" onClick={onAbrir}>{rotuloAbrir}</Button>}
    </div>
  );
}

// Com `onEditar`, cada seção ganha o botão Editar (página do processo); sem ele, o relatório é só leitura.
// Com `acoes`, o plano mostra a execução no Plano de Ação; `acoesPendentes` são as do 5W2H ainda não enviadas.
// O mesmo vale para `indicadores` (módulo Indicadores) e `indicadoresPendentes`.
export function RelatorioProcesso({
  relatorio,
  onEditar,
  onEditarMapa,
  acoes = [],
  acoesPendentes = 0,
  onEnviarAcoes,
  onAbrirPlanoDeAcao,
  indicadores = [],
  indicadoresPendentes = 0,
  onEnviarIndicadores,
  onAbrirIndicadores,
}: {
  relatorio: Relatorio;
  onEditar?: (secao: SecaoEditavel) => void;
  onEditarMapa?: () => void;
  acoes?: Acao[];
  acoesPendentes?: number;
  onEnviarAcoes?: () => void;
  onAbrirPlanoDeAcao?: () => void;
  indicadores?: IndicadorAcompanhado[];
  indicadoresPendentes?: number;
  onEnviarIndicadores?: () => void;
  onAbrirIndicadores?: () => void;
}) {
  const emExecucao = acoes.length > 0;
  const medido = indicadores.length > 0;
  let secao = 0;
  const proxima = () => ++secao;
  const editar = (alvo: SecaoEditavel) => (onEditar ? () => onEditar(alvo) : undefined);

  return (
    <article className="mx-auto max-w-4xl space-y-8 rounded-lg border bg-card p-5 sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <header className="space-y-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Relatório de diagnóstico do processo</div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{relatorio.nome}</h1>
          {relatorio.diagnostico && <Badge>Maturidade: {relatorio.diagnostico.maturidade.nivel}</Badge>}
          {onEditar && <div className="ml-auto"><BotaoEditar rotulo="dados do processo" onClick={() => onEditar("dados")} /></div>}
        </div>
        <Itens
          itens={[
            { rotulo: "Área", valor: relatorio.area },
            { rotulo: "Dono do processo", valor: relatorio.dono },
            { rotulo: "Entrevistado", valor: relatorio.entrevistados },
            { rotulo: "Data do mapeamento", valor: relatorio.dataMapeamento ? formatarData(relatorio.dataMapeamento) : "" },
            { rotulo: "Status", valor: [relatorio.status, relatorio.revisao].filter(Boolean).join(" · ") },
          ].filter((item) => item.valor)}
        />
        {relatorio.entrevista && !relatorio.entrevista.concluida && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Relatório parcial: a entrevista ainda está em andamento ({relatorio.entrevista.etapa}).
          </div>
        )}
      </header>

      <Secao numero={proxima()} titulo="Resumo executivo" junto onEditar={editar("dados")}>
        {relatorio.diagnostico ? <p className="text-sm leading-6">{relatorio.diagnostico.resumo}</p> : null}
        {relatorio.objetivo
          ? <p className="text-sm leading-6"><span className="font-medium">Objetivo do processo:</span> {relatorio.objetivo}</p>
          : <NaoInformado texto="Objetivo do processo não informado." />}
      </Secao>

      <Secao numero={proxima()} titulo="Identificação do processo" junto onEditar={editar("identificacao")}>
        <Itens itens={relatorio.ficha} />
      </Secao>

      <Secao numero={proxima()} titulo="SIPOC" junto onEditar={editar("sipoc")}>
        <p className="text-sm text-muted-foreground print:text-foreground">Fronteiras do processo: quem fornece, o que entra, o que é feito, o que sai e quem recebe.</p>
        <TabelaSipoc sipoc={relatorio.sipoc} />
      </Secao>

      <Secao numero={proxima()} titulo="Processo atual (AS IS)" onEditar={editar("atividades")}>
        {relatorio.atividades.length > 0 ? (
          <div className="overflow-x-auto rounded-md border print:overflow-visible">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Sistema / ferramenta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorio.atividades.map((atividade) => (
                  <TableRow key={atividade.ordem} className="print:break-inside-avoid">
                    <TableCell>{atividade.ordem}</TableCell>
                    <TableCell className="font-medium">{atividade.atividade}</TableCell>
                    <TableCell>{atividade.responsavel || "—"}</TableCell>
                    <TableCell>{atividade.ferramenta || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <NaoInformado texto="Atividades ainda não mapeadas." />
        )}
        {relatorio.fluxo.length > 0 && <Itens itens={relatorio.fluxo} />}
        <div className="space-y-3 print:break-inside-avoid">
          <div className="flex items-end justify-between gap-2 pt-2">
            <h3 className="text-sm font-semibold text-foreground">Mapa do processo (BPMN)</h3>
            {onEditarMapa && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs font-normal print:hidden" onClick={onEditarMapa}>
                <Workflow className="mr-1 h-3.5 w-3.5" /> Editar mapa
              </Button>
            )}
          </div>
          {relatorio.bpmnAsIs ? <MapaBpmnImagem xml={relatorio.bpmnAsIs} /> : <NaoInformado texto="O mapa BPMN AS IS ainda não foi gerado." />}
        </div>
      </Secao>

      <Secao numero={proxima()} titulo="Medição e indicadores" onEditar={editar("medicao")}>
        <Itens itens={relatorio.medicao} />
        {medido && <IndicadoresAcompanhados itens={indicadores} />}
        <AvisoModulo
          icone={Gauge}
          pendentes={indicadoresPendentes}
          singular="1 indicador do mapeamento ainda não está em Indicadores, onde os resultados são lançados mês a mês."
          plural="{n} indicadores do mapeamento ainda não estão em Indicadores, onde os resultados são lançados mês a mês."
          acompanhado="Os resultados destes indicadores são lançados em Indicadores."
          rotuloEnviar="Acompanhar em Indicadores"
          rotuloAbrir="Abrir Indicadores"
          onEnviar={onEnviarIndicadores}
          onAbrir={medido ? onAbrirIndicadores : undefined}
        />
        {!medido && relatorio.indicadores.length > 0 && (
          <div className="overflow-x-auto rounded-md border print:overflow-visible">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead>Fórmula</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorio.indicadores.map((indicador, indice) => (
                  <TableRow key={indice} className="print:break-inside-avoid">
                    <TableCell className="font-medium">{indicador.nome}</TableCell>
                    <TableCell>{indicador.formulaCalculo || "—"}</TableCell>
                    <TableCell>{indicador.meta || "—"}</TableCell>
                    <TableCell>{indicador.periodicidade || "—"}</TableCell>
                    <TableCell>{indicador.responsavel || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Secao>

      <Secao numero={proxima()} titulo="Diagnóstico">
        {relatorio.diagnostico ? <DiagnosticoView diagnostico={relatorio.diagnostico} /> : <NaoInformado texto="O diagnóstico ainda não foi gerado." />}
      </Secao>

      <Secao numero={proxima()} titulo="Plano de melhoria" onEditar={relatorio.plano && !emExecucao ? editar("plano") : undefined}>
        {relatorio.plano ? <PlanoView plano={relatorio.plano} semPlanoAcao={emExecucao} /> : <NaoInformado texto="O plano de melhoria ainda não foi definido." />}
        {emExecucao && <ExecucaoDoPlano acoes={acoes} />}
        <AvisoModulo
          icone={ListChecks}
          pendentes={acoesPendentes}
          singular="1 ação do plano ainda não está no Plano de Ação, onde são acompanhadas até a conclusão."
          plural="{n} ações do plano ainda não estão no Plano de Ação, onde são acompanhadas até a conclusão."
          acompanhado="As ações deste plano são acompanhadas no Plano de Ação."
          rotuloEnviar="Enviar ao Plano de Ação"
          rotuloAbrir="Abrir Plano de Ação"
          onEnviar={onEnviarAcoes}
          onAbrir={emExecucao ? onAbrirPlanoDeAcao : undefined}
        />
      </Secao>

      {relatorio.proximosPassos.length > 0 && (
        <Secao numero={proxima()} titulo="Próximos passos" junto>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {relatorio.proximosPassos.map((passo, indice) => <li key={indice}>{passo}</li>)}
          </ol>
        </Secao>
      )}

      {relatorio.lacunas.length > 0 && (
        <Secao numero={proxima()} titulo="Informações pendentes">
          <p className="text-sm text-muted-foreground print:text-foreground">Pontos que não foram informados na entrevista e limitam a análise.</p>
          <ul className="space-y-1 text-sm">
            {relatorio.lacunas.map((lacuna) => <li key={lacuna}>❓ {lacuna}</li>)}
          </ul>
        </Secao>
      )}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Gerado em {new Date().toLocaleDateString("pt-BR")} a partir do mapeamento conduzido pelo Peter.
      </footer>
    </article>
  );
}
