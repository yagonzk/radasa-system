# Multas da Frota e Correção de Movimentação — Design

## Objetivo
Adicionar um módulo de Multas em Frota e permitir corrigir movimentações do Almoxarifado sem quebrar o saldo de estoque.

## Multas
- Nova rota/tela `/multas`, dentro do grupo Frota.
- Usa veículos já cadastrados, inclusive placa e RENAVAM.
- CRUD interno de infrações com auto, código, órgão, data/hora, local, descrição, pontos, valores, vencimento, status e PDF opcional.
- Quando o motorista não for informado, tenta identificá-lo por viagem na mesma data e placa.
- Filtros por texto, placa e status, além de indicadores de pendências, valor em aberto e vencidas.
- O botão de verificação por placa mostra os registros do Radasa e informa explicitamente que a consulta automática SENATRAN/RENAINF depende de credencial/autorização externa; nenhum resultado oficial é inventado.

## Correção de movimentação
- Entrada/Saída ganha ação “Corrigir movimentação”.
- Produto permanece fixo na correção; tipo, quantidade, valor unitário, data e observações podem ser alterados.
- O backend calcula o saldo desconsiderando a movimentação atual e só aceita a nova versão se o saldo final for não negativo.
- A atualização é persistida como edição da mesma movimentação, preservando anexos e vínculos de nota fiscal.
