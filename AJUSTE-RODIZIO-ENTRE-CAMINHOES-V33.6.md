# V33.6 — Rodízio de pneus entre caminhões

- A aba **Pneus > Rodízios** agora permite escolher **Caminhão A** e **Caminhão B**.
- Mantida a opção **Mesmo caminhão** para o rodízio tradicional entre posições do próprio veículo.
- No rodízio entre caminhões, são exibidos os dois mapas de chassi lado a lado e deve ser selecionado um pneu de cada caminhão.
- Ao registrar, os dois pneus trocam de caminhão e de posição em uma única transação no banco.
- O histórico passa a mostrar `PLACA A ↔ PLACA B` quando o rodízio ocorreu entre caminhões.
- O evento do pneu grava também veículo de origem e veículo de destino nos dados do histórico.
- Não foi necessária nova tabela ou migration: foi reaproveitado o vínculo de segundo veículo já existente no registro de rodízio.
