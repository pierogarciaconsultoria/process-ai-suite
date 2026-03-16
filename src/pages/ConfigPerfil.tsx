import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ConfigPerfil = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/configuracoes")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
          <p className="text-muted-foreground">Atualize suas informações pessoais</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações de Perfil</CardTitle>
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
    </div>
  );
};

export default ConfigPerfil;
