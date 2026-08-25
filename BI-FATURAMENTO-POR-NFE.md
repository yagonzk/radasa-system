# BI — Faturamento pelos itens da NF-e

## O que mudou

O faturamento do BI agora pode vir dos itens reais das NF-e, reproduzindo a lógica do BI antigo:

**Romaneio → NF/Série + Produto → item da NF-e → vProd / faturamento**

### Cruzamento
1. NF + série + código do produto;
2. fallback por NF + código, quando a série não estiver disponível no Romaneio;
3. fallback por NF + descrição normalizada do produto;
4. se não houver NF-e importada correspondente, permanece o fallback de preço comercial já existente.

### Proteção contra duplicidade
Se uma mesma NF + produto estiver associada a mais de uma linha de Romaneio, o faturamento da NF não é repetido. O valor é distribuído proporcionalmente pela quantidade das linhas.

## Importação

Foi adicionado no topo do BI o botão **Importar NF-e XML**.

É possível selecionar vários XMLs ao mesmo tempo. O sistema interpreta a NF-e, grava cabeçalho e itens, atualiza uma NF-e existente quando a mesma chave for importada novamente e recalcula Faturamento e % Frete/Faturamento.

## Banco

Migration: `20260824212500_add_bi_nfe_itens`

Tabelas: `bi_nfes` e `bi_nfe_itens`.

## Publicação

```powershell
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```

## Git

```powershell
git add .
git commit -m "feat: integra faturamento do BI aos itens da nfe"
git push origin main
```
