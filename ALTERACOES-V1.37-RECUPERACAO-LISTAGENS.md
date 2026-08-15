# V1.37 — Recuperação de listagem dos Romaneios

## Correção principal
- A listagem de Romaneios voltou a ser uma operação somente de leitura.
- A V1.36 fazia uma sincronização com UPDATE no banco antes de devolver a listagem.
- Se qualquer UPDATE falhasse, a requisição inteira de Romaneios falhava e os registros podiam parecer ausentes na interface.
- Agora os modelos e placas atuais são combinados em memória com o cadastro de Veículos, sem bloquear a consulta dos Romaneios.

## Modelo do veículo continua automático
- Romaneios antigos continuam recebendo visualmente o modelo atual pelo vínculo por ID ou placa normalizada.
- Ao alterar o veículo, o sistema ainda tenta persistir placa/modelo nos Romaneios históricos.
- Essa persistência é não bloqueante: uma falha nela não impede o cadastro/edição do veículo nem a leitura dos Romaneios.

## Banco de dados
- Nenhuma migration nova.
- Nenhuma exclusão ou reset de dados.
