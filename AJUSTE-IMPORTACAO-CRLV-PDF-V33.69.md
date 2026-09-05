# V33.69 — Importação automática de CRLV em PDF

## Cadastro de veículos

- O campo de CRLV continua aceitando clique e arraste-e-solte.
- Ao selecionar um PDF, o sistema envia o documento para leitura antes de salvar o veículo.
- Quando encontrados no CRLV, são preenchidos automaticamente: placa, RENAVAM, chassi, marca, modelo/versão, ano de fabricação, ano/modelo, cor, combustível, proprietário e subcategoria do veículo.
- O exercício do CRLV é identificado e informado ao usuário, sem inventar uma data de validade a partir dele.
- Campos que não forem reconhecidos permanecem com o valor já digitado e podem ser corrigidos manualmente antes de salvar.
- O PDF selecionado continua sendo anexado ao cadastro quando o veículo é salvo.
- PDFs sem camada de texto suficiente não sobrescrevem o formulário; o arquivo pode continuar anexado e o preenchimento pode ser feito manualmente.

## API

Novo endpoint autenticado no módulo existente de veículos:

`POST /api/veiculos/crlv-pdf/interpretar`

Recebe `multipart/form-data` no campo `arquivo`, limitado a PDF de até 10 MB.

## Banco

Não há nova migração Prisma nesta versão.
