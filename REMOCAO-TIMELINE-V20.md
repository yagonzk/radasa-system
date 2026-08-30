# Radasa System V20 - Remoção da Timeline Operacional

- Removida a seção Timeline operacional do formulário de Viagens.
- Removidos Saída, Previsão de chegada, Chegada real, KM saída e KM chegada do formulário.
- Removida a exibição de ETA/Timeline no detalhe da viagem.
- O frontend não envia mais campos de timeline ao salvar/editar uma viagem.
- O backend preserva compatibilidade com dados antigos e só altera campos de timeline se uma chamada legada os enviar explicitamente.
- Mantidas as alterações anteriores: viagem sem cliente e motorista independente da placa.
