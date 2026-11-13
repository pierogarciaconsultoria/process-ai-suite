import { useRef, useState } from "react";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { enviarLogo, removerLogo, urlDoLogo, validarLogo } from "@/lib/logo-empresa";
import { mensagemDoErroDoProcesso } from "@/lib/processo-duplicado";

// Logo do cliente, usado no cabeçalho dos procedimentos em PDF. Só Consultor e Gestor da
// empresa conseguem enviar (a regra de acesso do armazenamento garante).
export function LogoDaEmpresa({ companyId, nome }: { companyId: string; nome: string }) {
  const { toast } = useToast();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [versao, setVersao] = useState(() => Date.now());
  const [temLogo, setTemLogo] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (arquivo: File | undefined) => {
    if (arquivoRef.current) arquivoRef.current.value = "";
    if (!arquivo) return;
    const erro = validarLogo(arquivo);
    if (erro) {
      toast({ title: "Logo não enviado", description: erro, variant: "destructive" });
      return;
    }
    setOcupado(true);
    try {
      await enviarLogo(companyId, arquivo);
      setTemLogo(true);
      setVersao(Date.now());
      toast({ title: "Logo atualizado", description: `O logo de ${nome} já aparece nos documentos exportados.` });
    } catch (error) {
      toast({ title: "Não foi possível enviar o logo", description: mensagemDoErroDoProcesso(error, "Só Consultor e Gestor da empresa podem trocar o logo."), variant: "destructive" });
    } finally {
      setOcupado(false);
    }
  };

  const remover = async () => {
    if (!window.confirm(`Remover o logo de ${nome}?`)) return;
    setOcupado(true);
    try {
      await removerLogo(companyId);
      setTemLogo(false);
      setVersao(Date.now());
    } catch (error) {
      toast({ title: "Não foi possível remover o logo", description: mensagemDoErroDoProcesso(error, "Tente de novo."), variant: "destructive" });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 w-20 items-center justify-center overflow-hidden rounded border bg-white">
        {temLogo ? (
          <img
            src={`${urlDoLogo(companyId)}?v=${versao}`}
            alt={`Logo de ${nome}`}
            className="max-h-full max-w-full object-contain"
            onError={() => setTemLogo(false)}
          />
        ) : (
          <ImageOff className="h-4 w-4 text-muted-foreground" aria-label="Sem logo" />
        )}
      </div>
      <input
        ref={arquivoRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        data-testid={`logo-${companyId}`}
        onChange={(event) => void enviar(event.target.files?.[0])}
      />
      <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => arquivoRef.current?.click()} aria-label={`Enviar logo de ${nome}`}>
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      </Button>
      {temLogo && (
        <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={() => void remover()} aria-label={`Remover logo de ${nome}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
