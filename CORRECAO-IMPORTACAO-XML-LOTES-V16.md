# Correção de importação XML em massa — V16

## Alterações

- Leitura de XML reduzida para lotes de 5 arquivos.
- Apenas 1 lote de XML é interpretado por vez.
- Importação no banco reduzida para lotes de 5 abastecimentos.
- Apenas 1 requisição de gravação é executada por vez.
- Pausa curta entre lotes para aliviar Cloudflare Worker e Neon.
- Até 4 tentativas automáticas em timeout, 429, 502, 503 e 504.
- Payload máximo de cada lote reduzido para aproximadamente 700 KB.
- Timeout por requisição reduzido para 3 minutos; falhas temporárias são repetidas em vez de manter uma requisição gigante aberta.
- No backend, NF-es que já existem são identificadas em uma única consulta antes de abrir transações quando a política é IGNORAR.
- Um lote com erro não desfaz os lotes que já foram concluídos.

## Objetivo

Evitar picos de CPU, conexões e tempo de execução no Cloudflare/Neon durante importações grandes de XML/PDF.
