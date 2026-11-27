import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { documentoHtml } from "@/lib/documento-pdf";

type Leitura = Database["public"]["Functions"]["documento_para_leitura"]["Returns"][number];

// Página aberta pelo link enviado na distribuição: mostra o procedimento e registra a leitura, sem login.
const LeituraDocumento = () => {
  const { token = "" } = useParams();
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void supabase.rpc("documento_para_leitura", { _token: token }).then(({ data, error }) => {
      if (error) setErro(error.message);
      else if (!data?.length) setErro("Link de leitura não encontrado. Peça um novo a quem enviou o documento.");
      else setLeitura(data[0]);
      setCarregando(false);
    });
  }, [token]);

  const confirmar = async () => {
    setConfirmando(true);
    const { data, error } = await supabase.rpc("confirmar_leitura", { _token: token });
    setConfirmando(false);
    if (error) setErro(error.message);
    else if (leitura) setLeitura({ ...leitura, confirmado_em: data });
  };

  if (carregando) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (erro || !leitura) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">{erro}</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <p className="text-sm text-muted-foreground">Olá, {leitura.pessoa_nome}. Leia o procedimento abaixo e confirme no final.</p>
      </div>
      <iframe
        title="Documento"
        sandbox=""
        className="min-h-[70vh] w-full flex-1 rounded-md border bg-white"
        srcDoc={documentoHtml(leitura.conteudo, {
          titulo: leitura.titulo,
          codigo: leitura.codigo ?? "",
          revisao: leitura.revisao,
          aprovadoEm: leitura.aprovado_em,
          elaboradoPor: leitura.elaborado_por ?? "",
          aprovadoPor: leitura.aprovado_por ?? "",
          logo: null,
        })}
      />
      <div className="flex flex-col items-center gap-2 pb-4">
        {leitura.confirmado_em ? (
          <p className="flex items-center gap-2 text-sm font-medium text-primary" role="status">
            <CheckCircle2 className="h-5 w-5" /> Leitura confirmada em {new Date(leitura.confirmado_em).toLocaleString("pt-BR")}.
          </p>
        ) : (
          <Button size="lg" onClick={() => void confirmar()} disabled={confirmando}>
            {confirmando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Li e entendi
          </Button>
        )}
      </div>
    </div>
  );
};

export default LeituraDocumento;
