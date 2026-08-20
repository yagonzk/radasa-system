# Radasa System v1.64 — Relatórios Diesel e ARLA separados

## Relatório principal — Diesel
- Remove ARLA dos cards do relatório principal.
- Remove a coluna ARLA das Notas fiscais.
- Valor total do relatório principal passa a considerar somente o valor do Diesel.
- Comparativo por placa passa a ser exclusivamente Diesel.
- Notas sem Diesel não aparecem na parte principal.

## Página final — Comparativo ARLA
Quando existem lançamentos de ARLA dentro dos filtros ativos, o PDF ganha uma nova página no final com:
- Litros ARLA;
- Valor total ARLA;
- Custo médio ARLA/L;
- quantidade de notas com ARLA;
- comparativo por placa com notas, litros, custo médio e valor de ARLA.

ARLA não interfere nos totais, custo médio ou comparativo do Diesel.
Sem migration nova.
