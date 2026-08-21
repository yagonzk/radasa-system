# Radasa System v1.80 — Ler romaneio na aba Viagens

- Adicionado botão **Ler romaneio** na aba Viagens.
- O PDF usa o mesmo OCR de alta resolução dos Romaneios.
- Após a leitura, abre o mesmo pop-up de **Registrar Viagem**.
- Preenche automaticamente, quando identificado: valor total do frete, cidade de destino, distância em KM, data do manifesto, placa e motorista.
- Placa é vinculada aos veículos cadastrados com normalização.
- Motorista é comparado aos motoristas ativos.
- Cidade usa DESTINO/ENTREGA e também procura cidades conhecidas em Locais/Viagens dentro da área de clientes.
- Distância usa DISTÂNCIA/KM/QUILOMETRAGEM e, se não estiver impressa, reutiliza a viagem mais recente para a mesma cidade.
- Pedágio, diária, abastecimento e chapa permanecem para preenchimento manual.
- O endpoint `/api/viagens/ler-romaneio` é somente leitura e não cria clientes, produtos ou manifestos.
- Sem migration nova.
