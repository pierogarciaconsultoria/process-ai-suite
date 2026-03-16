import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";

const mockUsers = [
  { id: "1", nome: "Admin Master", email: "admin@processo.com", perfil: "super_admin", empresa: "Todas" },
  { id: "2", nome: "Ana Silva", email: "ana@techsolutions.com", perfil: "admin", empresa: "Tech Solutions Ltda" },
  { id: "3", nome: "Carlos Souza", email: "carlos@techsolutions.com", perfil: "user", empresa: "Tech Solutions Ltda" },
];

const perfilColors: Record<string, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin: "bg-info text-info-foreground",
  user: "bg-muted text-muted-foreground",
};

const perfilLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  user: "Usuário",
};

const Usuarios = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = mockUsers.filter(
    (u) => u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input placeholder="Nome completo" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="email@empresa.com" /></div>
              <div className="space-y-2"><Label>Perfil</Label><Input placeholder="admin ou user" /></div>
              <Button className="w-full" onClick={() => setOpen(false)}>Cadastrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Empresa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.nome}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge className={perfilColors[user.perfil]}>{perfilLabels[user.perfil]}</Badge></TableCell>
                  <TableCell>{user.empresa}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Usuarios;
