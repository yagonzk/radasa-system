# V33.5 — Relatórios e pendências em Abastecimentos

## Alterações

- Os três botões de relatório da tela de Abastecimentos foram agrupados em um único botão **Relatórios**.
- Dentro do menu **Relatórios** permanecem:
  - Gerar relatório PDF
  - Relatório comparativo
  - Comparativo XLSX
- Quando existir pelo menos uma NF-e SEFAZ com status `PENDENTE`, aparece no cabeçalho da tela um botão **Pendente** com a quantidade atual.
- O botão **Pendente** abre o mesmo painel de Status da sincronização para conferência.
- O contador de pendências é atualizado automaticamente a cada 30 segundos mesmo com o painel de Status fechado.
- Essa atualização consulta apenas o endpoint interno de status do Radasa; ela não força nova consulta na SEFAZ e não interfere na proteção contra cStat 656.
