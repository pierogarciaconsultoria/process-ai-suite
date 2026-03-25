import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Empresa {
  id: string;
  nome: string;
  segmento: string;
  tamanho: string;
  data_cadastro: string;
}

const mockEmpresas: Empresa[] = [
  { id: "1", nome: "Tech Solutions Ltda", segmento: "Tecnologia", tamanho: "50-100", data_cadastro: "2024-01-15" },
  { id: "2", nome: "Indústria Alpha S.A.", segmento: "Indústria", tamanho: "500+", data_cadastro: "2024-02-20" },
  { id: "3", nome: "Consultoria Beta", segmento: "Serviços", tamanho: "10-50", data_cadastro: "2024-03-10" },
];

const Empresas = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>(mockEmpresas);
  const [novaNome, setNovaNome] = useState("");
  const [novaSegmento, setNovaSegmento] = useState("");
  const [novaTamanho, setNovaTamanho] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadUserCompany = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      const meta = user.user_metadata as Record<string, unknown>;
      const empresaValue = meta?.empresa;
      const empresaNome = typeof empresaValue === "string" ? empresaValue : undefined;
      if (!empresaNome) return;
      const exists = empresas.some((e) => e.nome.toLowerCase() === String(empresaNome).toLowerCase());
      if (exists) return;
      const { data: created, error } = await supabase.functions.invoke("org-onboarding", {
        body: { empresaNome },
      });
      if (error) return;
      if (created?.empresa) {
        const e = created.empresa as Empresa;
        setEmpresas((prev) => [e, ...prev]);
      }
    };
    const loadFromServer = async () => {
      const { data, error } = await supabase.functions.invoke("org-list");
      if (!error && Array.isArray(data)) {
        setEmpresas(data as Empresa[]);
      }
    };
    loadFromServer().then(loadUserCompany);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      body: { nome: novaNome.trim(), segmento: novaSegmento.trim() || null, tamanho: novaTamanho.trim() || null },
    });
    setLoadingCreate(false);
    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      return;
    }
    if (data?.empresa) {
      const e = data.empresa as Empresa;
      setEmpresas((prev) => [e, ...prev]);
      setOpen(false);
      setNovaNome("");
      setNovaSegmento("");
      setNovaTamanho("");
      toast({ title: "Empresa cadastrada", description: "A empresa foi criada e vinculada à sua conta." });
    }
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
                <Input placeholder="Segmento de atuação" value={novaSegmento} onChange={(e) => setNovaSegmento(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número de Colaboradores</Label>
                <Input placeholder="Ex: 50-100" value={novaTamanho} onChange={(e) => setNovaTamanho(e.target.value)} />
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
