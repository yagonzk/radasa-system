# Radasa System v1.67 — Cadastro de pneus flexível

## Alterações
- Adicionado campo **ARO** ao cadastro, listagem, pesquisa e detalhes do pneu.
- Todos os campos do formulário de cadastro deixaram de ser obrigatórios.
- Quando o Número de Fogo não for informado, o sistema cria um identificador interno automaticamente para manter a integridade do cadastro.
- Valor, quilometragem e recapagens vazios são tratados como zero.
- Data de compra vazia recebe a data do cadastro internamente para manter compatibilidade com os relatórios existentes.
- Edição ficou explícita pelo botão de lápis e também pelo botão **Editar informações** dentro dos detalhes do pneu.
- QR Code e Código de Barras foram removidos da interface, pesquisa, validação e API do módulo. As colunas legadas permanecem no banco para evitar perda destrutiva de dados antigos.

## Banco de dados
Migration nova: `20260821083000_add_pneu_aro`

Ela apenas adiciona a coluna nullable `aro` com `ADD COLUMN IF NOT EXISTS`.
