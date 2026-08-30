# Ajuste

Removidos da interface:
- **Comercial > CRM e Propostas**
- **Financeiro > Rentabilidade**

Também foram removidas a página/rota e API específicas do CRM.

**Cadastros > Comercial** foi mantido, pois contém os cadastros de clientes, produtos e empresa.

As tabelas já criadas do CRM permanecem no banco para não executar exclusão destrutiva de dados.
Não há migration nova.

## Publicação
```powershell
pnpm install
pnpm exec prisma generate
pnpm run check
pnpm run deploy:cloudflare
```

## Git
```powershell
git add .
git commit -m "refactor: remove crm propostas e rentabilidade"
git push origin main
```
