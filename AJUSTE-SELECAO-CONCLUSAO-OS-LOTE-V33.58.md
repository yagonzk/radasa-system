# Radasa System V33.58 — seleção e conclusão de OS em lote

## Manutenção > Ordens de Serviço
- Adicionada seleção individual por checkbox na listagem de OS.
- Adicionado controle "Selecionar todas" respeitando os filtros atuais.
- OS concluídas e canceladas não podem ser selecionadas novamente.
- Ao selecionar uma ou mais OS aparece o botão "Marcar como concluída(s)" com a quantidade selecionada.
- A conclusão em lote pede confirmação antes de executar.

## Backend
- Nova rota `PUT /api/manutencao/ordens/concluir-lote`.
- Uma única requisição conclui até 500 OS selecionadas.
- A data de conclusão usada no lote é a data atual enviada pela interface.
- O lançamento de Manutenção no Financeiro é criado/atualizado para cada OS com custo maior que zero.
- O veículo só volta para `DISPONIVEL` quando não existe outra OS ativa para a mesma placa.
- OS já concluídas/canceladas enviadas por engano são ignoradas pelo backend.

## Arquivos principais
- `client/src/pages/Manutencao.tsx`
- `client/src/lib/manutencao-selection.ts`
- `client/src/lib/manutencao-selection.test.ts`
- `server/routes/manutencao.routes.ts`
- `server/controllers/manutencao.controller.ts`
- `server/services/manutencao.service.ts`

Não há migração de banco nesta versão.
