import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, TrendingUp, Target, BarChart3, Lightbulb, ClipboardList, Activity } from "lucide-react";
import type { DiagnosticoResult } from "@/data/processo-form-types";

const severidadeBadge = (s: string) => {
  switch (s) {
    case "alto": return <Badge variant="destructive">Alto</Badge>;
    case "medio": return <Badge className="bg-warning text-warning-foreground">Médio</Badge>;
    default: return <Badge variant="secondary">Baixo</Badge>;
  }
};

const prioridadeBadge = (p: string) => {
  switch (p) {
    case "Alta": return <Badge variant="destructive">Alta</Badge>;
    case "Media": return <Badge className="bg-warning text-warning-foreground">Média</Badge>;
    default: return <Badge variant="secondary">Baixa</Badge>;
  }
};

const maturidadeLabel: Record<number, string> = {
  1: "Caótico",
  2: "Manual",
  3: "Padronizado",
  4: "Medido",
  5: "Otimizado",
};

const maturidadeDigitalBadge = (m: string) => {
  switch (m) {
    case "alta": return <Badge className="bg-success text-success-foreground">🟢 Alta</Badge>;
    case "media": return <Badge className="bg-warning text-warning-foreground">🟡 Média</Badge>;
    default: return <Badge variant="destructive">🔴 Baixa</Badge>;
  }
};

const classAtividadeBadge = (c: string) => {
  switch (c) {
    case "valor_agregado": return <Badge className="bg-success text-success-foreground">Valor</Badge>;
    case "suporte": return <Badge className="bg-info text-info-foreground">Suporte</Badge>;
    default: return <Badge variant="destructive">Desperdício</Badge>;
  }
};

