import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const authService = read('server/services/auth.service.ts');
const usuariosService = read('server/services/usuarios.service.ts');
const app = read('server/app.ts');
const gate = read('server/middlewares/concurrency-gate.ts');
const logger = read('server/middlewares/request-logger.ts');
const authPage = read('client/src/pages/Auth.tsx');

assert.ok(!/bcrypt\.compare\(/.test(authService), 'auth.service ainda executa bcrypt.compare dentro do Worker');
assert.ok(!/bcrypt\.hash\(/.test(authService), 'auth.service ainda executa bcrypt.hash dentro do Worker');
assert.ok(!/bcrypt\.hash\(/.test(usuariosService), 'usuarios.service ainda executa bcrypt.hash dentro do Worker');

const passwordService = read('server/services/password-hash.service.ts');
assert.match(passwordService, /crypt\s*\(/i, 'serviço de senha deve verificar bcrypt no PostgreSQL/pgcrypto');
assert.match(passwordService, /gen_salt\s*\(\s*'bf'/i, 'serviço de senha deve gerar bcrypt no PostgreSQL/pgcrypto');
assert.match(passwordService, /CREATE EXTENSION IF NOT EXISTS pgcrypto/i, 'serviço deve garantir pgcrypto');
assert.match(passwordService, /\$2b\$/i, 'serviço deve aceitar hashes bcryptjs $2b$ existentes');

assert.match(gate, /skip\?\s*:/, 'gate deve permitir excluir rotas leves da fila de mutações');
assert.match(app, /auth\/login/, 'app deve excluir /auth/login da fila global de mutações');

assert.match(authPage, /useRef/, 'login deve usar trava síncrona para evitar duplo envio');
assert.match(authPage, /loginInFlightRef\.current/, 'login deve bloquear submissões simultâneas');

assert.match(logger, /req\.aborted/, 'logger deve considerar o sinal real de aborto da request');
assert.ok(!/writeLog\(!res\.writableEnded\)/.test(logger), 'logger ainda usa writableEnded isoladamente e gera falso positivo no Worker');

console.log('auth cloudflare cpu regression: ok');
