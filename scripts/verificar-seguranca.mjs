import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const secrets = [
  "agente-config.json",
  path.join("ssagro-agent", "agente-config.json"),
  ".env", ".env.production", ".env.local",
];
const problems = [];
const { spawnSync } = await import("node:child_process");
const hasGitRepository = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "ignore" }).status === 0;
for (const name of secrets) {
  if (fs.existsSync(path.join(root, name))) {
    // Estes arquivos podem existir na máquina local, mas não devem entrar no Git.
    if (hasGitRepository) {
      const result = spawnSync("git", ["ls-files", "--error-unmatch", name], { cwd: root, stdio: "ignore" });
      if (result.status === 0) problems.push(`${name} está versionado (contém ou pode conter credenciais)`);
    }
  }
}
// Auditar TODOS os arquivos rastreados, inclusive os adicionados manualmente com git add -f.
// .gitignore protege arquivos NOVOS, mas nao protege arquivos ja versionados.
if (hasGitRepository) {
  const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  if (tracked.status !== 0) {
    problems.push("nao foi possivel auditar os arquivos rastreados pelo Git");
  } else {
    const forbidden = /(?:^|\/)(?:node_modules|\.pnpm-store|\.wrangler|\.dnit-agent-(?:cdp-)?profile|\.senatran-agent-(?:cdp-)?profile)(?:\/|$)|(?:^|\/)(?:\.env(?:\.[^/]*)?|config-protegida\.bin|agro-nfe-emissores\.enc)$|\.(?:pfx|p12|pem|key|jks|keystore)$/i;
    const allowedEnvExamples = /(?:^|\/)\.env\.(?:example|sample)$/i;
    for (const filename of tracked.stdout.split("\0").filter(Boolean)) {
      const portable = filename.replaceAll("\\", "/");
      if (!allowedEnvExamples.test(portable) && forbidden.test(portable)) {
        problems.push(`arquivo sensivel ou gerado rastreado: ${portable}`);
      }
    }
  }
}
for (const file of ["client/src/pages/Pedagios.tsx", "client/src/components/pneus/PneuGestao.tsx"]) {
  if (!fs.existsSync(path.join(root, file))) problems.push(`${file} não encontrado`);
}
if (problems.length) {
  console.error("[segurança] Ajustes necessários:\n" + problems.map(p => ` - ${p}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(hasGitRepository
    ? "[segurança] Nenhum arquivo de configuração sensível rastreado pelo Git."
    : "[segurança] Verificação de Git omitida: execute em um repositório Git para auditar arquivos rastreados.");
}
