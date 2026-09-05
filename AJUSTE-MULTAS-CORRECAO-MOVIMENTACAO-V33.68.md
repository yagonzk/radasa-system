# V33.68 — Multas da Frota + Correção de Movimentação

## Multas
- Nova aba `Frota > Multas`.
- Cadastro/edição/exclusão de infrações por veículo.
- Usa placa e RENAVAM do cadastro existente.
- Campos: auto, código, órgão, data/hora, local, descrição, pontos, valores, vencimento, status, observações e PDF opcional.
- Tenta identificar o motorista automaticamente pela viagem da mesma data e placa quando o motorista não é informado.
- Filtros por texto, placa e status; cards de pendências, valor em aberto e vencidas.
- `Ver multas da placa` consulta os registros internos do Radasa. A integração oficial SENATRAN/RENAINF permanece explicitamente desativada até haver credencial/autorização oficial.

## Almoxarifado
- Ação `Corrigir movimentação` em Entrada e Saída.
- Permite corrigir tipo, quantidade, valor unitário, data e observações da mesma movimentação.
- O produto permanece fixo para preservar rastreabilidade.
- O backend recalcula o saldo desconsiderando a movimentação antiga e bloqueia a correção se o estoque final ficar negativo.
- A correção ocorre em transação e mantém anexos/vínculos de nota fiscal já existentes.

## Banco
Nova migration: `20260905152000_add_multas_frota`.
