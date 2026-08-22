# Radasa System v1.87 — Remove abastecimento da aba Viagens

## Alterações
- Removido o campo **Abastecimento (R$)** do cadastro e edição de Viagens.
- Removido o Abastecimento da visualização de detalhes da viagem.
- O custo total da viagem agora considera somente:
  - Pedágio;
  - Diária;
  - Chapa.
- Custo/KM e Lucro Bruto também ignoram Abastecimento.
- Registros antigos que ainda possuam `valorAbastecimento` no banco não têm mais esse valor considerado na aba Viagens.
- Ao criar ou editar uma viagem, `valorAbastecimento` é gravado como zero apenas para manter compatibilidade com a estrutura atual do banco.

A aba Fiscal continua buscando abastecimentos diretamente das Notas Fiscais do módulo Abastecimentos, portanto essa remoção não interfere no custo real de combustível do Fiscal.

Sem migration nova.
