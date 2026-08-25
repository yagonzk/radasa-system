# BI — pesquisa nos filtros

Adicionado campo de digitação aos filtros de **Cliente** e **Produto**.

- Digitar parte do nome filtra imediatamente as opções disponíveis.
- A pesquisa ignora maiúsculas/minúsculas e acentos.
- A seleção continua usando o mesmo filtro do BI.
- Implementado nas páginas de Produtos, Clientes, Veículos e Consulta Geral.
- A identidade visual e os fundos originais do Power BI foram mantidos.
- Não há migration.

## Publicar
```powershell
pnpm install
pnpm exec prisma generate
pnpm run check
pnpm run deploy:cloudflare
```
