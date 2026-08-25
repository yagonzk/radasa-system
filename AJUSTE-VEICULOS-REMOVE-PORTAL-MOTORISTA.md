# Ajuste de navegação

- Em **Cadastros**, a opção `Frota` foi renomeada para **Veículos**.
- O **Portal do Motorista** foi removido da navegação.
- A rota `/portal-motorista` foi removida do frontend.
- A API específica do Portal do Motorista também foi removida.
- O cadastro de Motoristas, CNH, MOPP, toxicológico, documentos e alertas continua no sistema para uso administrativo.
- Não há nova migration.

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
git commit -m "refactor: renomeia frota para veiculos e remove portal do motorista"
git push origin main
```
