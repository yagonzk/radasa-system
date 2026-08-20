# Radasa System v1.65 — XLSX + ARLA detalhado

## Exportação XLSX
Adicionado botão **Gerar XLSX** no relatório de Abastecimentos.

O arquivo respeita todos os filtros ativos e separa as informações em:
- Resumo Diesel
- Notas Diesel
- Comparativo Diesel
- Resumo ARLA
- Notas ARLA
- Comparativo ARLA

As colunas numéricas são exportadas como números, com formatação de litros,
valores, odômetro e médias no Excel.

## Relatório ARLA
A página final de **Comparativo ARLA** do PDF agora também contém uma tabela
**Notas fiscais — ARLA**, no mesmo padrão da tabela de Diesel:
- NF
- Emissão
- Posto
- Placa
- Litros ARLA
- Valor unitário ARLA
- Odômetro
- Valor ARLA

ARLA continua totalmente separada dos totais e médias do Diesel.

Sem migration nova.
