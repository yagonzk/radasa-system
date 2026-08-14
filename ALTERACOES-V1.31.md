# ALTERAÇÕES — V1.31

## Pedágios
- Campo **Veículo** mantém a mesma largura de Origem/Destino (260 px em telas compatíveis).
- Corrigida a altura do seletor de Veículo para **48 px**, igual aos campos Origem/Destino.
- Foi usado `!h-[48px]` porque o componente Select possui uma regra interna `data-[size=default]:h-9` com maior especificidade.
- Mantida a quebra responsiva para evitar controles saindo do card.

## Abastecimentos
- Corrigido erro TypeScript TS2345 em `buildImportedProducts`.
- A lista `resolved` agora possui tipagem explícita dos produtos importados, eliminando a inferência `never[]`.
- Nenhuma alteração de banco/migration.
