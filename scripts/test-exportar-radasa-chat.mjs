import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const batPath = path.join(root, 'Exportar-Radasa-Chat.bat');

assert.ok(fs.existsSync(batPath), 'Exportar-Radasa-Chat.bat deve existir na raiz do projeto');

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'radasa-chat-export-'));

try {
  const run = spawnSync('cmd.exe', ['/c', batPath], {
    cwd: root,
    env: {
      ...process.env,
      RADASA_CHAT_EXPORT_DIR: outputDir,
      RADASA_CHAT_EXPORT_STAMP: 'TEST',
      RADASA_CHAT_EXPORT_NO_PAUSE: '1',
    },
    encoding: 'utf8',
    timeout: 120000,
  });

  assert.equal(run.status, 0, `exportador deve encerrar com sucesso\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);

  const zips = fs.readdirSync(outputDir).filter((name) => name.endsWith('_chat_TEST.zip'));
  assert.equal(zips.length, 1, 'exportador deve criar exatamente um ZIP com o carimbo solicitado');

  const zipPath = path.join(outputDir, zips[0]);
  assert.ok(fs.statSync(zipPath).size > 0, 'ZIP criado nao pode ficar vazio');

  const list = spawnSync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-Command',
      [
        '$ErrorActionPreference = "Stop";',
        'Add-Type -AssemblyName System.IO.Compression.FileSystem;',
        '$archive = [System.IO.Compression.ZipFile]::OpenRead($env:RADASA_TEST_ZIP);',
        'try { $archive.Entries | ForEach-Object { $_.FullName } } finally { $archive.Dispose() }',
      ].join(' '),
    ],
    {
      env: { ...process.env, RADASA_TEST_ZIP: zipPath },
      encoding: 'utf8',
      timeout: 30000,
    },
  );

  assert.equal(list.status, 0, `deve ser possivel listar o ZIP criado\nSTDOUT:\n${list.stdout}\nSTDERR:\n${list.stderr}`);

  const entries = list.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll('\\', '/'))
    .filter(Boolean);

  for (const expected of ['package.json', 'client/src/App.tsx', 'server/index.ts', 'prisma/schema.prisma']) {
    assert.ok(entries.includes(expected), `ZIP deve incluir ${expected}`);
  }

  const forbiddenPrefixes = [
    'node_modules/',
    '.git/',
    'dist/',
    'dist-sefaz-agent/',
    'dist-dnit-agent/',
    'dist-senatran-agent/',
    'dados/',
    'IMPORTACAO/',
    'relatorios/',
    '.wrangler/',
    '.cache/',
    'coverage/',
  ];
  for (const prefix of forbiddenPrefixes) {
    assert.ok(!entries.some((entry) => entry.startsWith(prefix)), `ZIP nao deve incluir ${prefix}`);
  }

  const forbiddenSuffixes = ['.zip', '.7z', '.rar', '.log', '.tmp', '.bak', '.csv', '.xlsx', '.xls', '.pdf', '.xml', '.sqlite', '.sqlite3', '.db'];
  for (const suffix of forbiddenSuffixes) {
    assert.ok(!entries.some((entry) => entry.toLowerCase().endsWith(suffix)), `ZIP nao deve incluir arquivos ${suffix}`);
  }

  assert.ok(!entries.some((entry) => entry.split('/').some((part) => part.startsWith('.env'))), 'ZIP nao deve incluir arquivos .env');
} finally {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

console.log('exportar radasa chat regression: OK');
