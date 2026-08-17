# ALTERAÇÕES — ABASTECIMENTOS V1.42

## Média KM/L por período filtrado

A média de consumo da aba Abastecimentos passa a seguir o intervalo atualmente filtrado.

Para cada placa:

1. Ordena os abastecimentos filtrados por data, odômetro e criação.
2. Usa o **primeiro odômetro** do período como início.
3. Usa o **último odômetro** do período como fim.
4. Calcula os KM rodados como `último odômetro - primeiro odômetro`.
5. Soma todos os litros abastecidos daquela placa dentro do mesmo período filtrado.
6. Calcula `KM rodados / litros totais`.

Quando mais de uma placa estiver no filtro, o indicador geral soma os KM rodados válidos de cada placa e divide pela soma dos litros dessas mesmas placas.

O cálculo não busca mais um abastecimento anterior fora do intervalo de datas para formar a média. Assim, alterar o filtro de data faz o sistema usar sempre o primeiro lançamento de KM existente dentro do intervalo escolhido.
