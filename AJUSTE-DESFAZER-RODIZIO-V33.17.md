# V33.17 — Desfazer rodízio de pneus

- Adicionada coluna **Ações** antes de **Data** no histórico de rodízios.
- Botão de retorno/desfazer em cada registro.
- Ao confirmar, os pneus voltam às posições de origem registradas no rodízio e o lançamento é removido do histórico de rodízios.
- O sistema impede o desfazer quando algum pneu já possui rodízio posterior, foi retirado/reinstalado ou a posição original está ocupada por outro pneu.
- Um evento de auditoria do tipo ALTERACAO é registrado em cada pneu afetado.
- Nenhuma migration nova é necessária.
