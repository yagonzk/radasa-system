# V33.57 — Performance da Manutenção / Ordens de Serviço

## Problemas atacados
- Tela de Manutenção lenta ao abrir e após salvar OS.
- Sobrecarga ao cadastrar duas OS em sequência.
- Validação de estoque fazendo uma consulta por item/peça.
- Dashboard lendo todas as OS, documentos e abastecimentos completos.
- Detalhe da OS trazendo o Base64 completo de NF/anexos sem necessidade.
- Inclusão de novo anexo lendo novamente todos os documentos anteriores.
- Pós-salvamento recarregando dashboard, planos, ordens e documentos mesmo quando só OS/dashboard mudaram.

## Alterações
- Dashboard passou a usar `count`/`aggregate` e selects mínimos.
- Hodômetro de alertas busca somente placa/hodômetro dos veículos relevantes.
- Estoque é validado em lote por `groupBy`, evitando N consultas por peça.
- Itens e saídas de estoque são gravados com `createMany` dentro da transação.
- Detalhe da OS retorna apenas metadados de NF/anexos; o arquivo Base64 é lido apenas no endpoint de download.
- Upload de NF/anexo valida a existência da OS com `select { id }`, sem carregar o detalhe inteiro.
- Frontend impede submissão duplicada imediata com lock de salvamento.
- Após criar/editar/excluir/concluir OS, são recarregados apenas Dashboard + Ordens.

## Compatibilidade
- Sem alteração visual da Manutenção.
- Sem migração de banco necessária.
- Mantidos os endpoints existentes.
- Mantido o armazenamento atual de NF/anexos; apenas a leitura ficou sob demanda.
