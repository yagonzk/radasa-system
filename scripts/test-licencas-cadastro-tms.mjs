import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script, createContext } from "node:vm";

// Executável com: node scripts/test-licencas-cadastro-tms.mjs
// Carrega a lógica real da licença, substituindo apenas o acesso ao banco.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = read("server/services/module-license.service.ts");
const sourceWithoutImports = source.replace(/^import\s.+?;\s*$/gm, "");
const code = ts.transpileModule(sourceWithoutImports, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
});
assert.equal((code.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0);

class FakeAppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

let account = null;
const prisma = {
  user: {
    findUnique: async () => account,
  },
};
const exports = {};
const context = createContext({ exports, prisma, AppError: FakeAppError, Date, Map, Number, Math });
new Script(code.outputText).runInContext(context);
const { assertUserModuleAccess, userLicenseSummaries } = exports;
const module = "TRANSPORTES";
const denied = async (statusCode, status) => {
  await assert.rejects(
    () => assertUserModuleAccess("usuario-cadastrado", "VISUALIZACAO", module),
    (error) => error.statusCode === statusCode && (!status || error.details?.status === status),
  );
};

// 1. Cadastro sem licença, mesmo após a aprovação.
assert.equal(userLicenseSummaries("VISUALIZACAO", []).find((item) => item.module === module).status, "NAO_CONTRATADO");
account = { active: true, role: "VISUALIZACAO", moduleLicenses: [] };
await denied(403, "NAO_CONTRATADO");

// 2. A aprovação não pode criar licenças implicitamente.
const auth = read("server/services/auth.service.ts");
const register = auth.split("  async register(")[1]?.split("  async forgotPassword(")[0];
assert.ok(register, "O cadastro público deve existir");
assert.match(register, /active:\s*false/);
assert.doesNotMatch(register, /moduleLicenses\s*:|moduleLicense\.(?:upsert|create)/);
const approval = read("server/services/usuarios.service.ts").split("  async approve(")[1]?.split("  async reject(")[0];
assert.ok(approval, "A aprovação administrativa deve existir");
assert.match(approval, /data:\s*\{\s*active:\s*true\s*\}/);
assert.doesNotMatch(approval, /moduleLicenses\s*:|moduleLicense\.(?:upsert|create)/);

// 3. Licença ativa autoriza acesso, mas expiração e suspensão bloqueiam.
account = { active: true, role: "VISUALIZACAO", moduleLicenses: [{ active: true, unlimited: false, expiresAt: new Date(Date.now() + 30 * 86_400_000) }] };
assert.equal((await assertUserModuleAccess("usuario-cadastrado", "VISUALIZACAO", module)).status, "ATIVA");
account.moduleLicenses[0].expiresAt = new Date(Date.now() - 86_400_000);
await denied(403, "VENCIDA");
account.moduleLicenses[0].active = false;
await denied(403, "SUSPENSA");

// 4. Um perfil antigo ADMIN no JWT não consegue furar o bloqueio.
account = { active: true, role: "VISUALIZACAO", moduleLicenses: [] };
await assert.rejects(() => assertUserModuleAccess("usuario-cadastrado", "ADMIN", module), (error) => error.statusCode === 403);

// 5. Somente ADMIN atual tem acesso permanente; contas desativadas não acessam.
account = { active: true, role: "ADMIN", moduleLicenses: [] };
assert.equal((await assertUserModuleAccess("admin", "ADMIN", module)).status, "ILIMITADA");
account.active = false;
await denied(401);

// 6. Exibição da licença Transportes na sidebar.
const layout = read("client/src/components/Layout.tsx");
assert.match(layout, /getModuleLicense\(user, "TRANSPORTES"\)/);
assert.match(layout, /moduleStatusLabel\(transportLicense\)/);
assert.match(layout, /Licença Transportes/);

console.log("OK: cadastro e aprovação sem licença, acesso por vencimento, suspensão, perfil atual e sidebar TMS.");
