# BI — filtros com pesquisa no próprio dropdown

Correção dos filtros de Cliente e Produto para seguir o padrão usado em Romaneios.

- Não existe mais campo separado para pesquisa.
- Ao clicar em Cliente ou Produto, abre a lista de opções.
- O campo de pesquisa aparece dentro do dropdown.
- A lista é filtrada enquanto o usuário digita.
- Há opção para voltar a "Todos".
- O visual fechado do BI permanece nas mesmas posições e dimensões.
- Implementado nas páginas Desempenho de Produtos, Análise por Cliente, Análise por Veículo e Consulta Geral.
- Não há migration.

## Publicação
```powershell
pnpm install
pnpm exec prisma generate
pnpm run check
pnpm run deploy:cloudflare
```
