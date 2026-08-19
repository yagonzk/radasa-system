# v1.51 - Relatório de combustível

Alterações no PDF de abastecimentos/combustível:

- Dashboard do relatório: removida a métrica "Postos no período" e adicionada "KM rodado".
- O KM rodado do dashboard respeita exatamente os filtros ativos e reutiliza a mesma base da Média KM/L.
- Em Notas fiscais, a coluna de veículo mostra somente a placa, sem modelo.
- Removida a coluna Subcategoria do relatório.
- Adicionada a coluna "Valor unitário Diesel" antes de "Valor total". O cálculo considera apenas valor e litros de Diesel; ARLA não entra nessa conta.
- Adicionada a coluna "KM rodado" por nota. O valor é a diferença para o odômetro Diesel válido anterior da mesma placa dentro do recorte filtrado; ARLA não cria referência de odômetro.
- Sem alteração de banco de dados / sem migration nova.
