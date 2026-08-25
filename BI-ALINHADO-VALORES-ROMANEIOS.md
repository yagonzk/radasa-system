# BI — valores alinhados aos Romaneios

Correção da origem dos valores de frete do BI.

## Regra aplicada

O BI agora segue exatamente a mesma regra usada na tela de Romaneios:

- o valor do frete vem de `ManifestoProduto.valorTotal`;
- itens do tipo `Vasilhame` não entram no total de frete;
- não é feito recálculo por `quantidade × valorUnitario`;
- quantidade de vasilhames continua disponível para análises de volume;
- valores monetários continuam formatados em R$.

Isso evita que produtos como GARRAFÃO 20 LT inflem o Frete Total quando seus itens
estiverem classificados como Vasilhame.

Não há migration.

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
git commit -m "fix: alinha valores do BI aos romaneios"
git push origin main
```