const ProcessoDiagnostico = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const diagnostico = location.state?.diagnostico as DiagnosticoResult | undefined;

  if (!diagnostico) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/processos")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum diagnóstico disponível. Gere um diagnóstico a partir do formulário de processo.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { fase1, fase2, fase3, fase4, fase5, fase6, analiseFinal } = diagnostico;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diagnóstico do Processo</h1>
          <p className="text-muted-foreground">Análise completa em 6 fases</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>

      {/* Score e Maturidade - Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="text-3xl font-bold text-primary">{fase3.scoreProcesso}/100</div>
            <p className="text-sm text-muted-foreground mt-1">Score do Processo</p>
            <Progress value={fase3.scoreProcesso} className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="text-3xl font-bold text-foreground">{fase3.nivelMaturidade}/5</div>
            <p className="text-sm text-muted-foreground mt-1">{maturidadeLabel[fase3.nivelMaturidade]}</p>
            <Progress value={fase3.nivelMaturidade * 20} className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="mt-1">{maturidadeDigitalBadge(fase3.maturidadeDigital)}</div>
            <p className="text-sm text-muted-foreground mt-2">Maturidade Digital</p>
            <p className="text-xs text-muted-foreground mt-1">{fase3.descricaoMaturidadeDigital}</p>
          </CardContent>
        </Card>
      </div>

      {/* FASE 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Fase 1 — Mapeamento AS-IS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Resumo Executivo</h4>
            <p className="text-foreground">{fase1.resumoExecutivo}</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Descrição Ponta a Ponta</h4>
            <p className="text-foreground">{fase1.descricaoPontaAPonta}</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Principais Atores</h4>
            <div className="flex flex-wrap gap-2">
              {fase1.principaisAtores.map((a, i) => <Badge key={i} variant="outline">{a}</Badge>)}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Fluxo Lógico</h4>
            <p className="text-foreground whitespace-pre-line">{fase1.fluxoLogico}</p>
          </div>
        </CardContent>
      </Card>

      {/* FASE 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Fase 2 — Diagnóstico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-2">Problemas Identificados</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Problema</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Impacto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fase2.problemas.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.problema}</TableCell>
                    <TableCell><Badge variant="outline">{p.tipo}</Badge></TableCell>
                    <TableCell>{severidadeBadge(p.severidade)}</TableCell>
                    <TableCell className="text-sm">{p.impactoNegocio}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Gargalos</h4>
              <ul className="space-y-1">
                {fase2.principaisGargalos.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm"><XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />{g}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Retrabalho</h4>
              <ul className="space-y-1">
                {fase2.pontosRetrabalho.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FASE 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-destructive" />
            Fase 3 — Análise e Maturidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-2">Classificação das Atividades</h4>
            <div className="flex flex-wrap gap-2">
              {fase3.classificacaoAtividades.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm">
                  {classAtividadeBadge(a.classificacao)}
                  <span>{a.atividade}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{fase3.descricaoMaturidade}</p>
        </CardContent>
      </Card>

      {/* FASE 4 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-info" />
            Fase 4 — Oportunidades TO-BE
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Redução de tempo estimada</p>
              <p className="font-semibold text-foreground">{fase4.reducaoTempoEstimada}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Potencial de automação</p>
              <p className="font-semibold text-foreground">{fase4.potencialAutomacao}</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Problema</TableHead>
                <TableHead>Solução</TableHead>
                <TableHead>Tecnologia</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead>Complexidade</TableHead>
                <TableHead>Prioridade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fase4.melhorias.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{m.problemaIdentificado}</TableCell>
                  <TableCell className="text-sm">{m.solucaoProposta}</TableCell>
                  <TableCell><Badge variant="outline">{m.tipoTecnologia}</Badge></TableCell>
                  <TableCell className="text-sm">{m.impactoEsperado}</TableCell>
                  <TableCell><Badge variant="secondary">{m.complexidade}</Badge></TableCell>
                  <TableCell>{prioridadeBadge(m.prioridade)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* FASE 5 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Fase 5 — Plano de Ação 5W2H
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>O quê</TableHead>
                <TableHead>Por quê</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead>Onde</TableHead>
                <TableHead>Como</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Prioridade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fase5.acoes.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{a.oque}</TableCell>
                  <TableCell className="text-sm">{a.porque}</TableCell>
                  <TableCell className="text-sm">{a.quem}</TableCell>
                  <TableCell className="text-sm">{a.quando}</TableCell>
                  <TableCell className="text-sm">{a.onde}</TableCell>
                  <TableCell className="text-sm">{a.como}</TableCell>
                  <TableCell className="text-sm">{a.custo}</TableCell>
                  <TableCell>{prioridadeBadge(a.prioridade)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* FASE 6 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-warning" />
            Fase 6 — Indicadores (KPIs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Fórmula</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fase6.indicadores.map((ind, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{ind.nome}</TableCell>
                  <TableCell className="text-sm">{ind.objetivo}</TableCell>
                  <TableCell className="text-sm font-mono">{ind.formulaCalculo}</TableCell>
                  <TableCell className="text-sm">{ind.meta}</TableCell>
                  <TableCell className="text-sm">{ind.periodicidade}</TableCell>
                  <TableCell className="text-sm">{ind.responsavel}</TableCell>
                  <TableCell><Badge variant="outline">{ind.classificacao}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{ind.tipo}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ANÁLISE FINAL */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Análise Final
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Diagnóstico Geral</h4>
            <p className="text-foreground">{analiseFinal.diagnosticoGeral}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Top 5 Problemas Críticos</h4>
              <ol className="space-y-1 list-decimal list-inside">
                {analiseFinal.top5Problemas.map((p, i) => (
                  <li key={i} className="text-sm text-foreground">{p}</li>
                ))}
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Top 5 Oportunidades</h4>
              <ol className="space-y-1 list-decimal list-inside">
                {analiseFinal.top5Oportunidades.map((o, i) => (
                  <li key={i} className="text-sm text-foreground">{o}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-sm text-primary mb-1">Recomendação Estratégica</h4>
            <p className="text-foreground">{analiseFinal.recomendacaoEstrategica}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessoDiagnostico;
