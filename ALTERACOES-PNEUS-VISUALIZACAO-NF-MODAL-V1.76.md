# Radasa System v1.76 — Visualização da NF do pneu em modal

## Correção
O botão **Visualizar** da nota fiscal não abre mais uma nova aba do navegador.

Agora, ao clicar em Visualizar:
- a NF é carregada pela mesma API usada no download;
- abre um modal grande dentro do próprio sistema;
- o modal ocupa aproximadamente 92% da altura e até 96% da largura disponível;
- PDFs são exibidos em um visualizador embutido;
- imagens são exibidas centralizadas e ajustadas ao espaço;
- fechar o modal mantém o usuário na tela de Pneus.

O comportamento foi aplicado tanto na coluna de NF do Cadastro quanto na visualização do Histórico do pneu.

Sem migration nova.
