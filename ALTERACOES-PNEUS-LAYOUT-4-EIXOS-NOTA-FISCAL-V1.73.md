# Radasa System v1.73 — Layout fixo 4 eixos + Nota Fiscal de Pneus

## Instalações e rodízios
- Removidas as opções de quantidade de pneus e quantidade de estepes.
- Removida a seleção de carreta no módulo de pneus.
- O mapa passa a ser fixo para caminhão 4 eixos (8x2), com exatamente 12 pneus rodando e 1 estepe.
- Distribuição fixa:
  - Eixo 1: 2 pneus simples;
  - Eixo 2: 2 pneus simples;
  - Eixo 3: 4 pneus em rodado duplo;
  - Eixo 4: 4 pneus em rodado duplo;
  - 1 estepe.
- O desenho foi refeito em CSS no padrão esquemático do chassi, com os dois primeiros eixos simples e os dois últimos duplos.
- Instalações antigas com nomes de eixos legados são normalizadas visualmente para a nova posição fixa.

## Nota Fiscal do pneu
- Nova aba **Notas fiscais** no módulo de Pneus.
- Permite anexar um PDF ou imagem de até 2,5 MB a cada pneu.
- Permite substituir, visualizar, baixar e remover a nota fiscal.
- A listagem mostra número de fogo, marca/modelo, data da compra, valor e situação do anexo.
- O arquivo da nota fiscal é carregado somente quando o usuário solicita visualizar/baixar; a listagem não devolve o conteúdo pesado para o navegador.

## Banco de dados
Migration nova: `20260821143000_pneu_nota_fiscal`.
Adiciona `notaFiscalUrl` e `notaFiscalNome` em `pneus` usando `ADD COLUMN IF NOT EXISTS`.

## Permissões
- Removida também a antiga aba visual de **Permissões** da Gestão de Pneus, pois as operações do módulo já não exigem cargo específico desde a v1.70.
