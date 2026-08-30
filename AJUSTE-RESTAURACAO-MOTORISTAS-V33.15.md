# V33.15 — Restauração dos Motoristas e vínculos

- Motoristas voltam a aparecer explicitamente no menu Cadastros, separados de Chapas.
- A aba Motoristas continua usando os registros existentes do banco; nenhuma rotina de exclusão ou recriação foi adicionada.
- A listagem passa a mostrar as placas dos veículos atualmente vinculados por `veiculos.motoristaId`.
- A listagem passa a mostrar a quantidade de viagens vinculadas por `viagens.motoristaId` e quantas estão em andamento.
- Os vínculos existentes entre motorista, veículo e viagem são preservados; esta versão não altera IDs nem executa limpeza/backfill destrutivo.
- A versão parte da V33.14, mantendo CIOT em subabas, Financeiro em subabas e a correção de edição de Viagens.
- Não há nova migration nesta versão.
