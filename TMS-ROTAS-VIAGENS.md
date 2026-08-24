# Rotas nas Viagens

- Adicionado campo `rotas` em Viagens como lista ordenada de cidades intermediárias.
- O campo aparece logo abaixo de Cidade de Entrega.
- É possível adicionar e remover cidades preservando a ordem.
- As rotas são salvas no PostgreSQL em `TEXT[]`.
- A visualização da viagem mostra a sequência completa até o destino.
- A busca geral da aba Viagens também encontra cidades intermediárias.

## Atualização

```powershell
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```
