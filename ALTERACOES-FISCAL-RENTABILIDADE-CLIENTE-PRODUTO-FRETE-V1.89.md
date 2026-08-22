# Radasa System v1.89 — Fiscal: Rentabilidade Cliente × Produto × Frete

## Nova análise comercial
A aba Fiscal ganhou a seção **Rentabilidade Cliente × Produto × Frete**.

Os produtos dos Romaneios passam a ser agrupados por cliente/produto e exibem:
- cliente;
- produto;
- quantidade;
- frete unitário médio;
- frete total registrado;
- custo unitário do produto comprado da Lebrinha;
- custo total dos produtos;
- valor unitário do produto pago pelo cliente;
- total pago pelo cliente pelos produtos;
- total mapeado do cliente (produto + frete);
- margem dos produtos;
- resultado comercial bruto;
- margem comercial.

Vasilhames são desconsiderados.

## Tabela comercial com histórico
Foi criada uma tabela histórica para cadastrar:
- produto;
- cliente específico ou Todos os clientes;
- vigência inicial;
- custo unitário Lebrinha;
- valor unitário do produto pago pelo cliente.

A regra específica do cliente tem prioridade sobre a regra geral. A regra vigente
é a mais recente cuja data seja anterior ou igual à data do Romaneio.

## Auditoria de frete
A nova área **Auditoria de frete** permite escolher Cliente/Produto, informar o
frete unitário que deveria ter sido pago e comparar:
- quantidade;
- frete unitário registrado;
- frete total registrado;
- frete esperado;
- divergência.

## Exportação
A nova análise possui XLSX próprio com:
- Rentabilidade;
- Tabela de preços.

## Observação
O Resultado comercial bruto desta primeira etapa considera:
`frete registrado + margem do produto`.

Custos operacionais como diesel, pedágio, comissão, diária e chapa continuam no
consolidado geral do Fiscal, mas ainda não são rateados individualmente por
cliente/produto nesta análise.

## Banco
Nova tabela: `fiscal_precos_produtos`.
Migration: `20260822001500_fiscal_precos_produtos`.
