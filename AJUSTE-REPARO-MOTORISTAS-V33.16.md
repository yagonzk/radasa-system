# V33.16 — Restauração de motoristas e vínculos

## Causa identificada
A migration `20260828133500_add_motorista_cnh_emissao` usava `ALTER TABLE "Motorista"`, mas o model Prisma `Motorista` está mapeado para a tabela real PostgreSQL `motoristas` (`@@map("motoristas")`).

Quando essa migration falha, a coluna `cnhEmissao` não é criada. O Prisma atual passa a solicitar essa coluna ao listar motoristas e a API `/motoristas` pode retornar erro 500. Com a lista vazia no frontend, motorista parece ter desaparecido também de veículos e viagens, embora `viagens.motoristaId` continue sendo NOT NULL e protegido por FK.

## Correções
- Corrigida a migration para `ALTER TABLE "motoristas" ADD COLUMN IF NOT EXISTS "cnhEmissao" DATE`.
- Nenhum motorista é apagado ou recriado; os IDs existentes são mantidos.
- Vínculos das viagens são preservados pelo próprio `motoristaId` existente.
- Migration complementar preenche apenas `veiculos.motoristaId IS NULL`, usando o motorista da viagem mais recente da mesma placa. Vínculos de veículo já existentes não são alterados.

## Se a migration anterior ficou marcada como FAILED
Execute antes do `migrate deploy`:

`npx prisma migrate resolve --rolled-back 20260828133500_add_motorista_cnh_emissao`

Depois execute `npx prisma migrate deploy` normalmente.
