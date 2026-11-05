// Tipos mínimos do ambiente Deno para checar as edge functions com o tsc do app
// (npm run check:functions). Não é usado na implantação.
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}
declare const Deno: { env: { get(nome: string): string | undefined } };
declare module "npm:nodemailer@6.9.16" {
  // deno-lint-ignore no-explicit-any
  const nodemailer: any;
  export default nodemailer;
}
