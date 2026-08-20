# Radasa System v1.61 — Média KM/L sem litros do último abastecimento

## Regra aplicada
Para calcular a Média KM/L dentro de qualquer filtro ativo:

- agrupa os abastecimentos Diesel por placa;
- usa somente os registros que passaram pelos filtros;
- calcula KM rodado entre o primeiro e o último odômetro válido do recorte;
- soma os litros Diesel do recorte;
- **desconsidera os litros do último abastecimento Diesel de cada placa**;
- calcula KM rodado / litros Diesel considerados.

O card "Litros Diesel" continua mostrando o total real filtrado. A exclusão do último
abastecimento é aplicada somente ao denominador da Média KM/L.

O relatório comparativo por placa usa a mesma regra.

Sem migration nova.
