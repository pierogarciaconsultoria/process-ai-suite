import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HttpError } from "./authorization-core.ts";

const GLOBAL_SCOPE = "00000000-0000-0000-0000-000000000000";

export type AiQuotaLease = {
  complete(consumedUnits?: number, estimatedCostMicros?: number): Promise<void>;
};

export async function acquireAiQuota(
  client: SupabaseClient,
  functionName: string,
  companyId?: string | null,
): Promise<AiQuotaLease> {
  const scope = companyId || GLOBAL_SCOPE;
  const requestLimit = Number(Deno.env.get("AI_RATE_LIMIT_REQUESTS") ?? "20");
  const concurrencyLimit = Number(Deno.env.get("AI_CONCURRENCY_LIMIT") ?? "2");
  const windowSeconds = Number(Deno.env.get("AI_RATE_LIMIT_WINDOW_SECONDS") ?? "60");
  const { data, error } = await client.rpc("acquire_ai_request", {
    _company_id: scope,
    _function_name: functionName,
    _request_limit: requestLimit,
    _concurrency_limit: concurrencyLimit,
    _window_seconds: windowSeconds,
  });
  if (error) throw new Error(`Falha ao aplicar limite de IA: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    throw new HttpError(429, `Limite de IA excedido. Tente novamente em ${result?.retry_after ?? 1} segundo(s).`, result?.retry_after ?? 1);
  }

  let completed = false;
  return {
    async complete(consumedUnits = 0, estimatedCostMicros = 0) {
      if (completed) return;
      completed = true;
      const { error: completionError } = await client.rpc("complete_ai_request", {
        _company_id: scope,
        _function_name: functionName,
        _consumed_units: Math.max(0, Math.ceil(consumedUnits)),
        _estimated_cost_micros: Math.max(0, Math.ceil(estimatedCostMicros)),
      });
      if (completionError) console.error("Falha ao registrar consumo de IA:", completionError.message);
    },
  };
}

export async function fetchWithAiQuota(
  client: SupabaseClient,
  functionName: string,
  companyId: string | null | undefined,
  consumedUnits: number,
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const lease = await acquireAiQuota(client, functionName, companyId);
  try {
    return await fetch(input, init);
  } finally {
    await lease.complete(consumedUnits, Math.max(1, Math.ceil(consumedUnits / 200)));
  }
}
