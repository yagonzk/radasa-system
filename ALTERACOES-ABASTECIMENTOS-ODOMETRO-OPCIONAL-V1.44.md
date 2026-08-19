# Radasa System v1.44 - Odômetro opcional nos Abastecimentos

- Remove a obrigatoriedade do odômetro no lançamento manual de abastecimentos.
- Remove a obrigatoriedade do odômetro na importação em massa por XML/PDF.
- Quando não informado, o backend mantém o valor técnico `0` para compatibilidade com a estrutura atual do banco, sem migration.
- Na interface, odômetro ausente é exibido como `—`.
- A média KM/L ignora lançamentos sem odômetro apenas na escolha do primeiro/último KM, mas mantém os litros desses lançamentos no total do período da placa.
- Não altera registros já existentes nem cria migration.
