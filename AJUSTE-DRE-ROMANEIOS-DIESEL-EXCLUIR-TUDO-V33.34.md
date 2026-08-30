# V33.34 — DRE por Romaneios, Diesel real e exclusão total

- Receita de fretes da DRE Operacional agora é calculada pelos valores dos produtos dos Romaneios no período, sem usar `Viagem.valorFrete` como fonte da DRE.
- Lançamentos manuais classificados como frete deixam de duplicar a receita automática de Romaneios na DRE.
- Combustível automático passa a considerar somente itens Diesel dos Abastecimentos para a linha `Abastecimento`.
- ARLA permanece separada como custo `ARLA`.
- Itens de abastecimento que não sejam Diesel/ARLA não entram como categoria genérica `Combustível`.
- O campo manual `valorAbastecimento` da viagem deixou de compor a análise de custos por caminhão.
- Categorias manuais de combustível/diesel/abastecimento/ARLA não duplicam custos automáticos vindos de Abastecimentos.
- A área Movimentações ganhou o botão `Excluir tudo`.
- `Excluir tudo` usa uma única requisição e uma transação no backend, removendo primeiro as baixas financeiras e depois todos os lançamentos, evitando centenas de DELETEs individuais.
