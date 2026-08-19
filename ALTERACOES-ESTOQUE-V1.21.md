# Radasa System v1.21 — Produtos independentes no Estoque

## Alteração principal

A aba **Estoque** agora possui um cadastro próprio de produtos e não utiliza mais os produtos cadastrados na aba **Cadastros > Produtos**.

### Tipos permitidos no Estoque

- Produtos de Piscina
- Peças
- Ferramentas

Não é possível criar categorias adicionais no estoque.

## Interface

Na aba Estoque foi adicionado o botão **Novo produto**. O produto é criado diretamente no estoque, com:

- Nome do produto
- Código interno
- Tipo de produto

Os produtos podem ser editados ou excluídos na tabela de estoque. Produtos que já possuam movimentações não podem ser excluídos para preservar o histórico.

A tela de Cadastros também informa que seus produtos são independentes do Estoque.

## Banco de dados

Foi criada a tabela `estoque_produtos` e as movimentações de estoque agora apontam para ela.

A migration `20260813101500_separar_produtos_estoque` preserva o histórico existente: somente produtos que já tinham movimentações de estoque são copiados para a nova tabela. Produtos da aba Cadastros sem movimentação não são levados para o Estoque.

## Deploy

Após atualizar o projeto, aplique as migrations do Prisma no banco de produção:

```bash
npx prisma migrate deploy
```

O build/deploy deve executar `prisma generate` normalmente para gerar o client com o novo model `EstoqueProduto`.
