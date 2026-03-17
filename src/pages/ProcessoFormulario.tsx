import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Plus, Trash2, Sparkles } from "lucide-react";
import { processos, processosFormMock } from "@/data/mock-processos";
import { aiFillFromObjective } from "@/lib/ai";
import { toast } from "@/hooks/use-toast";

const steps = [
  "Identificação",
  "Contexto",
  "Entradas",
  "Etapas",
  "Decisões",
  "Saídas",
  "Problemas",
  "Riscos",
  "Indicadores",
  "Melhoria",
];

interface Etapa {
  ordem: number;
  atividade: string;
  responsavel: string;
  sistema: string;
}

interface Risco {
  risco: string;
  impacto: string;
  probabilidade?: number;
  severidade?: number;
  categoria?: string;
  responsavel?: string;
  prazo?: string;
  plano?: string;
  status?: string;
}

const ProcessoFormulario = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const fromMock = id ? processos.find((p) => p.id === id) ?? {} : {};
  const formMock = id ? processosFormMock[id] ?? undefined : undefined;
  const initial = { ...(fromMock as { nome?: string; area?: string; responsavel?: string }), ...((location.state as { nome?: string; area?: string; responsavel?: string } | undefined) ?? {}) };

  const [nome, setNome] = useState(initial.nome ?? "");
  const [area, setArea] = useState(initial.area ?? "");
  const [responsavel, setResponsavel] = useState(initial.responsavel ?? "");
  const [objetivo, setObjetivo] = useState(formMock?.objetivo ?? "");
  const [clienteProcesso, setClienteProcesso] = useState(formMock?.clienteProcesso ?? "");
  const [areasEnvolvidas, setAreasEnvolvidas] = useState(formMock?.areasEnvolvidas ?? "");
  const [entradas, setEntradas] = useState(formMock?.entradas ?? "");
  const [etapas, setEtapas] = useState<Etapa[]>(formMock?.etapas ?? [{ ordem: 1, atividade: "", responsavel: "", sistema: "" }]);
  const [decisoes, setDecisoes] = useState(formMock?.decisoes ?? "");
  const [saidas, setSaidas] = useState(formMock?.saidas ?? "");
  const [problemas, setProblemas] = useState(formMock?.problemas ?? { retrabalho: false, atrasos: false, erros: false, dependencia: false });
  const [problemasTexto, setProblemasTexto] = useState(formMock?.problemasTexto ?? "");
  const [riscos, setRiscos] = useState<Risco[]>(
    (formMock?.riscos ?? [{ risco: "", impacto: "" }]).map((r) => ({
      risco: r.risco ?? "",
      impacto: r.impacto ?? "",
      probabilidade: 3,
      severidade: 3,
      categoria: "",
      responsavel: "",
      prazo: "",
      plano: "",
      status: "Aberto",
    }))
  );
  const [indicadores, setIndicadores] = useState(formMock?.indicadores ?? "");
  const [sugestoes, setSugestoes] = useState(formMock?.sugestoes ?? "");
  const [loadingAI, setLoadingAI] = useState(false);

  const preencherComIA = async () => {
    if (!objetivo.trim()) {
      toast({ title: "Informe o objetivo", description: "Preencha o campo Objetivo do Processo para usar a IA." });
      return;
    }
    setLoadingAI(true);
    try {
      const data = await aiFillFromObjective(objetivo);
      setEntradas(data.entradas ?? "");
      setEtapas((data.etapas ?? []).map((e, i) => ({ ...e, ordem: i + 1 })));
      setDecisoes(data.decisoes ?? "");
      setSaidas(data.saidas ?? "");
      setProblemas(data.problemas ?? { retrabalho: false, atrasos: false, erros: false, dependencia: false });
      setProblemasTexto(data.problemasTexto ?? "");
      setRiscos(
        (data.riscos ?? []).length
          ? (data.riscos ?? []).map((r) => ({
              risco: r.risco ?? "",
              impacto: r.impacto ?? "",
              probabilidade: 3,
              severidade: 3,
              categoria: "",
              responsavel: "",
              prazo: "",
              plano: "",
              status: "Aberto",
            }))
          : [{ risco: "", impacto: "", probabilidade: 3, severidade: 3, categoria: "", responsavel: "", prazo: "", plano: "", status: "Aberto" }]
      );
      setIndicadores(data.indicadores ?? "");
      setSugestoes(data.sugestoes ?? "");
      toast({ title: "Campos preenchidos", description: "As abas foram atualizadas com sugestões da IA." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("OPENAI_API_KEY_NOT_CONFIGURED")) {
        const fallback = formMock ?? processosFormMock[id ?? ""] ?? undefined;
        if (fallback) {
          setEntradas(fallback.entradas);
          setEtapas(fallback.etapas.map((e, i) => ({ ...e, ordem: i + 1 })));
          setDecisoes(fallback.decisoes);
          setSaidas(fallback.saidas);
          setProblemas(fallback.problemas);
          setProblemasTexto(fallback.problemasTexto);
          setRiscos(fallback.riscos);
          setIndicadores(fallback.indicadores);
          setSugestoes(fallback.sugestoes);
          toast({ title: "Usando mock local", description: "Configure VITE_OPENAI_API_KEY para usar a IA por API." });
        } else {
          toast({ title: "Chave da OpenAI ausente", description: "Defina VITE_OPENAI_API_KEY no ambiente para habilitar a IA." });
        }
      } else {
        toast({ title: "Falha ao gerar com IA", description: "Tente novamente mais tarde." });
      }
    } finally {
      setLoadingAI(false);
    }
  };

  const addEtapa = () => setEtapas([...etapas, { ordem: etapas.length + 1, atividade: "", responsavel: "", sistema: "" }]);
  const removeEtapa = (i: number) => setEtapas(etapas.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, ordem: idx + 1 })));
  const updateEtapa = (i: number, field: keyof Etapa, value: string) => {
    const updated = [...etapas];
    updated[i] = { ...updated[i], [field]: value };
    setEtapas(updated);
  };

  const addRisco = () =>
    setRiscos([
      ...riscos,
      {
        risco: "",
        impacto: "",
        probabilidade: 3,
        severidade: 3,
        categoria: "",
        responsavel: "",
        prazo: "",
        plano: "",
        status: "Aberto",
      },
    ]);
  const removeRisco = (i: number) => setRiscos(riscos.filter((_, idx) => idx !== i));
  const updateRisco = (i: number, field: keyof Risco, value: string | number) => {
    const updated = [...riscos];
    updated[i] = { ...updated[i], [field]: value };
    setRiscos(updated);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Processo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Gestão de Vendas" />
            </div>
            <div className="space-y-2">
              <Label>Área Responsável</Label>
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex: Comercial" />
            </div>
            <div className="space-y-2">
              <Label>Responsável pelo Processo</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Ex: João Silva" />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Objetivo do Processo</Label>
              <Textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Descreva o objetivo principal do processo" />
            </div>
            <div className="space-y-2">
              <Label>Cliente do Processo</Label>
              <Input value={clienteProcesso} onChange={(e) => setClienteProcesso(e.target.value)} placeholder="Quem recebe o resultado do processo?" />
            </div>
            <div className="space-y-2">
              <Label>Áreas Envolvidas</Label>
              <Input value={areasEnvolvidas} onChange={(e) => setAreasEnvolvidas(e.target.value)} placeholder="Separe por vírgula" />
            </div>
            <div className="flex justify-end">
              <div className="flex gap-2">
              <Button onClick={preencherComIA} disabled={loadingAI} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {loadingAI ? "Gerando..." : "Preencher com IA"}
              </Button>
              
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Entradas do Processo</Label>
              <Textarea value={entradas} onChange={(e) => setEntradas(e.target.value)} placeholder="Quais informações ou documentos entram no processo?" rows={6} />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Etapas do Processo</Label>
              <Button variant="outline" size="sm" onClick={addEtapa}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Sistema</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {etapas.map((etapa, i) => (
                  <TableRow key={i}>
                    <TableCell>{etapa.ordem}</TableCell>
                    <TableCell>
                      <Input value={etapa.atividade} onChange={(e) => updateEtapa(i, "atividade", e.target.value)} placeholder="Atividade" />
                    </TableCell>
                    <TableCell>
                      <Input value={etapa.responsavel} onChange={(e) => updateEtapa(i, "responsavel", e.target.value)} placeholder="Responsável" />
                    </TableCell>
                    <TableCell>
                      <Input value={etapa.sistema} onChange={(e) => updateEtapa(i, "sistema", e.target.value)} placeholder="Sistema" />
                    </TableCell>
                    <TableCell>
                      {etapas.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeEtapa(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Decisões</Label>
              <Textarea value={decisoes} onChange={(e) => setDecisoes(e.target.value)} placeholder="Existem aprovações ou validações no processo?" rows={6} />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Saídas do Processo</Label>
              <Textarea value={saidas} onChange={(e) => setSaidas(e.target.value)} placeholder="Qual o resultado final do processo?" rows={6} />
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4">
            <Label>Problemas Identificados</Label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "retrabalho" as const, label: "Retrabalho" },
                { key: "atrasos" as const, label: "Atrasos" },
                { key: "erros" as const, label: "Erros" },
                { key: "dependencia" as const, label: "Dependência de pessoas" },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={problemas[item.key]}
                    onCheckedChange={(checked) => setProblemas({ ...problemas, [item.key]: !!checked })}
                  />
                  <Label className="font-normal">{item.label}</Label>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Outros problemas</Label>
              <Textarea value={problemasTexto} onChange={(e) => setProblemasTexto(e.target.value)} placeholder="Descreva outros problemas" />
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Riscos do Processo</Label>
              <Button variant="outline" size="sm" onClick={addRisco}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-3">
              {riscos.map((risco, i) => {
                const prob = Number(risco.probabilidade ?? 0);
                const sev = Number(risco.severidade ?? 0);
                const nivel = prob * sev;
                const nivelLabel =
                  nivel >= 15 ? "Crítico" : nivel >= 10 ? "Alto" : nivel >= 6 ? "Médio" : nivel > 0 ? "Baixo" : "-";
                const nivelClass =
                  nivel >= 15
                    ? "bg-destructive text-destructive-foreground"
                    : nivel >= 10
                    ? "bg-destructive/20 text-destructive border-destructive/30"
                    : nivel >= 6
                    ? "bg-warning/20 text-warning border-warning/30"
                    : "bg-success/20 text-success border-success/30";
                return (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs">Risco</Label>
                      <Input value={risco.risco} onChange={(e) => updateRisco(i, "risco", e.target.value)} placeholder="Descrição do risco" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Impacto (texto)</Label>
                      <Input value={risco.impacto} onChange={(e) => updateRisco(i, "impacto", e.target.value)} placeholder="Impacto resumido" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Probabilidade (1-5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={risco.probabilidade ?? 3}
                        onChange={(e) => updateRisco(i, "probabilidade", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Severidade (1-5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={risco.severidade ?? 3}
                        onChange={(e) => updateRisco(i, "severidade", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Nível</Label>
                      <div className={`inline-flex items-center px-2 py-1 rounded border text-xs ${nivelClass}`}>
                        {nivelLabel} ({nivel || 0})
                      </div>
                    </div>
                    <div className="flex items-end">
                      {riscos.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeRisco(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 8:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Indicadores do Processo</Label>
              <Textarea
                value={indicadores}
                onChange={(e) => setIndicadores(e.target.value)}
                placeholder="Quais indicadores já são utilizados? Ex.: Tempo de ciclo, Taxa de retrabalho, SLA atendido."
                rows={6}
              />
            </div>
          </div>
        );
      case 9:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Melhoria</Label>
              <Textarea
                value={sugestoes}
                onChange={(e) => setSugestoes(e.target.value)}
                placeholder="Descreva melhorias propostas para orientar o redesenho do processo (ações, responsáveis, prazos)."
                rows={6}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/processos")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{id ? "Editar Processo" : "Formulário Master de Processo"}</h1>
          <p className="text-muted-foreground">{id ? `Editando processo #${id}` : "Preencha todas as informações do processo"}</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
              i === currentStep
                ? "bg-primary text-primary-foreground"
                : i < currentStep
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {step}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep]}</CardTitle>
          <CardDescription>Etapa {currentStep + 1} de {steps.length}</CardDescription>
        </CardHeader>
        <CardContent>{renderStep()}</CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button onClick={() => setCurrentStep(currentStep + 1)}>
            Próximo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Processar com IA
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProcessoFormulario;
