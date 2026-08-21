# Radasa System v1.75 — Nota fiscal no Cadastro + alinhamento fixo das instalações

## Nota fiscal
- Removida a aba principal exclusiva **Notas fiscais**.
- Na aba **Cadastro**, cada pneu agora possui uma coluna **Nota fiscal**.
- Nessa coluna é possível anexar/substituir a NF diretamente no cadastro.
- Quando já existe NF, também é possível visualizar e baixar diretamente da lista.
- Ao abrir o histórico/detalhes de um pneu, a Nota fiscal aparece dentro da aba **Histórico**, junto da linha do tempo.
- A aba exclusiva "Nota fiscal" dentro do modal do pneu foi removida.

## Instalações
- Todos os 12 slots de pneus agora usam largura e altura fixas.
- O desenho do pneu instalado e do slot vazio ocupa exatamente a mesma caixa.
- A linha de cada eixo usa uma posição vertical fixa, independente do conteúdo do pneu.
- Marca, sulco e Número de fogo não alteram mais o alinhamento do desenho.
- O alinhamento permanece idêntico mesmo com posições vazias.

Sem migration nova. A migration de NF da v1.73 continua sendo utilizada.
