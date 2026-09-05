# V33.59 — Categorias por item da Ordem de Serviço

- Adiciona categoria individual para cada serviço, peça ou outro item da OS.
- Mantém exatamente 17 categorias mecânicas padronizadas.
- Adiciona botão `?` ao lado do seletor para explicar a categoria selecionada com exemplos.
- Novos itens exigem categoria; itens históricos sem categoria continuam compatíveis e aparecem como `Sem categoria`.
- Categoria é persistida em `ordem_servico_itens.categoria` e aparece também no detalhamento da OS.
- Inclui migration `20260905113000_add_categoria_ordem_servico_item`.

## Atualização

```powershell
pnpm install
pnpm prisma migrate deploy
pnpm run check
pnpm run build
```
