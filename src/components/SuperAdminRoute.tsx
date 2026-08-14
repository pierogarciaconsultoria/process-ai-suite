import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { isSuperAdmin } from "@/lib/permissions";

export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthUser();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Verificando permissão...
      </div>
    );
  }

  if (!isSuperAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
