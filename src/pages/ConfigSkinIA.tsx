import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildAiSkinPayload, DEFAULT_SKIN_IDENTITY, DEFAULT_SKIN_VALIDATION, parseSkinIdentity } from "@/data/ai-config-defaults";
import { useAiConfig } from "@/hooks/useAiConfig";

const ConfigSkinIA = () => {
  const identityConfig = useAiConfig("skin_identity");
  const validationConfig = useAiConfig("skin_validation");
  const routeScriptConfig = useAiConfig("route_script");
  const [skin, setSkin] = useState(DEFAULT_SKIN_IDENTITY);
  const [validationRules, setValidationRules] = useState(DEFAULT_SKIN_VALIDATION);
  const [isReviewing, setIsReviewing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSkin(parseSkinIdentity(identityConfig.content));
  }, [identityConfig.content]);

  useEffect(() => {
    setValidationRules(validationConfig.content || DEFAULT_SKIN_VALIDATION);
  }, [validationConfig.content]);

  const isSaving = identityConfig.isSaving || validationConfig.isSaving;
  const isLoading = identityConfig.isLoading || validationConfig.isLoading || routeScriptConfig.isLoading;

  const handleSave = async () => {
    const [savedIdentity, savedValidation] = await Promise.all([
      identityConfig.saveConfig(JSON.stringify(skin)),
      validationConfig.saveConfig(validationRules),
    ]);
    if (savedIdentity && savedValidation) {
      toast({
        title: "Skin atualizada",
        description: "A identidade do assistente e as regras de validação foram salvas no Supabase.",
      });
      return;
    }
    toast({
      title: "Erro",
      description: "Não foi possível salvar a skin.",
      variant: "destructive",
    });
  };

  const handleReview = async () => {
    setIsReviewing(true);
    try {
      const roteiro = routeScriptConfig.content || "";
      const { data, error } = await supabase.functions.invoke("ai-review-config", {
        body: { roteiro, skin: buildAiSkinPayload(JSON.stringify(skin), validationRules) },
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
        setSkin(parseSkinIdentity(JSON.stringify(data.skinSugerida)));
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
          <CardTitle>Skin Bloco 1: Identidade do Assistente</CardTitle>
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
            <Button onClick={() => void handleSave()} disabled={isSaving || isReviewing || isLoading}>
              {isSaving ? "Salvando..." : "Salvar Configuração"}
            </Button>
            <Button variant="outline" onClick={() => setSkin(DEFAULT_SKIN_IDENTITY)} disabled={isReviewing || isLoading}>
              Restaurar Padrão
            </Button>
            <Button variant="outline" onClick={() => void handleReview()} disabled={isReviewing || isSaving || isLoading}>
              {isReviewing ? "Revisando com IA..." : "Pedir sugestão com IA"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skin Bloco 2: Regras de Validação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina as regras que a IA deve seguir para validar respostas, manter o foco da entrevista e evitar preenchimentos indevidos.
          </p>
          <div className="space-y-2">
            <Label htmlFor="validacao">Regras de validação</Label>
            <Textarea
              id="validacao"
              className="min-h-[220px]"
              value={validationRules}
              onChange={(e) => setValidationRules(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setValidationRules(DEFAULT_SKIN_VALIDATION)} disabled={isReviewing || isLoading}>
            Restaurar validação padrão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfigSkinIA;
