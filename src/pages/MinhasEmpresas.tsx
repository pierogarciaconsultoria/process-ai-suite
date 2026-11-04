import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { DOCUMENTO_PENDENTE, resumirCarteira, type ResumoEmpresa } from "@/lib/carteira";
import { trocarEmpresaAtiva, useEmpresaAtiva } from "@/lib/empresa-ativa";
import { hojeISO } from "@/lib/plano-de-acao";

type Linha = Record<string, unknown>;

// Uma tabela ainda não criada (migration não aplicada) entra vazia, sem derrubar o painel.
async function ler(consulta: PromiseLike<{ data: unknown; error: unknown }>): Promise<Linha[]> {
  const { data, error } = await consulta;
  if (error) {
    console.warn("Minhas empresas: dado indisponível", error);
    return [];
  }
  return Array.isArray(data) ? (data as Linha[]) : [];
}

function tresMesesAtras(): string {
  const hoje = new Date();
  return `${new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1).toISOString().slice(0, 7)}-01`;
}

function Numero({ valor, alerta = false, rotulo }: { valor: number; alerta?: boolean; rotulo: string }) {
  return (
    <span className={alerta && valor > 0 ? "font-semibold text-destructive" : valor === 0 ? "text-muted-foreground" : ""} aria-label={`${rotulo}: ${valor}`}>
      {valor}
    </span>
  );
}

const MinhasEmpresas = () => {
  const navigate = useNavigate();
  const empresaAtiva = useEmpresaAtiva();
  const [resumos, setResumos] = useState<ResumoEmpresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      // As regras de acesso devolvem só as empresas de que o usuário participa.
      const [empresas, processos, acoes, indicadores, medicoes, documentos] = await Promise.all([
        ler(supabase.from("empresas").select("id, nome, segmento").order("nome")),
        ler(supabase.from("processos").select("company_id, status").limit(5000)),
        ler(supabase.from("acoes").select("company_id, status, prazo").limit(5000)),
        ler(supabase.from("indicadores").select("id, company_id, meta, sentido").limit(5000)),
        ler(supabase.from("indicador_medicoes").select("indicador_id, periodo, valor").gte("periodo", tresMesesAtras()).limit(10000)),
        ler(supabase.from("generated_documents").select("company_id, status").in("status", DOCUMENTO_PENDENTE).limit(5000)),
      ]);
      if (!ativo) return;
      setResumos(resumirCarteira({
        empresas: empresas.map((empresa) => ({ id: String(empresa.id), nome: String(empresa.nome ?? ""), segmento: empresa.segmento ? String(empresa.segmento) : null })),
        processos, acoes, indicadores, medicoes, documentos, hoje: hojeISO(),
      }));
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? resumos.filter((item) => `${item.nome} ${item.segmento ?? ""}`.toLowerCase().includes(termo)) : resumos;
  }, [resumos, busca]);

  const total = useMemo(() => ({
    empresas: resumos.length,
    atrasadas: resumos.reduce((soma, item) => soma + item.acoesAtrasadas, 0),
    fora: resumos.reduce((soma, item) => soma + item.indicadoresFora, 0),
    pendentes: resumos.reduce((soma, item) => soma + item.documentosPendentes, 0),
  }), [resumos]);

  const entrar = (empresa: ResumoEmpresa) => {
    trocarEmpresaAtiva(empresa.id, empresa.nome);
    navigate("/inicio");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas empresas</h1>
        <p className="text-muted-foreground">A situação de cada empresa que você acompanha. As que pedem mais atenção aparecem primeiro.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Empresas</div><div className="text-2xl font-bold">{total.empresas}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Ações atrasadas</div><div className={`text-2xl font-bold ${total.atrasadas ? "text-destructive" : ""}`}>{total.atrasadas}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Indicadores fora da meta</div><div className={`text-2xl font-bold ${total.fora ? "text-destructive" : ""}`}>{total.fora}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Documentos para aprovar</div><div className="text-2xl font-bold">{total.pendentes}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar empresa..." value={busca} onChange={(event) => setBusca(event.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-center">Processos mapeados</TableHead>
                  <TableHead className="text-center">Em entrevista</TableHead>
                  <TableHead className="text-center">Ações abertas</TableHead>
                  <TableHead className="text-center">Atrasadas</TableHead>
                  <TableHead className="text-center">Indicadores fora da meta</TableHead>
                  <TableHead className="text-center">Documentos para aprovar</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas...</span>
                    </TableCell>
                  </TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma empresa encontrada.</TableCell></TableRow>
                ) : (
                  filtradas.map((empresa) => (
                    <TableRow key={empresa.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          {empresa.nome}
                          {empresa.id === empresaAtiva && <Badge variant="secondary">Atual</Badge>}
                        </div>
                        {empresa.segmento && <div className="text-xs text-muted-foreground">{empresa.segmento}</div>}
                      </TableCell>
                      <TableCell className="text-center"><Numero valor={empresa.processosMapeados} rotulo="Processos mapeados" /></TableCell>
                      <TableCell className="text-center"><Numero valor={empresa.emEntrevista} rotulo="Em entrevista" /></TableCell>
                      <TableCell className="text-center"><Numero valor={empresa.acoesAbertas} rotulo="Ações abertas" /></TableCell>
                      <TableCell className="text-center"><Numero valor={empresa.acoesAtrasadas} alerta rotulo="Ações atrasadas" /></TableCell>
                      <TableCell className="text-center"><Numero valor={empresa.indicadoresFora} alerta rotulo="Indicadores fora da meta" /></TableCell>
                      <TableCell className="text-center"><Numero valor={empresa.documentosPendentes} rotulo="Documentos para aprovar" /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => entrar(empresa)} aria-label={`Entrar em ${empresa.nome}`}>
                          Entrar <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MinhasEmpresas;
