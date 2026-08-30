# Ajuste SEFAZ - Pendências V33.32

## Alterações

- Documentos `resNFe` (somente resumo distribuído pela SEFAZ) deixam de ficar como `PENDENTE` e passam para `AGUARDANDO_XML`.
- Registros antigos `PENDENTE` do tipo resumo são normalizados automaticamente pelo `sefaz-agent` no próximo ciclo.
- XML completo de abastecimento não fica mais preso em pendência:
  - `IMPORTADO` quando criado em Abastecimentos;
  - `IGNORADO` quando não contém combustível reconhecido;
  - `ERRO` quando falta posto, placa/veículo, data ou ocorre falha real de importação.
- Documentos antigos pendentes que não são abastecimento são finalizados como `IGNORADO`.
- O agente não fica tentando novamente, a cada 30 segundos, os 42 documentos já marcados como `ERRO`.
- O popup de Status agora separa `Aguardando XML completo`, `Ignorados/não abastecimento`, `Erros`, `Novos` e eventuais pendências transitórias.

## Comportamento esperado

Ao iniciar o `sefaz-agent`, os 2 registros que estavam presos em `PENDENTE` serão classificados automaticamente no próximo ciclo. Se forem apenas resumos da SEFAZ, aparecerão como `AGUARDANDO_XML`, sem serem tratados como erro e sem permanecer no botão Pendente.
