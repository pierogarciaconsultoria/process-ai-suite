import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, User, KeyRound, MessageSquare, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Configuracoes = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/empresas")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gerencie empresas e dados organizacionais</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/chamados")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Chamados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Abra e acompanhe chamados de suporte</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/usuarios")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <Users className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Gerencie usuários e perfis de acesso</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/perfil")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <User className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Atualize suas informações pessoais</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/alterar-senha")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Alterar Senha</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Defina uma nova senha de acesso</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/roteiro-entrevista")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Roteiro IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Edite o roteiro da entrevista com IA</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/configuracoes/skin-ia")}>
          <CardHeader className="flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Skin da IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Personalize o nome e o estilo do assistente</p>
          </CardContent>
        </Card>
      </div>
 
    </div>
  );
};

export default Configuracoes;
