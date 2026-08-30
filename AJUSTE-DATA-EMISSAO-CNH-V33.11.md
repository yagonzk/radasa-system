# V33.11 — Data de emissão da CNH

Adicionado o campo **Data de emissão da CNH** no cadastro e edição de motoristas.

O campo é persistido no banco como data (`cnhEmissao`) e retornado pelas APIs de motoristas.

## Migration

A migration adiciona a coluna opcional `cnhEmissao` na tabela `Motorista`.
