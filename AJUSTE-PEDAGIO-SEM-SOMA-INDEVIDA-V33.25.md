# V33.25 — Correção de pedágios somados incorretamente

- Removida a regra que tratava qualquer saída de até R$ 60 como pedágio.
- Pedágio TruckPag agora só é reconhecido quando a descrição identifica explicitamente concessionária/praça conhecida.
- Na importação da planilha de Acerto, `PEDAGIO`, `CHAPA` e `DIARIA` são vinculados por data + placa (motorista como desempate).
- Quando a planilha informa PEDAGIO ou CHAPA, o valor informado passa a ser a fonte de verdade e substitui lançamentos TruckPag antigos daquele tipo na viagem, evitando soma dupla.
- Ex.: se a planilha informa PEDAGIO = R$ 345,00, a viagem fica com R$ 345,00, e não R$ 1.345,00.
