# V33.67 — Ordem cronológica das viagens no Fechamento de Comissão

- As viagens do fechamento agora são ordenadas pela data real (`dataViagem`) em ordem crescente.
- A viagem mais antiga aparece sempre primeiro e a mais recente por último.
- A mesma regra é reaproveitada na edição/visualização e nos relatórios CSV/PDF por meio de `expandirViagensFechamento`.
- Registros antigos sem data ficam ao final, preservando sua ordem relativa.
- Não há alteração de banco de dados nem nova migration.
