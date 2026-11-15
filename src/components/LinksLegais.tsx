import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Links para a Política de privacidade e os Termos de uso (rodapés, login e convites).
export function LinksLegais({ className }: { className?: string }) {
  return (
    <nav aria-label="Documentos legais" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm", className)}>
      <Link to="/privacidade" className="hover:text-foreground hover:underline">Política de privacidade</Link>
      <Link to="/termos" className="hover:text-foreground hover:underline">Termos de uso</Link>
    </nav>
  );
}
