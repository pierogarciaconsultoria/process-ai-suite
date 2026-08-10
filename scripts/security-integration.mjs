import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.SUPABASE_API_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mockUrl = process.env.MOCK_AI_URL ?? "http://127.0.0.1:54329";
assert(anonKey && serviceKey, "SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required");

const admin = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "Test-password-123!";
const companyA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const processA = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa";
const processB = "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb";
const missingProcess = "cccccccc-0000-4000-8000-cccccccccccc";
const roles = ["owner-a", "owner-b", "admin-a", "gestor-a", "analista-a", "analista-b"];
const users = {};

const expectNoError = (result, label) => assert.equal(result.error, null, `${label}: ${result.error?.message}`);
const clientFor = (token) => createClient(apiUrl, anonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const role of roles) {
  const email = `${role}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expectNoError(created, `create ${role}`);
  const signedIn = await createClient(apiUrl, anonKey).auth.signInWithPassword({ email, password });
  expectNoError(signedIn, `sign in ${role}`);
  users[role] = { id: created.data.user.id, token: signedIn.data.session.access_token, client: clientFor(signedIn.data.session.access_token) };
}

expectNoError(await admin.from("empresas").insert([
  { id: companyA, nome: "Empresa A", owner_id: users["owner-a"].id },
  { id: companyB, nome: "Empresa B", owner_id: users["owner-b"].id },
]), "seed companies");
expectNoError(await admin.from("membros").insert([
  { empresa_id: companyA, user_id: users["admin-a"].id, perfil: "admin" },
  { empresa_id: companyA, user_id: users["gestor-a"].id, perfil: "gestor" },
  { empresa_id: companyA, user_id: users["analista-a"].id, perfil: "analista" },
  { empresa_id: companyB, user_id: users["analista-b"].id, perfil: "analista" },
]), "seed memberships");
expectNoError(await admin.from("processos").insert([
  { id: processA, company_id: companyA, nome: "Processo A", created_by: users["owner-a"].id },
  { id: processB, company_id: companyB, nome: "Processo B", created_by: users["owner-b"].id },
]), "seed processes");

for (const role of ["owner-a", "admin-a", "gestor-a", "analista-a"]) {
  const own = await users[role].client.from("processos").select("id").eq("id", processA);
  expectNoError(own, `${role} own read`);
  assert.equal(own.data.length, 1, `${role} must read company A`);
  const foreign = await users[role].client.from("processos").select("id").eq("id", processB);
  expectNoError(foreign, `${role} foreign read`);
  assert.deepEqual(foreign.data, [], `${role} must not infer company B process`);
  const changed = await users[role].client.from("processos").update({ nome: "cross-tenant" }).eq("id", processB).select("id");
  expectNoError(changed, `${role} foreign update`);
  assert.deepEqual(changed.data, [], `${role} must not update company B`);
  const removed = await users[role].client.from("processos").delete().eq("id", processB).select("id");
  expectNoError(removed, `${role} foreign delete`);
  assert.deepEqual(removed.data, [], `${role} must not delete company B`);
  const inserted = await users[role].client.from("processos").insert({ company_id: companyB, nome: "cross", created_by: users[role].id });
  assert(inserted.error, `${role} must not insert into company B`);
}

const permissionMatrix = {
  "owner-a": { companyUpdate: true, memberManage: true },
  "admin-a": { companyUpdate: false, memberManage: true },
  "gestor-a": { companyUpdate: false, memberManage: true },
  "analista-a": { companyUpdate: false, memberManage: false },
};
for (const [role, expected] of Object.entries(permissionMatrix)) {
  const companyUpdate = await users[role].client.from("empresas").update({ segmento: role }).eq("id", companyA).select("id");
  expectNoError(companyUpdate, `${role} company update`);
  assert.equal(companyUpdate.data.length === 1, expected.companyUpdate, `${role} company update permission`);
  const memberUpdate = await users[role].client.from("membros").update({ invited_by: users[role].id }).eq("user_id", users["analista-a"].id).select("id");
  expectNoError(memberUpdate, `${role} member manage`);
  assert.equal(memberUpdate.data.length === 1, expected.memberManage, `${role} member management permission`);
}

const functions = {
  "ai-fill-process": { valid: { company_id: companyA, descricao: "Descrição integrada do processo" }, cross: { company_id: companyB, descricao: "Descrição integrada do processo" } },
  "ai-diagnose-process": { valid: { company_id: companyA, process_id: processA, processoData: { nome: "A" } }, cross: { company_id: companyB, process_id: processB, processoData: {} }, missing: { company_id: companyA, process_id: missingProcess, processoData: {} } },
  "ai-generate-bpmn": { valid: { company_id: companyA, process_id: processA, resumo: "Fluxo" }, cross: { company_id: companyB, process_id: processB, resumo: "Fluxo" }, missing: { company_id: companyA, process_id: missingProcess, resumo: "Fluxo" } },
  "ai-interview": { valid: { company_id: companyA, process_id: processA, history: [], current: {} }, cross: { company_id: companyB, process_id: processB, history: [], current: {} }, missing: { company_id: companyA, process_id: missingProcess, history: [], current: {} } },
  "ai-helpcenter": { valid: { history: [], page: "/" }, invalid: { history: "invalid", page: "/" } },
  "ai-review-config": { valid: { company_id: companyA, roteiro: "Roteiro" }, cross: { company_id: companyB, roteiro: "Roteiro" } },
  "ai-summarize-process": { valid: { company_id: companyA, process_id: processA, processoData: {} }, cross: { company_id: companyB, process_id: processB, processoData: {} }, missing: { company_id: companyA, process_id: missingProcess, processoData: {} } },
  "ai-generate-document": { valid: { companyContext: { companyId: companyA }, process_id: processA, mappedProcessData: { normalized: {} }, template: { name: "T" }, sections: [] }, cross: { companyContext: { companyId: companyB }, process_id: processB, mappedProcessData: { normalized: {} }, template: { name: "T" }, sections: [] }, missing: { companyContext: { companyId: companyA }, process_id: missingProcess, mappedProcessData: { normalized: {} }, template: { name: "T" }, sections: [] } },
};

const invoke = async (name, token, payload, apiKey = anonKey) => fetch(`${apiUrl}/functions/v1/${name}`, {
  method: "POST",
  headers: { apikey: apiKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
  body: JSON.stringify(payload),
});
const resetMock = () => fetch(`${mockUrl}/reset`, { method: "POST" });
const mockCount = async () => (await (await fetch(`${mockUrl}/metrics`)).json()).count;

await resetMock();
for (const [name, cases] of Object.entries(functions)) {
  assert.equal((await invoke(name, null, cases.valid)).status, 401, `${name} missing JWT`);
  assert.equal((await invoke(name, "invalid-token", cases.valid)).status, 401, `${name} invalid JWT`);
  assert.equal((await invoke(name, users["owner-a"].token, cases.invalid ?? {})).status, 400, `${name} invalid payload`);
  if (cases.cross) assert.equal((await invoke(name, users["owner-a"].token, cases.cross)).status, 403, `${name} cross tenant`);
  if (cases.missing) assert.equal((await invoke(name, users["owner-a"].token, cases.missing)).status, 404, `${name} missing resource`);
}
assert.equal(await mockCount(), 0, "denied and invalid requests must not call AI providers");

for (const [name, cases] of Object.entries(functions)) {
  const response = await invoke(name, users["owner-a"].token, cases.valid);
  assert.equal(response.status, 200, `${name} authorized success: ${await response.text()}`);
}
for (const role of ["owner-a", "admin-a", "gestor-a"]) {
  assert.equal((await invoke("ai-review-config", users[role].token, functions["ai-review-config"].valid)).status, 200, `review allowed for ${role}`);
}
assert.equal((await invoke("ai-review-config", users["analista-a"].token, functions["ai-review-config"].valid)).status, 403, "review denied for analyst");
assert.equal((await invoke("ai-review-config", users["analista-b"].token, functions["ai-review-config"].valid)).status, 403, "review denied cross tenant");

const concurrentResponses = await Promise.all([
  invoke("ai-fill-process", users["owner-a"].token, functions["ai-fill-process"].valid),
  invoke("ai-fill-process", users["owner-a"].token, functions["ai-fill-process"].valid),
  invoke("ai-fill-process", users["owner-a"].token, functions["ai-fill-process"].valid),
]);
assert.deepEqual(concurrentResponses.map((response) => response.status).sort(), [200, 200, 429], "concurrency limit must reject the third request");
assert.equal(concurrentResponses.find((response) => response.status === 429)?.headers.get("retry-after"), "1", "concurrency 429 must include Retry-After");

for (let index = 1; index < 20; index += 1) {
  assert.equal((await invoke("ai-helpcenter", users["owner-a"].token, functions["ai-helpcenter"].valid)).status, 200, `quota request ${index + 1}`);
}
const callsBeforeQuotaDenial = await mockCount();
const quotaDenied = await invoke("ai-helpcenter", users["owner-a"].token, functions["ai-helpcenter"].valid);
assert.equal(quotaDenied.status, 429, "request quota must return 429");
assert(Number(quotaDenied.headers.get("retry-after")) >= 1, "quota 429 must include Retry-After");
assert.equal(await mockCount(), callsBeforeQuotaDenial, "quota denial must not call the AI provider");

const usage = await admin.from("ai_usage_limits").select("request_count,active_requests,consumed_units,estimated_cost_micros");
expectNoError(usage, "usage ledger");
assert(usage.data.length >= 8, "usage ledger must contain function scopes");
assert(usage.data.every((row) => row.active_requests === 0), "all concurrency leases must be released");
assert(usage.data.every((row) => row.consumed_units > 0 && row.estimated_cost_micros > 0), "usage and estimated cost must be recorded");

console.log(JSON.stringify({ users: roles.length, rls: "passed", edgeFunctions: Object.keys(functions).length, rateLimit: "passed", externalCalls: await mockCount() }, null, 2));
