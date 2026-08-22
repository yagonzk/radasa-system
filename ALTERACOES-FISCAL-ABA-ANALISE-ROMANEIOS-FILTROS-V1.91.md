# Radasa System v1.91 — Fiscal com aba objetiva de Análise Romaneios

## Nova organização do Fiscal
A aba Fiscal agora possui duas subabas:
- **Visão geral**: mantém faturamento, despesas, resultado, composição e comparativo mensal.
- **Análise Romaneios**: concentra a análise Cliente × Produto × Frete sem poluir a visão geral.

## Filtros da Análise Romaneios
Foram adicionados filtros para:
- pesquisa geral;
- cliente;
- produto;
- placa;
- romaneio;
- situação de pagamento.

O filtro de período De/Até continua no topo do Fiscal e é compartilhado pelas duas subabas.

## Mini dashboard filtrada
Os cards são recalculados imediatamente com os filtros selecionados:
- Frete Cliente;
- Recebido;
- A Receber;
- Total Lebrinha;
- Diferença Cliente − Lebrinha;
- quantidade de Romaneios.

## Tabela objetiva
A tabela principal foi reduzida para mostrar somente:
- Cliente;
- Produto;
- Quantidade;
- Frete unitário;
- Frete Cliente;
- Unitário Lebrinha;
- Total Lebrinha;
- Diferença;
- Margem;
- Situação;
- Romaneios.

A antiga conferência extensa linha a linha foi removida da tela para reduzir poluição visual.
Os dados detalhados continuam disponíveis na exportação XLSX filtrada.

## Exportação
O botão **Exportar filtrado** gera:
- Resumo filtrado;
- Cliente x Produto;
- Dados filtrados.

Sem migration nova.
