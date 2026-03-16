import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ConfigAlterarSenha = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/configuracoes")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alterar Senha</h1>
          <p className="text-muted-foreground">Defina uma nova senha de acesso</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Atualização de Senha</CardTitle>
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

export default ConfigAlterarSenha;
