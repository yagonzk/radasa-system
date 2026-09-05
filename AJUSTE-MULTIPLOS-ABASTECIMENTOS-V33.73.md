# V33.73 — Múltiplos abastecimentos no Acerto de Viagem

## Alterações
- O vínculo de abastecimento no Acerto de Viagem agora aceita várias notas na mesma viagem.
- O seletor possui pesquisa por texto por NF, posto/emitente, CNPJ, chave, data e valor.
- As notas selecionadas ficam visíveis na ficha e podem ser removidas individualmente.
- O custo de combustível da viagem passa a ser a soma das notas vinculadas.
- Todos os abastecimentos continuam obrigatoriamente pertencendo à mesma placa da viagem.
- Combustível vinculado ao acerto continua fora do DRE Operacional para evitar duplicidade; o DRE usa a aba Abastecimentos diretamente.
- A migration preserva automaticamente o vínculo único criado na V33.72.

## Banco
Nova tabela `viagem_abastecimentos` com chave composta `viagemId + abastecimentoId`.
O campo legado `viagens.abastecimentoId` foi mantido temporariamente para compatibilidade com versões anteriores.
