import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Copy, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { pessoasDaDistribuicao } from "@/lib/estrutura-empresa";

type Setor = Tables<"setores">;
type Cargo = Tables<"cargos">;
type Pessoa = Tables<"pessoas">;
type Leitura = Tables<"leituras_documento">;

export interface DocumentoDistribuido {
  id: string;
  title: string;
  revision: string;
}

const linkDe = (token: string) => `${window.location.origin}/leitura/${token}`;

// Escolha de setores e cargos que recebem o documento e acompanhamento de quem confirmou a leitura.
export function useDistribuicao(companyId: string | null, documento: DocumentoDistribuido | null) {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [setoresEscolhidos, setSetoresEscolhidos] = useState<string[]>([]);
  const [cargosEscolhidos, setCargosEscolhidos] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    if (!companyId) return;
    const [s, c, p, l] = await Promise.all([
      supabase.from("setores").select("*").eq("company_id", companyId).order("nome"),
      supabase.from("cargos").select("*").eq("company_id", companyId).order("nome"),
      supabase.from("pessoas").select("*").eq("company_id", companyId).order("nome"),
      documento ? supabase.from("leituras_documento").select("*").eq("document_id", documento.id) : Promise.resolve({ data: [] as Leitura[] }),
    ]);
    setSetores(s.data ?? []);
    setCargos(c.data ?? []);
    setPessoas(p.data ?? []);
    setLeituras((l.data ?? []).filter((leitura) => leitura.revisao === documento?.revision));
  }, [companyId, documento]);

  useEffect(() => {
    setSetoresEscolhidos([]);
    setCargosEscolhidos([]);
    void carregar();
  }, [carregar]);

  const destinatarios = pessoasDaDistribuicao(pessoas, cargos, setoresEscolhidos, cargosEscolhidos);
  const rotulos = [
    ...setores.filter((setor) => setoresEscolhidos.includes(setor.id)).map((setor) => setor.nome),
    ...cargos.filter((cargo) => cargosEscolhidos.includes(cargo.id)).map((cargo) => cargo.nome),
  ];

  // Cria um link de leitura por pessoa; quem já tem link nesta revisão não ganha outro.
  const criarLeituras = async () => {
    if (!companyId || !documento || destinatarios.length === 0) return null;
    const { error } = await supabase.from("leituras_documento").upsert(
      destinatarios.map((pessoa) => ({ company_id: companyId, document_id: documento.id, pessoa_id: pessoa.id, revisao: documento.revision })),
      { onConflict: "document_id,pessoa_id,revisao", ignoreDuplicates: true },
    );
    await carregar();
    return error;
  };

  return { setores, cargos, pessoas, leituras, setoresEscolhidos, setSetoresEscolhidos, cargosEscolhidos, setCargosEscolhidos, destinatarios, rotulos, criarLeituras };
}

type Distribuicao = ReturnType<typeof useDistribuicao>;

const alternar = (lista: string[], id: string, marcado: boolean) => (marcado ? [...lista, id] : lista.filter((item) => item !== id));

export function EscolherDestinatarios({ distribuicao }: { distribuicao: Distribuicao }) {
  const { setores, cargos, setoresEscolhidos, setSetoresEscolhidos, cargosEscolhidos, setCargosEscolhidos, destinatarios } = distribuicao;
  if (setores.length === 0 && cargos.length === 0) {
    return <p className="text-sm text-muted-foreground">Cadastre setores, cargos e pessoas em Configurações para distribuir com confirmação de leitura.</p>;
  }
  const grupo = (titulo: string, itens: { id: string; nome: string }[], escolhidos: string[], mudar: (lista: string[]) => void) =>
    itens.length > 0 && (
      <div className="space-y-2">
        <Label>{titulo}</Label>
        <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
          {itens.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={escolhidos.includes(item.id)} onCheckedChange={(marcado) => mudar(alternar(escolhidos, item.id, marcado === true))} />
              {item.nome}
            </label>
          ))}
        </div>
      </div>
    );
  return (
    <div className="space-y-3">
      {grupo("Setores", setores, setoresEscolhidos, setSetoresEscolhidos)}
      {grupo("Cargos", cargos, cargosEscolhidos, setCargosEscolhidos)}
      <p className="text-xs text-muted-foreground">
        {destinatarios.length === 0 ? "Nenhuma pessoa nos setores e cargos escolhidos." : `${destinatarios.length} ${destinatarios.length === 1 ? "pessoa recebe" : "pessoas recebem"} o link de leitura.`}
      </p>
    </div>
  );
}

export function SituacaoDasLeituras({ distribuicao, documento }: { distribuicao: Distribuicao; documento: DocumentoDistribuido }) {
  const { toast } = useToast();
  const { leituras, pessoas } = distribuicao;
  if (leituras.length === 0) return null;
  const lidas = leituras.filter((leitura) => leitura.confirmado_em).length;
  const mensagem = (token: string) => `Leia o procedimento "${documento.title}" e confirme a leitura: ${linkDe(token)}`;
  return (
    <div className="space-y-2">
      <Label>Leituras ({lidas} de {leituras.length})</Label>
      <ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
        {leituras.map((leitura) => {
          const pessoa = pessoas.find((item) => item.id === leitura.pessoa_id);
          return (
            <li key={leitura.id} className="flex items-center gap-2 px-3 py-2">
              {leitura.confirmado_em ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-label="Leu" /> : <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Pendente" />}
              <span className="min-w-0 flex-1 truncate">
                {pessoa?.nome ?? "Pessoa removida"}
                {leitura.confirmado_em && <span className="text-muted-foreground"> · {new Date(leitura.confirmado_em).toLocaleDateString("pt-BR")}</span>}
              </span>
              {!leitura.confirmado_em && (
                <>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Copiar link de ${pessoa?.nome ?? ""}`} onClick={() => void navigator.clipboard.writeText(linkDe(leitura.token)).then(() => toast({ title: "Link copiado" }))}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a href={`https://wa.me/?text=${encodeURIComponent(mensagem(leitura.token))}`} target="_blank" rel="noreferrer" aria-label={`Enviar por WhatsApp para ${pessoa?.nome ?? ""}`}><MessageCircle className="h-3.5 w-3.5" /></a>
                  </Button>
                  {pessoa?.email && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={`mailto:${pessoa.email}?subject=${encodeURIComponent(`Leitura: ${documento.title}`)}&body=${encodeURIComponent(mensagem(leitura.token))}`} aria-label={`Enviar por e-mail para ${pessoa.nome}`}><Mail className="h-3.5 w-3.5" /></a>
                    </Button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
