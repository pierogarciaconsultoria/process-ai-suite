import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_SKIN = {
  nome: "Peter",
  tom: "descontraído e ágil",
  estilo: "entusiasmado"
};

const ConfigSkinIA = () => {
  const [skin, setSkin] = useState(DEFAULT_SKIN);
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedSkin = localStorage.getItem("process:aiSkin");
    if (savedSkin) {
      try {
        setSkin(JSON.parse(savedSkin));
      } catch (e) {
        setSkin(DEFAULT_SKIN);
      }
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem("process:aiSkin", JSON.stringify(skin));
      toast({
        title: "Skin atualizada",
        description: "A personalidade da IA foi salva com sucesso.",
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a skin.",
        variant: "destructive",
      });
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
        toast({
          title: "Falha na revisão",
          description: data.error as string,
          variant: "destructive",
        });
        return;
      }
      if (data?.skinSugerida && typeof data.skinSugerida === "object") {
        setSkin(data.skinSugerida);
        localStorage.setItem("process:aiSkin", JSON.stringify(data.skinSugerida));
      }
      toast({
        title: "Skin revisada",
        description: data?.comentarios || "A IA sugeriu ajustes na identidade do assistente.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao revisar com IA.";
      toast({
        title: "Falha na revisão",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Skin da IA</h1>
        <p className="text-muted-foreground">Personalize a identidade do seu assistente virtual.</p>
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
            <Label htmlFor="tom">Tom de Voz</Label>
            <Select 
              value={skin.tom} 
              onValueChange={(val) => setSkin({ ...skin, tom: val })}
            >
              <SelectTrigger id="tom">
                <SelectValue placeholder="Selecione o tom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="humano e didático">Humano e Didático</SelectItem>
                <SelectItem value="formal e técnico">Formal e Técnico</SelectItem>
                <SelectItem value="descontraído e ágil">Descontraído e Ágil</SelectItem>
                <SelectItem value="estritamente executivo">Estritamente Executivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estilo">Estilo de Linguagem</Label>
            <Select 
              value={skin.estilo} 
              onValueChange={(val) => setSkin({ ...skin, estilo: val })}
            >
              <SelectTrigger id="estilo">
                <SelectValue placeholder="Selecione o estilo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="minimalista">Minimalista (Direto ao ponto)</SelectItem>
                <SelectItem value="entusiasmado">Entusiasmado (Motivador)</SelectItem>
                <SelectItem value="crítico">Crítico (Questionador)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mt-6">
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
