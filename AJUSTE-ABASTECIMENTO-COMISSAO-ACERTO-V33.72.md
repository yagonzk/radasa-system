# V33.72 — Abastecimento e comissão no Acerto de Viagem

## Acerto de Viagem
- Permite selecionar um abastecimento já cadastrado para a mesma placa.
- O valor do abastecimento é obtido do registro original no backend; o cliente não define o valor livremente.
- O backend bloqueia vínculo de abastecimento pertencente a outra placa.
- A comissão é calculada automaticamente conforme a cidade final do acerto, usando o cadastro de Locais/Comissões.
- Abastecimento e comissão entram no custo/lucro do próprio Acerto de Viagem.

## DRE Operacional
- O abastecimento selecionado no Acerto não é somado novamente no DRE; o DRE continua usando a base oficial de Abastecimentos.
- A comissão do Acerto de Viagem não entra no DRE.
- Os fechamentos de comissão também deixaram de ser somados no DRE, evitando que a mesma natureza volte por outra fonte.
- Custo Extra continua fora do DRE.

## Banco
Migration: `20260905163500_viagem_abastecimento_comissao`
- `viagens.abastecimentoId`
- `viagens.valorComissao`
- FK opcional para `abastecimentos`
