# V33.61 — Fechamentos com viagens individuais e data real

- Novo Fechamento exibe cada viagem individualmente com `DD/MM/AAAA - Destino`.
- Removido o campo de quantidade da interface de viagens.
- A data real da viagem passa a ser persistida em `fechamento_viagens.dataViagem`.
- PDF remove Qtd/Valor Unit./Subtotal e mostra somente Viagem + Valor.
- CSV passa a identificar as viagens por data + destino, sem sufixo de quantidade.
- Fechamentos antigos continuam compatíveis: quando a data ainda não estiver persistida, o sistema tenta reconstruí-la a partir do Acerto de Viagem.
- Cada viagem é tratada como uma linha individual (quantidade interna = 1).
