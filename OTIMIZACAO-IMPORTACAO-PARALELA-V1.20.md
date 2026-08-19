# V1.20 — Importação paralela de abastecimentos

## O que mudou

- A tela **Abastecimento > Importar XML/PDF** agora aceita múltiplos XMLs e PDFs no mesmo lote.
- XMLs são enviados em lotes de 20, com até 3 lotes sendo lidos ao mesmo tempo.
- Dentro de cada requisição, o backend processa até 4 documentos concorrentemente.
- PDFs são extraídos/analisados com até 2 arquivos simultâneos para evitar travar o navegador durante OCR/leitura.
- A barra de progresso avança conforme cada lote/arquivo termina, inclusive quando a ordem de conclusão é diferente da ordem dos arquivos.
- Falha em um lote não interrompe os demais; os arquivos daquele lote ficam marcados como inválidos para nova tentativa.
- A gravação final também trabalha com até 2 lotes em paralelo.

## Otimizações no backend

- A verificação de NF-e já cadastrada passou de uma consulta por XML para uma única consulta por lote.
- Clientes, veículos e produtos de combustível são carregados uma vez por requisição e reutilizados nas sugestões.
- A criação automática de combustível usa trava transacional PostgreSQL para evitar duplicação quando requisições concorrentes tentam cadastrar o mesmo produto.

## PDFs em massa

- PDFs podem ser misturados aos XMLs na mesma seleção/pasta.
- PDFs de até 2,5 MB podem ser anexados ao cadastro em massa.
- PDFs maiores continuam sendo interpretados e importados, mas o arquivo original não é enviado em base64 para não ultrapassar o limite JSON de 4 MB do servidor.
- Como a leitura de PDF é auxiliar, registros sem chave, placa, odômetro, posto ou produto associado continuam como **Pendentes** para conferência.

## Limites mantidos

- Até 1000 documentos por seleção.
- XML continua sendo a fonte mais precisa e rápida para abastecimentos.
