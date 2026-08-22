# Radasa System v1.92 — Filtros na tabela e margem colorida

- Removido o painel de filtros que ficava acima da mini dashboard.
- Cliente e Produto agora são filtrados clicando diretamente no cabeçalho da tabela.
- Situação possui filtro no próprio cabeçalho.
- Romaneios possui filtro de Romaneio e Placa no próprio cabeçalho.
- A pesquisa geral ficou compacta dentro do cabeçalho de Resultado filtrado.
- Os valores monetários da mini dashboard não são mais truncados.
- Em telas comuns a dashboard usa 3 colunas, dando mais espaço para mostrar os valores completos.
- O card Romaneios foi substituído pelo card Margem.
- Margem = (Frete Cliente - Total Lebrinha) / Frete Cliente × 100.
- Margem alta: >= 30% (verde).
- Margem mediana: >= 15% e < 30% (amarela).
- Margem ruim: < 15% (vermelha).
- A coluna Margem da tabela usa a mesma classificação.
- O XLSX filtrado passa a incluir a margem percentual.

Sem migration nova.
