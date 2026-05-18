import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { Plus, Search, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Empresa {
  id: string;
  nome: string;
  segmento: string;
  tamanho: string;
  area_atuacao?: string;
  contexto?: string;
  data_cadastro: string;
}

const Empresas = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [novaNome, setNovaNome] = useState("");
  const [novaSegmento, setNovaSegmento] = useState("");
  const [novaOutroSegmento, setNovaOutroSegmento] = useState(false);
  const [novaOutroSegmentoTexto, setNovaOutroSegmentoTexto] = useState("");
  const [novaTamanho, setNovaTamanho] = useState("");
  const [novaAreaAtuacao, setNovaAreaAtuacao] = useState("");
  const [novaContexto, setNovaContexto] = useState("");
  const segmentosBR = [
    "Agricultura, Pecuária, Produção Florestal, Pesca e Aquicultura",
    "Indústrias Extrativas",
    "Indústrias de Transformação",
    "Eletricidade e Gás",
    "Água, Esgoto, Atividades de Gestão de Resíduos e Descontaminação",
    "Construção",
    "Comércio; Reparação de Veículos Automotores e Motocicletas",
    "Transporte, Armazenagem e Correio",
    "Alojamento e Alimentação",
    "Informação e Comunicação",
    "Atividades Financeiras, de Seguros e Serviços Relacionados",
    "Atividades Imobiliárias",
    "Atividades Profissionais, Científicas e Técnicas",
    "Atividades Administrativas e Serviços Complementares",
    "Administração Pública, Defesa e Seguridade Social",
    "Educação",
    "Saúde Humana e Serviços Sociais",
    "Artes, Cultura, Esporte e Recreação",
    "Outras Atividades de Serviços",
    "Serviços Domésticos",
    "Organismos Internacionais e Outras Instituições Extraterritoriais",
  ];
  const [loadingCreate, setLoadingCreate] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadFromServer = async () => {
      const { data, error } = await supabase.functions.invoke("org-list");
      if (!error && Array.isArray(data)) {
        const seen = new Set<string>();
        const list = (data as Array<Record<string, unknown>>)
          .map((e) => ({
            id: String(e.id),
            nome: String(e.nome),
            segmento: String(e.segmento || ""),
            tamanho: String(e.tamanho || ""),
            area_atuacao: String(e.area_atuacao || ""),
            contexto: String(e.contexto || ""),
            data_cadastro: String(e.created_at || new Date().toISOString()),
          }))
          .filter((e) => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          }) as Empresa[];
        setEmpresas(list);
      }
    };
    void loadFromServer();
  }, []);

  const filtered = empresas.filter((e) =>
    e.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!novaNome.trim()) {
      toast({ title: "Informe o nome da empresa", description: "Preencha o campo Nome da Empresa.", variant: "destructive" });
      return;
    }
    setLoadingCreate(true);
    const { data, error } = await supabase.functions.invoke("org-onboarding", {
      body: {
        nome: novaNome.trim(),
        segmento: novaSegmento.trim() || null,
        tamanho: novaTamanho.trim() || null,
        area_atuacao: novaAreaAtuacao.trim() || null,
        contexto: novaContexto.trim() || null,
      },
    });
    setLoadingCreate(false);

    // supabase.functions.invoke devolve `error` mas não o body do erro;
    // o servidor agora retorna {error, message, ...} em status 4xx/5xx.
    const serverError = (data as { error?: string; message?: string } | null)?.error;
    if (error || serverError) {
      const description = serverError
        ? `${serverError}${(data as { message?: string })?.message ? ` — ${(data as { message?: string }).message}` : ""}`
        : error?.message || "Erro desconhecido ao cadastrar empresa.";
      toast({ title: "Erro ao cadastrar", description, variant: "destructive" });
      return;
    }

    const created = (data as { empresa?: Empresa })?.empresa;
    if (!created || !created.id || created.id.startsWith("temp-")) {
      toast({
        title: "Empresa não foi persistida",
        description: "O servidor não retornou um registro válido. Verifique os logs.",
        variant: "destructive",
      });
      return;
    }

    // Revalida a partir do servidor para garantir consistência
    const { data: listData } = await supabase.functions.invoke("org-list");
    if (Array.isArray(listData)) {
      const list = (listData as Array<Record<string, unknown>>).map((e) => ({
        id: String(e.id),
        nome: String(e.nome),
        segmento: String(e.segmento || ""),
        tamanho: String(e.tamanho || ""),
        area_atuacao: String(e.area_atuacao || ""),
        contexto: String(e.contexto || ""),
        data_cadastro: String(e.created_at || new Date().toISOString()),
      })) as Empresa[];
      setEmpresas(list);
    } else {
      setEmpresas((prev) => [created, ...prev]);
    }

    setOpen(false);
    setNovaNome("");
    setNovaSegmento("");
    setNovaTamanho("");
    setNovaAreaAtuacao("");
    setNovaContexto("");
    window.dispatchEvent(new CustomEvent("empresas:refresh"));
    toast({ title: "Empresa cadastrada", description: "A empresa foi criada e vinculada à sua conta." });

  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground">Gerencie as empresas cadastradas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Empresa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input placeholder="Nome da empresa" value={novaNome} onChange={(e) => setNovaNome(e.target.value)} />
              </div>
            <div className="space-y-2">
              <Label>Segmento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-between border rounded-md px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="truncate">{novaSegmento || "Selecione o segmento"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar segmento..." />
                    <CommandEmpty>Nenhum segmento encontrado.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem
                          value="__outro__"
                          onSelect={() => {
                            setNovaOutroSegmento(true);
                            setNovaSegmento("Outro");
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${novaOutroSegmento ? "opacity-100" : "opacity-0"}`} />
                          <span className="truncate">Outro...</span>
                        </CommandItem>
                        {segmentosBR.map((s) => (
                          <CommandItem
                            key={s}
                            value={s}
                            onSelect={(val) => {
                              setNovaSegmento(val);
                              setNovaOutroSegmento(false);
                              setNovaOutroSegmentoTexto("");
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${novaSegmento === s ? "opacity-100" : "opacity-0"}`} />
                            <span className="truncate">{s}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {novaOutroSegmento && (
              <div className="space-y-2">
                <Label>Outro segmento</Label>
                <Input
                  placeholder="Descreva o segmento"
                  value={novaOutroSegmentoTexto}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNovaOutroSegmentoTexto(v);
                    setNovaSegmento(v ? `Outro: ${v}` : "Outro");
                  }}
                />
              </div>
            )}
              <div className="space-y-2">
                <Label>Número de Colaboradores</Label>
                <Input placeholder="Ex: 50-100" value={novaTamanho} onChange={(e) => setNovaTamanho(e.target.value)} />
              </div>
            <div className="space-y-2">
              <Label>Área de atuação</Label>
              <Input placeholder="Ex: Financeiro, Operações, Marketing..." value={novaAreaAtuacao} onChange={(e) => setNovaAreaAtuacao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contexto</Label>
              <Textarea rows={6} className="min-h-32" placeholder="Breve contexto (mercado, produtos/serviços...)" value={novaContexto} onChange={(e) => setNovaContexto(e.target.value)} />
            </div>
              <Button className="w-full" onClick={handleCreate} disabled={loadingCreate}>
                {loadingCreate ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Colaboradores</TableHead>
                <TableHead>Data de Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((empresa) => (
                <TableRow key={empresa.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {empresa.nome}
                    </div>
                  </TableCell>
                  <TableCell>{empresa.segmento}</TableCell>
                  <TableCell>{empresa.tamanho}</TableCell>
                  <TableCell>{new Date(empresa.data_cadastro).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Empresas;
