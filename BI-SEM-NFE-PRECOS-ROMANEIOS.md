# BI sem dependência de NF-e

O faturamento do BI volta a ser calculado sem exigir XML de NF-e.

## Regra

Para cada item de Romaneio:

`Faturamento = quantidade do item × preço unitário de venda`

Prioridade do preço:
1. preço do Produto + Cliente com vigência válida;
2. preço padrão do Produto com vigência válida;
3. se não houver preço anterior à data do Romaneio, usa o cadastro mais recente disponível do Produto/Cliente;
4. sem preço cadastrado, o faturamento daquele item permanece zero e o BI mostra quantos produtos estão sem preço.

## Preços do BI

Foi adicionado o botão **Preços do BI** no topo.

Ele lista somente produtos que aparecem nos Romaneios e permite cadastrar rapidamente
o preço padrão de venda. Preços específicos por cliente cadastrados no Fiscal continuam
com prioridade.

O botão de importação de NF-e foi removido do fluxo do BI.

## Gráficos

Com os preços preenchidos, voltam a ser alimentados:
- Frete x Faturamento por Produto;
- % Frete sobre o Faturamento do Produto;
- Faturamento x % Frete por Cliente;
- evolução de faturamento/frete;
- Faturamento e % Frete por Veículo;
- campos de faturamento da Consulta Geral.

Não há nova migration nesta correção.

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
git commit -m "fix: calcula faturamento do BI sem depender de nfe"
git push origin main
```
