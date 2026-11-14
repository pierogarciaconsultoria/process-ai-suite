import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202611140001_contas.sql"), "utf8");

describe("Migration de contas", () => {
  it("o administrador da conta enxerga e gerencia as empresas da conta", () => {
    expect(migration).toContain("select e.id from public.empresas e where e.conta_id in (select public.user_contas_admin())");
    expect(migration).toMatch(/user_can_manage_company[\s\S]*e\.conta_id in \(select public\.user_contas_admin\(\)\)/);
  });

  it("só a plataforma cria conta e muda plano, situação, tipo e limites", () => {
    expect(migration).toContain("create policy contas_insert on public.contas for insert to authenticated\n  with check (public.is_super_admin());");
    expect(migration).toContain("Só a plataforma altera plano, situação, tipo e limites da conta.");
  });

  it("administradores da plataforma em tabela, sem perder o acesso pelo e-mail original", () => {
    expect(migration).toContain("or exists (select 1 from public.plataforma_admins p where p.user_id = auth.uid())");
    expect(migration).toContain("lower(coalesce(auth.jwt() ->> 'email', '')) = 'contato@pierogarcia.com.br'");
  });

  it("as empresas atuais entram na conta do dono, e as novas na conta de quem cria", () => {
    expect(migration).toContain("update public.empresas set conta_id = _conta where owner_id = _dono.owner_id and conta_id is null;");
    expect(migration).toContain("create trigger empresas_define_conta before insert on public.empresas");
  });
});

const convites = readFileSync(resolve(process.cwd(), "supabase/migrations/202611140002_convites_de_conta.sql"), "utf8");

describe("Migration de convites e membros", () => {
  it("aceitar exige convite pendente, no prazo e do e-mail de quem está logado", () => {
    expect(convites).toContain("if _convite.status <> 'pendente' then");
    expect(convites).toContain("if _convite.expira_em < now() then");
    expect(convites).toContain("if _convite.email <> _email then");
  });

  it("criar empresa exige conta ativa, participação e respeita o limite do plano", () => {
    expect(convites).toContain("Para cadastrar empresas, você precisa fazer parte de uma conta do Peter.");
    expect(convites).toContain("if _conta.situacao <> 'ativa' then");
    expect(convites).toContain("if _total >= _conta.limite_empresas then");
  });

  it("a conta mantém um administrador e o perfil Consultor é protegido", () => {
    expect(convites).toContain("A conta precisa de ao menos um administrador.");
    expect(convites).toContain("Só o Consultor (ou o administrador da conta) dá, tira ou remove o perfil Consultor.");
  });

  it("manutenção sem usuário logado pode mudar o plano", () => {
    expect(convites).toContain("if auth.uid() is not null and not public.is_super_admin() and (");
  });
});
