# v1.48 - Indicadores respeitando todos os filtros em Abastecimentos

- Centraliza a regra de filtragem dos abastecimentos em uma única função.
- Litros Diesel, Litros ARLA, valores, custo médio e Média KM/L usam exatamente o mesmo conjunto filtrado exibido na tabela.
- Filtro de data é inclusivo e normaliza registros antigos em ISO completo ou DD/MM/YYYY.
- As opções de cada filtro passam a respeitar os demais filtros já ativos (filtros encadeados).
- A interface informa quantos abastecimentos estão sendo usados nos indicadores.
- Não altera banco de dados e não cria migration.
