# ALTERAÇÕES — ALMOXARIFADO V1.40

## Tipos de produto independentes

- Os tipos de produto do **Almoxarifado** agora possuem cadastro próprio no banco (`estoque_tipos_produto`).
- O Almoxarifado continua usando exclusivamente `estoque_produtos`; não consulta nem reutiliza os produtos da aba **Cadastros** (`produtos`).
- Os tipos iniciais são preservados:
  - Produtos de Piscina
  - Peças
  - Ferramentas
- Qualquer tipo já existente nos produtos antigos do Almoxarifado também é preservado pela migration.

## Gerenciador de tipos

- Ao lado do seletor **Tipo de produto** foi adicionado um botão `+`.
- O botão abre um pop-up para:
  - criar novos tipos de produto;
  - visualizar os tipos já cadastrados;
  - visualizar quantos produtos usam cada tipo;
  - remover tipos que não estejam em uso.
- Se um tipo possuir produtos vinculados, sua remoção é bloqueada para evitar produtos sem classificação.
- O mesmo botão `+` também aparece no cadastro/edição de produto para facilitar a criação de um tipo durante o lançamento.

## Validação

- O backend só permite criar/editar um produto do Almoxarifado usando um tipo que exista no cadastro próprio do Almoxarifado.
- Não existe dependência com categorias ou produtos da aba Cadastros.

## Banco de dados

Migration adicionada:

`20260817141000_almoxarifado_tipos_produto`

Foi incluída também uma cópia idempotente em:

`scripts/criar-tipos-produto-almoxarifado.sql`
