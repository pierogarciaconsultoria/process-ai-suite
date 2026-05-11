import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type AiSkin = {
  nome: string;
  apresentacao: string;
  avaliacao: string;
};

const DEFAULT_SKIN: AiSkin = {
  nome: "Peter",
  apresentacao:
    "Sou Peter, um consultor de processos experiente, com postura acolhedora, segura e humana. Uso linguagem clara e profissional, com tom descontraído e ágil e estilo entusiasmado. Conduzo a conversa com naturalidade, sem jargões excessivos, ajudando o usuário a se sentir à vontade para explicar o dia a dia do processo com confiança e tranquilidade.",
  avaliacao:
    "Antes de avançar, avalio cada resposta em dois eixos: comportamento (sem ofensas, deboche ou gírias inadequadas) e conteúdo (resolve de forma clara e profissional o campo pendente). Se a resposta for vaga, genérica, fora de contexto ou insuficiente, NÃO avanço: explico com empatia o que falta, dou um exemplo curto do tipo de resposta esperada e repito a mesma pergunta de forma mais simples. Estimulo o usuário a detalhar quem faz, o que faz, quando, onde, com quais sistemas/documentos, exceções, volumes e exemplos práticos. Nunca invento dados nem assumo informações não fornecidas.",
};

const ConfigSkinIA = () => {
  const [skin, setSkin] = useState<AiSkin>(DEFAULT_SKIN);
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("process:aiSkin");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setSkin({
        nome: parsed.nome || DEFAULT_SKIN.nome,
        apresentacao: parsed.apresentacao || DEFAULT_SKIN.apresentacao,
        avaliacao: parsed.avaliacao || DEFAULT_SKIN.avaliacao,
      });
    } catch {
      setSkin(DEFAULT_SKIN);
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem("process:aiSkin", JSON.stringify(skin));
      toast({ title: "Skin atualizada", description: "A personalidade da IA foi salva com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar a skin.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReview = async () => {
    setIsReviewing(true);
    try {
      const roteiro = localStorage.getItem("process:routeScript") || "";
      const { data, error } = await supabase.functions.invoke("ai-review-config", {
        body: { roteiro, skin },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Falha na revisão", description: data.error as string, variant: "destructive" });
        return;
      }
      if (data?.skinSugerida && typeof data.skinSugerida === "object") {
        const s = data.skinSugerida;
        const next: AiSkin = {
          nome: s.nome || skin.nome,
          apresentacao: s.apresentacao || skin.apresentacao,
          avaliacao: s.avaliacao || skin.avaliacao,
        };
        setSkin(next);
        localStorage.setItem("process:aiSkin", JSON.stringify(next));
      }
      toast({
        title: "Skin revisada",
        description: data?.comentarios || "A IA sugeriu ajustes na identidade do assistente.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao revisar com IA.";
      toast({ title: "Falha na revisão", description: message, variant: "destructive" });
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Skin da IA</h1>
        <p className="text-muted-foreground">Personalize a identidade e o comportamento do seu assistente virtual.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identidade do Assistente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Assistente</Label>
            <Input
              id="nome"
              value={skin.nome}
              onChange={(e) => setSkin({ ...skin, nome: e.target.value })}
              placeholder="Ex: Iara, Mentor de Processos..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apresentacao">Apresentação e Personalidade</Label>
            <Textarea
              id="apresentacao"
              value={skin.apresentacao}
              onChange={(e) => setSkin({ ...skin, apresentacao: e.target.value })}
              placeholder="Descreva quem é o assistente, seu tom, estilo de comunicação e como ele se apresenta ao usuário."
              className="min-h-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comportamento de Avaliação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="avaliacao">Regras de Validação e Avaliação</Label>
            <Textarea
              id="avaliacao"
              value={skin.avaliacao}
              onChange={(e) => setSkin({ ...skin, avaliacao: e.target.value })}
              placeholder="Defina como o assistente avalia as respostas antes de avançar. Inclua critérios por campo, exemplos de aprofundamento e regras gerais."
              className="min-h-[220px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={isSaving || isReviewing}>
              {isSaving ? "Salvando..." : "Salvar Configuração"}
            </Button>
            <Button variant="outline" onClick={() => setSkin(DEFAULT_SKIN)} disabled={isReviewing}>
              Restaurar Padrão
            </Button>
            <Button variant="outline" onClick={handleReview} disabled={isReviewing || isSaving}>
              {isReviewing ? "Revisando com IA..." : "Pedir sugestão com IA"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfigSkinIA;
