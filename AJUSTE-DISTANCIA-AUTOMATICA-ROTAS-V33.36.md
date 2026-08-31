# V33.36 — Distância automática por ordem das cidades

## Acerto de Viagem
- Cidade de Entrega agora possui pesquisa de municípios pela lista do IBGE.
- Rotas também possuem pesquisa de municípios.
- A sequência é respeitada exatamente na ordem cadastrada: Ipiranga do Norte, MT → Rota 1 → Rota 2 → ... → Cidade de Entrega.
- A distância rodoviária é recalculada automaticamente via OSRM sempre que a rota/destino muda.
- O campo Distância (KM) passa a ser preenchido automaticamente e fica somente leitura.
- A tela mostra a distância de cada trecho e o total somado.
- Exemplo: Ipiranga do Norte → Sorriso + Sorriso → Lucas do Rio Verde = distância total da viagem.
- Geocodificação usa Nominatim/OpenStreetMap com cache local durante a sessão para reduzir chamadas repetidas.

## Banco
- Nenhuma migration necessária.
