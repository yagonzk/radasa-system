# Radasa System v1.50 — Abastecimentos: KM rodado e valor unitário do Diesel

## Alterações

- A mini dashboard de Abastecimentos não mostra mais Litros ARLA.
- O cartão foi substituído por **KM Rodado**, usando exatamente o mesmo recorte filtrado da Média KM/L.
- O KM Rodado soma as diferenças de odômetro válidas das placas calculadas dentro dos filtros ativos.
- O cartão de custo foi renomeado para **Valor unitário Diesel** e continua calculado exclusivamente por `valor dos itens Diesel / litros Diesel`.
- A coluna/filtro **Valor unitário Diesel** agora lista somente valores de registros que possuem Diesel.
- Abastecimentos somente com ARLA exibem `—` nessa coluna, em vez de `R$ 0,00`.
- ARLA continua disponível nos detalhes e relatórios, mas não participa da média KM/L nem do valor unitário do Diesel.

## Banco de dados

Nenhuma migration nova.
