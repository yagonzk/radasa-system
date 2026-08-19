# ALTERAÇÕES — ROMANEIOS CSV V1.33

## Exportação baseada na planilha "resumo registro de viagens"

O botão **Exportar CSV** da aba Romaneios passa a gerar um resumo pronto para alimentar a estrutura de controle mensal/quinzenal da planilha enviada como referência.

### Estrutura do CSV
- Mês/Ano
- Placa
- Tipo
- 1ª
- 2ª
- Total

Para cada placa são geradas três linhas por mês:
- LEBRINHA
- CLIENTE
- TOTAL

### Regras
- **1ª**: romaneios do dia 1 ao dia 15.
- **2ª**: romaneios do dia 16 até o fim do mês.
- **LEBRINHA**: soma de `Acertar c/ Lebrinha` + `Bonificação - Lebrinha`.
- **CLIENTE**: soma de `Receber c/ Cliente`.
- **TOTAL**: soma de Lebrinha + Cliente.
- **Vasilhame**: não entra no faturamento monetário deste resumo.
- O CSV respeita todos os filtros atualmente aplicados na tela de Romaneios.
- Se os filtros abrangerem vários meses, o arquivo gera os blocos de todas as competências de forma tabular usando a coluna Mês/Ano.
- As placas são exportadas sem hífen para ficar compatível com o padrão visual da planilha de referência.

### Exportação individual
O botão de CSV dentro de um romaneio individual continua exportando os itens detalhados, sem alteração.

### Banco de dados
Nenhuma migration nova.
