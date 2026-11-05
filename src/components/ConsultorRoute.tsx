import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useEhConsultor } from "@/lib/perfil";

// Telas só do Consultor (como a carteira de empresas). As regras de acesso do banco continuam
// limitando os dados às empresas de que a pessoa participa.
export function ConsultorRoute({ children }: { children: ReactNode }) {
  const consultor = useEhConsultor();

  if (consultor === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Verificando permissão...
      </div>
    );
  }

  if (!consultor) return <Navigate to="/configuracoes" replace />;

  return <>{children}</>;
}
