# Radasa System v1.47 — Correção do filtro de posto em Abastecimentos

- Corrige o filtro de **Posto** na aba Abastecimentos.
- O valor selecionado no menu (nome + CNPJ + código) agora é comparado com o mesmo formato exibido no registro.
- Adiciona fallback por CNPJ exato e nome do posto, permitindo filtrar corretamente postos como **MAE CAROLINA** mesmo quando o cadastro foi enriquecido/corrigido após a importação da NF-e.
- Mantém as correções anteriores de posto por emitente, Diesel/ARLA, odômetro opcional e média KM/L.
- Não adiciona migration.
