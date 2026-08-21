# Radasa System v1.81 — Fiscal: Diárias e Chapas separadas

## Alteração
A aba Fiscal não agrupa mais Diárias e Chapas em um único valor.

### Diárias
- Somadas exclusivamente a partir de `valorDiaria` de cada viagem.
- Exibidas como categoria própria na composição de despesas.
- Exibidas em coluna própria no comparativo mensal.
- Exibidas separadamente no XLSX.
- Mostra quantos lançamentos de diária com valor maior que zero existem no período.

### Chapas
- Somadas exclusivamente a partir de `valorChapa` de cada viagem.
- Exibidas como categoria própria na composição de despesas.
- Exibidas em coluna própria no comparativo mensal.
- Exibidas separadamente no XLSX.
- Mostra quantos lançamentos de chapa com valor maior que zero existem no período.

O total das despesas e o resultado fiscal continuam considerando os dois valores, mas cada um é verificado e calculado individualmente.

Sem migration nova.
