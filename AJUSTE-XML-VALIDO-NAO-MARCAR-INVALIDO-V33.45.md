# V33.45 — XML válido não deve virar INVÁLIDO por falha de vínculo

## Causa raiz
A rota de conferência já tinha interpretado o XML com sucesso, porém qualquer erro posterior em `sugerirVinculosAbastecimento` (consulta/criação de posto, veículo ou produto) era capturado e convertido em `status: "INVALIDO"`, descartando `documento` e `xmlUrl`.

Isso confundia falha de banco/vínculo com XML malformado.

## Correção
- Somente falhas no parsing/estrutura da NF-e continuam como `INVALIDO`.
- Falhas posteriores de vínculo agora ficam como `PENDENTE`, preservando o documento e o XML original.
- A conferência de XML não cria mais posto no banco; ela é somente leitura.
- Se o XML traz CNPJ/nome do emitente, o front-end permite que o posto seja resolvido/criado na transação de importação, fluxo que já existe em `abastecimentosService.importBatch`.
- Mantida a consolidação de produtos repetidos da V33.44.

## Testes
```bash
node scripts/test-abastecimento-xml-status-valido.mjs
node scripts/test-abastecimento-xml-produtos-repetidos.mjs
node scripts/test-abastecimentos-item-scope.mjs
node scripts/test-abastecimentos-report-visual.mjs
node scripts/test-romaneios-report-alignment.mjs
```
