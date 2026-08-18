# Radasa System v1.49 — Média KM/L seguindo filtros

- A Média KM/L é recalculada exclusivamente com os abastecimentos que passaram por todos os filtros ativos.
- O primeiro e o último odômetro são escolhidos somente entre lançamentos Diesel dentro do recorte filtrado.
- NF somente de ARLA não entra na quilometragem nem nos litros da média.
- A ordenação usa a data de emissão normalizada, inclusive para registros antigos em formatos diferentes.
- Se o filtro deixar menos de dois odômetros Diesel válidos para uma placa, essa placa não reutiliza KM de fora do período.
- O cartão da Média KM/L passa a exibir a memória da conta (KM ÷ litros Diesel e quantidade de placas consideradas).
- Nenhuma migration nova.
