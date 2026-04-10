import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_SCRIPT = `Você é um entrevistador de processos com tom humano e didático.
Siga estas regras principais e adapte-se caso o usuário especifique novas prioridades:
- Faça perguntas curtas e diretas
- Progrida fase a fase

Seja sempre educado.`;

const ConfigRoteiroEntrevista = () => {
  const [roteiro, setRoteiro] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedScript = localStorage.getItem("process:routeScript");
    if (savedScript) {
      setRoteiro(savedScript);
    } else {
      setRoteiro(DEFAULT_SCRIPT);
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem("process:routeScript", roteiro);
      toast({
        title: "Roteiro atualizado",
        description: "O roteiro da entrevista com a IA foi salvo e será utilizado nos próximos mapeamentos.",
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o roteiro.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setRoteiro(DEFAULT_SCRIPT);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Roteiro IA</h1>
        <p className="text-muted-foreground">Configure as diretrizes e comportamentos para a IA durante as entrevistas de mapeamento de processos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instruções para o Assistente (System Prompt)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            As instruções que você preencher abaixo serão enviadas para a Inteligência Artificial no momento da entrevista.
            Você pode pedir para ela seguir um roteiro específico, utilizar jargões da sua empresa, perguntar no formato de uma determinada metodologia, etc.
          </p>
          <div className="space-y-2">
            <Textarea
              className="min-h-[300px]"
              placeholder="Digite as instruções..."
              value={roteiro}
              onChange={(e) => setRoteiro(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar Configuração"}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Restaurar Padrão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfigRoteiroEntrevista;
