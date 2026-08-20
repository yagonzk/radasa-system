# Radasa System v1.63 — Correção do registro excluído da Média KM/L

Corrigido o sentido da exclusão dos litros na Média KM/L.

A tabela de Abastecimentos é exibida do mais novo para o mais antigo.
A regra correta passa a ser:

- manter o primeiro registro (mais novo) normalmente;
- excluir os litros do **último registro da placa dentro do filtro**;
- usar os demais litros Diesel no denominador da Média KM/L.

Exemplo RAU-3I63 (03/08 a 14/08):
- Litros Diesel filtrados: 1.293,401 L
- Último registro do filtro: 03/08/2026 = 144,092 L
- Litros considerados na Média KM/L: 1.149,309 L

A mesma regra foi aplicada ao relatório comparativo por placa.

Sem migration nova.
