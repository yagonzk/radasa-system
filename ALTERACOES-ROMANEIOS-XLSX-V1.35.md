# ALTERAÇÕES — ROMANEIOS V1.35

## Correção da exportação
- Corrigido o botão da aba **Romaneios**, que ainda chamava o exportador CSV da versão anterior.
- O botão agora aparece como **Exportar Excel**.
- A saída agora é realmente um arquivo **.xlsx**.

## Template original
- O sistema carrega `client/public/templates/resumo-registro-de-viagens.xlsx` e utiliza a planilha enviada pelo usuário como modelo.
- Isso permite preservar a estrutura visual do arquivo: abas, cores, bordas, larguras, títulos e fórmulas do modelo.
- A alimentação é feita diretamente nas abas:
  - FAT MENSAL CLIENTE 2025
  - FAT MENSAL LEB 2025
  - FAT MENSAL CLIENTE 2026
  - FAT MENSAL LEB 2026
- A aba FAT MENSAL-ANUAL permanece com as fórmulas do modelo e é marcada para recalcular ao abrir no Excel.

## Regras de alimentação
- 1ª quinzena: dias 1 a 15.
- 2ª quinzena: dias 16 ao fim do mês.
- CLIENTE: Receber c/ Cliente.
- LEBRINHA: Acertar c/ Lebrinha + Bonificação - Lebrinha.
- Vasilhames permanecem fora do faturamento monetário.
- A exportação respeita os filtros atuais de Romaneios.
