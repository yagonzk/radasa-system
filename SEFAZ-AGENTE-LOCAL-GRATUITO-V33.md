# V33 — Agente SEFAZ local gratuito

A consulta ao Ambiente Nacional não é mais feita pelo mTLS do Cloudflare Worker. Um agente Node.js roda no Windows da empresa e usa o certificado A1 armazenado no cadastro da Empresa, acessando o mesmo banco Neon do Radasa.

## Funcionamento

- O agente consulta automaticamente a cada 5 minutos quando permitido pela SEFAZ.
- Após cStat 137 ou 656, continua respeitando a espera mínima de 1 hora.
- O botão **Forçar atualização** grava uma solicitação no banco; o agente local a percebe em até 30 segundos.
- O popup **Status** informa quando o agente estiver offline.
- O Worker da Cloudflare não tenta mais abrir conexão mTLS com a SEFAZ.
- Nenhum servidor, VPS, API paga ou Cloudflare Container é necessário.

## Requisitos no computador que ficará ligado

- Node.js e pnpm instalados.
- O arquivo `.env` do projeto deve possuir a mesma `DATABASE_URL` usada pelo Radasa em produção.
- Certificado A1 e senha cadastrados na aba Empresa do Radasa.

## Primeira publicação

```powershell
pnpm install
npx prisma generate
pnpm run check
npx prisma migrate deploy
pnpm run deploy:cloudflare
```

## Iniciar o agente

Execute `Iniciar-Agente-SEFAZ.cmd`.

Para iniciar automaticamente ao entrar no Windows, abra PowerShell como administrador na pasta do projeto e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Instalar-Agente-SEFAZ-Inicializacao.ps1
```

Para remover a inicialização automática:

```powershell
.\Remover-Agente-SEFAZ-Inicializacao.ps1
```
