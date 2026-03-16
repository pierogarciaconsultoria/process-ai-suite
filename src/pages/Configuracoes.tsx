import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const Configuracoes = () => {
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input placeholder="Seu nome" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="seu@email.com" disabled />
          </div>
          <Button>Salvar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar Nova Senha</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button>Alterar Senha</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Configuracoes;
