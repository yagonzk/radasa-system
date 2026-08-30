# Radasa System V33.23 — correção do TypeScript

Correções aplicadas sobre a V33.22:

- Corrigidos callbacks `fileFilter` do Multer nas rotas de Manutenção, Motoristas e Veículos.
- Tipagem explícita de `FornecedorNormalizado`, garantindo `tipos: string[]` nas operações Prisma.
- Tipagem explícita do retorno de importação automática SEFAZ.
- Proteção contra `xmlUrl` nulo ao reprocessar abastecimentos pendentes.
- Mantidas todas as funcionalidades da V33.22: Demandas no topo, Cadastro de Fornecedores e OS completa com itens, NFs e anexos.

## Atualização

```powershell
cd C:\Users\yago\Downloads\Radasa-System-Cloudflare-v1.4
pnpm install
npx prisma generate
npx prisma migrate deploy
pnpm run check
pnpm run build
npx wrangler deploy
```
