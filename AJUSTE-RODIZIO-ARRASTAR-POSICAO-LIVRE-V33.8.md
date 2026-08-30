# V33.8 — Rodízio por arrastar e posição livre

## Alterações
- Na aba Pneus > Rodízios, pneus instalados podem ser arrastados diretamente no mapa.
- Soltar sobre uma posição ocupada prepara a troca dos dois pneus.
- Soltar sobre uma posição livre prepara a movimentação de apenas um pneu para a posição vazia.
- Funciona no mesmo caminhão e entre dois caminhões selecionados.
- A movimentação só é efetivada ao clicar em **Registrar rodízio**, preservando data, quilometragem, responsável e motivo no histórico.
- O backend agora aceita rodízio com apenas um movimento quando o destino está livre.
- O backend valida se o destino está ocupado por um pneu que não participa da troca e bloqueia sobreposição indevida.
