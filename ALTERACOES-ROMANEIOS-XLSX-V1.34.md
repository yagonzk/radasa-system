# ALTERAÇÕES — ROMANEIOS V1.34

## Exportação formatada
- A exportação do resumo de viagens de **Romaneios** passou a seguir a **formatação visual da planilha de referência**.
- Como **CSV não suporta cores, largura de coluna, estilos, bordas e formatação rica**, a exportação formatada passa a ser feita em **XLSX (Excel)**.
- O arquivo mantém a estrutura:
  - Mês/Ano
  - Placa
  - Tipo
  - 1ª
  - 2ª
  - Total
- Foram adotados:
  - cabeçalho formatado
  - mesmas larguras de coluna
  - alinhamentos
  - formatação monetária em pt-BR
  - cores e apresentação baseadas na planilha enviada pelo usuário
- O template `resumo-registro-de-viagens.xlsx` foi incluído em `client/public/templates/` para servir de base à exportação.

## Observação
- Se necessário, a exportação CSV simples pode continuar existindo em paralelo, mas a saída com **cores e formatação exata** precisa ser em **.xlsx**.
