# Radasa System v1.83 - Viagens: Ler manifesto DAMDFE/MDF-e

- O botão **Ler romaneio** foi substituído por **Ler manifesto**.
- A leitura foi adaptada ao DAMDFE/MDF-e Cargozilla enviado como referência.
- Preenche automaticamente valor total do frete, cidade de destino, KM, data do manifesto, placa e motorista.
- O valor do frete é lido da coluna **Vlr Frete** da linha **Totais**.
- Placa e Condutor são lidos dos blocos **Veículo** e **Condutor**.
- Origem e destino são lidos do bloco **Origem/Destino**.
- Como o DAMDFE de referência não imprime KM, o sistema calcula a distância rodoviária entre os municípios do manifesto; se a consulta falhar, usa o histórico da mesma cidade como fallback.
- O motorista vinculado à placa em Cadastros > Veículos continua tendo prioridade; o Condutor do manifesto é fallback.
- Pedágio, diária, abastecimento e chapa continuam manuais.
- A leitura não cria cadastros nem grava o manifesto no banco.

Sem migration nova.
