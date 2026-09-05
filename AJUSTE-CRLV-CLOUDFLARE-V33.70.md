# V33.70 — Correção da leitura de CRLV no Cloudflare

## Causa
O endpoint `/api/veiculos/crlv-pdf/interpretar` executava `pdf-parse` dentro do Cloudflare Worker.
Nesse ambiente, a dependência entrou em recursão durante a resolução do módulo e gerou
`RangeError: Maximum call stack size exceeded`.

## Correção
- A extração do texto do PDF passou para o navegador, usando o `pdfjs-dist` que o projeto já utiliza.
- O frontend envia somente o texto extraído para `/api/veiculos/crlv-texto/interpretar`.
- O backend continua responsável por interpretar e validar os dados do CRLV.
- PDFs escaneados continuam podendo usar o OCR já existente no frontend.
- O PDF original continua sendo anexado normalmente ao cadastro do veículo.

## Banco
Nenhuma migration nova.
