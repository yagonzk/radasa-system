import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const base = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => readFileSync(path.join(base, file), 'utf8');
test('Agro NF-e importa somente icones existentes no pacote lucide-react', () => {
  const src = read('client/src/pages/AgroFiscalNfe.tsx');
  assert.doesNotMatch(src, /\bCertificate\b/);
  assert.match(src, /import \{[^}]*ShieldCheck[^}]*\} from "lucide-react"/);
});
test('CSS nao contem seletor invalido de classe Tailwind com colchetes', () => {
  assert.doesNotMatch(read('client/src/index.css'), /\.text-\[11px\]/);
});
test('gitignore cobre dependencias, perfis temporarios e certificados', () => {
  const rules = read('.gitignore');
  for (const line of ['node_modules/', '.pnpm-store/', '.dnit-agent-profile/', '.senatran-agent-profile/', '.env', '*.pem', '*.pfx'])
    assert.ok(rules.includes(line), `Regra obrigatoria ausente: ${line}`);
  const probes = ['node_modules/.pnpm/pkg/node_modules/file.js', 'client/node_modules/react/index.js',
    '.dnit-agent-profile/Default/Local Storage/leveldb/000003.log',
    '.senatran-agent-cdp-profile/Default/session.json', '.env',
    'key.pem', 'sefaz-key.pem', 'certificado.pfx', 'desktop-app/dist/index.js'];
  const output = execFileSync('git', ['-c', `core.excludesFile=${path.join(base, '.gitignore')}`,
    'check-ignore', '--no-index', ...probes], { cwd: base, encoding:'utf8' });
  for (const probe of probes) assert.ok(output.split(/\r?\n/).includes(probe), `Protecao Git ausente: ${probe}`);
});
test('alternancia de ambiente informa etapa e faz rollback sem revelar segredos', () => {
  const script = read('Alternar-Ambiente-Conector-CIOT.ps1');
  assert.match(script, /CIOT_ATIVACAO_FALHOU etapa=/);
  assert.match(script, /CIOT_CONFIG_ANTERIOR_RESTAURADA/);
  assert.match(script, /CIOT_ATIVACAO_NAO_CONCLUIDA_/);
  assert.match(script, /CIOT_HEALTH_NAO_CONFIRMOU_AMBIENTE/);
  assert.match(script, /Read-Host.*ATIVAR CIOT PRODUCAO/);
  assert.doesNotMatch(script, /Write-(?:Host|Warning).*\$cfg\.pfxPassword/);
});
