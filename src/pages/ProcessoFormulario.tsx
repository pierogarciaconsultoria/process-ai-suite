import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Plus, Trash2, Sparkles } from "lucide-react";

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
  "Sugestões",
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
}

const ProcessoFormulario = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [area, setArea] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [clienteProcesso, setClienteProcesso] = useState("");
  const [areasEnvolvidas, setAreasEnvolvidas] = useState("");
  const [entradas, setEntradas] = useState("");
  const [etapas, setEtapas] = useState<Etapa[]>([{ ordem: 1, atividade: "", responsavel: "", sistema: "" }]);
  const [decisoes, setDecisoes] = useState("");
  const [saidas, setSaidas] = useState("");
  const [problemas, setProblemas] = useState({ retrabalho: false, atrasos: false, erros: false, dependencia: false });
  const [problemasTexto, setProblemasTexto] = useState("");
  const [riscos, setRiscos] = useState<Risco[]>([{ risco: "", impacto: "" }]);
  const [indicadores, setIndicadores] = useState("");
  const [sugestoes, setSugestoes] = useState("");

  const addEtapa = () => setEtapas([...etapas, { ordem: etapas.length + 1, atividade: "", responsavel: "", sistema: "" }]);
  const removeEtapa = (i: number) => setEtapas(etapas.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, ordem: idx + 1 })));
  const updateEtapa = (i: number, field: keyof Etapa, value: string) => {
    const updated = [...etapas];
    updated[i] = { ...updated[i], [field]: value };
    setEtapas(updated);
  };

  const addRisco = () => setRiscos([...riscos, { risco: "", impacto: "" }]);
  const removeRisco = (i: number) => setRiscos(riscos.filter((_, idx) => idx !== i));
  const updateRisco = (i: number, field: keyof Risco, value: string) => {
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
            {riscos.map((risco, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-1 space-y-2">
                  <Input value={risco.risco} onChange={(e) => updateRisco(i, "risco", e.target.value)} placeholder="Descrição do risco" />
                </div>
                <div className="w-32 space-y-2">
                  <Input value={risco.impacto} onChange={(e) => updateRisco(i, "impacto", e.target.value)} placeholder="Impacto" />
                </div>
                {riscos.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeRisco(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        );
      case 8:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Indicadores Existentes</Label>
              <Textarea value={indicadores} onChange={(e) => setIndicadores(e.target.value)} placeholder="Quais indicadores já são utilizados neste processo?" rows={6} />
            </div>
          </div>
        );
      case 9:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sugestões de Melhoria</Label>
              <Textarea value={sugestoes} onChange={(e) => setSugestoes(e.target.value)} placeholder="Alguma sugestão para melhorar este processo?" rows={6} />
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
          <h1 className="text-2xl font-bold text-foreground">Formulário Master de Processo</h1>
          <p className="text-muted-foreground">Preencha todas as informações do processo</p>
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
