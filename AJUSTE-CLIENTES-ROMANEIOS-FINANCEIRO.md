# Ajuste — Clientes da Visão Geral via Romaneios

Na análise gerencial do Financeiro, a visão **Clientes** agora usa os clientes registrados nos Romaneios.

A associação é feita por **data do manifesto + placa do veículo**:
- a viagem procura os romaneios daquela mesma data e placa;
- os clientes encontrados entram no ranking;
- se houver mais de um cliente na mesma viagem, receita, custos e distância são rateados entre eles para não duplicar os totais;
- se não existir romaneio correspondente, o sistema usa o cliente manual da viagem como fallback;
- lançamentos financeiros com cliente explícito continuam respeitando o cliente informado.

Não há nova migration.
