# V33.37 — Valor unitário do Diesel com desconto

- O valor unitário exibido do Diesel passa a considerar o desconto da nota.
- Fórmula: `(valor do Diesel - desconto) / litros de Diesel`.
- Aplicado na tabela principal e nas saídas/relatórios que exibem o valor unitário do Diesel.
- O desconto é limitado para nunca produzir valor negativo.
