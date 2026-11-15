import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LinksLegais } from "@/components/LinksLegais";
import {
  DOCUMENTOS_EM_REVISAO,
  EMPRESA_RESPONSAVEL,
  POLITICA_DE_PRIVACIDADE,
  TERMOS_DE_USO,
  VERSAO_DOCUMENTOS_LEGAIS,
} from "@/data/documentos-legais";

// Páginas públicas /privacidade e /termos.
export default function DocumentoLegal({ tipo }: { tipo: "privacidade" | "termos" }) {
  const documento = tipo === "privacidade" ? POLITICA_DE_PRIVACIDADE : TERMOS_DE_USO;
  const [ano, mes, dia] = VERSAO_DOCUMENTOS_LEGAIS.split("-");

  useEffect(() => {
    document.title = `${documento.titulo} · Peter`;
  }, [documento.titulo]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar ao início
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">{documento.titulo}</h1>
        <p className="mt-2 text-foreground/80">{documento.resumo}</p>
        <p className="mt-1 text-sm text-foreground/70">Versão de {dia}/{mes}/{ano}</p>
        {DOCUMENTOS_EM_REVISAO && (
          <p role="note" className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Minuta em revisão jurídica. Os trechos marcados como [a definir] serão completados na versão final.
          </p>
        )}
        <div className="mt-8 space-y-8">
          {documento.secoes.map((secao) => (
            <section key={secao.titulo} className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{secao.titulo}</h2>
              {secao.paragrafos.map((paragrafo) => (
                <p key={paragrafo} className="leading-relaxed text-foreground/90">{paragrafo}</p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-6 text-sm text-foreground/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            © {new Date().getFullYear()} {EMPRESA_RESPONSAVEL.nomeComercial} · CNPJ {EMPRESA_RESPONSAVEL.cnpj}
          </span>
          <LinksLegais />
        </div>
      </footer>
    </div>
  );
}
