# Radasa System v1.62 — Correção do último abastecimento na Média KM/L

Corrigida a definição do "último abastecimento" usado na Média KM/L.

Agora o sistema usa exatamente a mesma ordem exibida na tabela:
1. maior data de emissão;
2. em caso de empate na data, maior odômetro;
3. depois data de criação e ID apenas como desempate técnico.

Para cada placa dentro do filtro:
- soma todos os litros Diesel filtrados;
- identifica o PRIMEIRO abastecimento Diesel da ordem visual como o último abastecimento;
- subtrai somente os litros desse abastecimento;
- usa o restante como litros da Média KM/L.

A memória da conta passa a mostrar também quantos litros foram excluídos.

Exemplo validado:
1.364,31 L filtrados - 215,00 L do último abastecimento = 1.149,31 L para a média.

Sem migration nova.
