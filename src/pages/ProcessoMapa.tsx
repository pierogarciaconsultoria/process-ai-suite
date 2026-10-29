import { useEffect, useState, type ComponentProps } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import BPMNCanvas from "@/components/BPMNCanvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { resolveAccessibleCompanyId } from "@/lib/active-company";
import { mapProcessRowToForm } from "@/lib/processos";

type Modo = "as-is" | "to-be";

const COLUNA = { "as-is": "bpmn_as_is", "to-be": "bpmn_to_be" } as const;

const SAIR_SEM_SALVAR = "As alterações no mapa ainda não foram salvas. Sair mesmo assim?";

// O canvas reimporta o XML sempre que a prop muda, o que zeraria o zoom e o desfazer a cada
// edição. Por isso ele recebe só o XML do momento em que a aba foi aberta.
function EditorDoMapa(props: ComponentProps<typeof BPMNCanvas>) {
  const [inicial] = useState(props.xml);
  return <BPMNCanvas {...props} xml={inicial} />;
}

const ProcessoMapa = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [processo, setProcesso] = useState<Tables<"processos"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modo, setModo] = useState<Modo>("as-is");
  const [rascunhos, setRascunhos] = useState<Partial<Record<Modo, string>>>({});
  const [salvando, setSalvando] = useState(false);
  const alterado = Object.keys(rascunhos).length > 0;

  useEffect(() => {
    let isMounted = true;

    const loadProcesso = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      try {
        const { data: auth } = await supabase.auth.getUser();
        const activeCompanyId = await resolveAccessibleCompanyId(auth.user?.id ?? null);
        if (!activeCompanyId) return;
        const { data, error } = await supabase
          .from("processos")
          .select("*")
          .eq("id", id)
          .eq("company_id", activeCompanyId)
          .maybeSingle();
        if (error) throw error;
        if (isMounted) setProcesso(data);
      } catch (error) {
        console.error("Erro ao carregar processo:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadProcesso();
    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!alterado) return;
    const avisar = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  const voltar = () => {
    if (alterado && !window.confirm(SAIR_SEM_SALVAR)) return;
    navigate(`/processos/${id}`);
  };

  const salvar = async () => {
    if (!processo || !alterado) return;
    setSalvando(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("processos")
        .update({
          ...(rascunhos["as-is"] !== undefined ? { bpmn_as_is: rascunhos["as-is"] } : {}),
          ...(rascunhos["to-be"] !== undefined ? { bpmn_to_be: rascunhos["to-be"] } : {}),
          updated_by: auth.user?.id ?? null,
        })
        .eq("id", processo.id)
        .eq("company_id", processo.company_id)
        .select("*")
        .single();
      if (error) throw error;
      setProcesso(data);
      setRascunhos({});
      toast({ title: "Mapa salvo." });
    } catch (error) {
      console.error("Erro ao salvar o mapa:", error);
      toast({ title: "Não foi possível salvar o mapa", description: "Verifique sua conexão e tente novamente.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando mapa...
        </CardContent>
      </Card>
    );
  }

  if (!processo) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Processo não encontrado.</CardContent>
      </Card>
    );
  }

  const xml = rascunhos[modo] ?? processo[COLUNA[modo]] ?? "";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={voltar}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao processo
        </Button>
        <div className="flex-1" />
        {alterado && <span className="text-sm text-muted-foreground">Alterações não salvas</span>}
        <Button onClick={() => void salvar()} disabled={!alterado || salvando}>
          {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar mapa
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Mapa do processo</h1>
        <p className="text-muted-foreground">{processo.nome}</p>
      </div>

      <Tabs value={modo} onValueChange={(valor) => setModo(valor as Modo)}>
        <TabsList>
          <TabsTrigger value="as-is">AS IS (atual)</TabsTrigger>
          <TabsTrigger value="to-be">TO BE (otimizado)</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-muted-foreground">
            Arraste elementos da paleta à esquerda e clique num elemento para editar o nome ou ligá-lo a outro.
            {modo === "as-is" ? " O mapa AS IS salvo aparece no relatório do processo." : ""}
          </p>
          <EditorDoMapa
            key={modo}
            xml={xml}
            onChange={(novo) => setRascunhos((atuais) => ({ ...atuais, [modo]: novo }))}
            // Gerar com IA substitui o desenho inteiro: só é oferecido com o mapa vazio.
            formData={xml ? undefined : mapProcessRowToForm(processo)}
            mode={modo}
            companyId={processo.company_id}
            processId={processo.id}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessoMapa;
