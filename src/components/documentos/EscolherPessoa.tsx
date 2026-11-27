import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export interface PessoaComCargo {
  id: string;
  nome: string;
  cargo: string;
}

const OUTRA = "__outra__";

// Pessoas ativas da empresa com o nome do cargo, para escolher responsáveis nos documentos.
export function usePessoasDaEmpresa(companyId: string | null): PessoaComCargo[] {
  const [pessoas, setPessoas] = useState<PessoaComCargo[]>([]);
  useEffect(() => {
    if (!companyId) return;
    void Promise.all([
      supabase.from("pessoas").select("id, nome, cargo_id, ativa").eq("company_id", companyId).order("nome"),
      supabase.from("cargos").select("id, nome").eq("company_id", companyId),
    ]).then(([p, c]) => {
      const cargos = new Map((c.data ?? []).map((cargo) => [cargo.id, cargo.nome]));
      setPessoas((p.data ?? []).filter((pessoa) => pessoa.ativa).map((pessoa) => ({ id: pessoa.id, nome: pessoa.nome, cargo: cargos.get(pessoa.cargo_id ?? "") ?? "" })));
    });
  }, [companyId]);
  return pessoas;
}

// Escolhe uma pessoa do cadastro (nome e cargo vêm juntos) ou digita outro nome.
// O documento guarda o texto do nome e do cargo: o registro vale mesmo se a pessoa mudar de cargo.
export function EscolherPessoa({
  id,
  pessoas,
  nome,
  onChange,
}: {
  id: string;
  pessoas: PessoaComCargo[];
  nome: string;
  onChange: (nome: string, cargo: string | null) => void;
}) {
  const doCadastro = pessoas.find((pessoa) => pessoa.nome === nome);
  const [digitando, setDigitando] = useState(false);

  if (pessoas.length === 0 || (digitando && !doCadastro)) {
    return <Input id={id} value={nome} placeholder="Nome completo" onChange={(e) => onChange(e.target.value, null)} />;
  }

  return (
    <Select
      value={doCadastro?.id ?? ""}
      onValueChange={(valor) => {
        if (valor === OUTRA) {
          setDigitando(true);
          onChange("", null);
          return;
        }
        const pessoa = pessoas.find((item) => item.id === valor);
        if (pessoa) onChange(pessoa.nome, pessoa.cargo);
      }}
    >
      <SelectTrigger id={id}><SelectValue placeholder="Escolha a pessoa" /></SelectTrigger>
      <SelectContent>
        {pessoas.map((pessoa) => (
          <SelectItem key={pessoa.id} value={pessoa.id}>{pessoa.cargo ? `${pessoa.nome} — ${pessoa.cargo}` : pessoa.nome}</SelectItem>
        ))}
        <SelectItem value={OUTRA}>Outra pessoa…</SelectItem>
      </SelectContent>
    </Select>
  );
}
