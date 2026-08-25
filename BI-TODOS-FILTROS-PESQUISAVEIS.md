# BI — todos os filtros pesquisáveis

Todos os filtros de seleção do BI agora seguem o mesmo padrão do Romaneios:

- Placa
- Cliente
- Produto
- Romaneio
- NF/Série

Ao clicar no filtro:
1. abre a lista;
2. aparece a pesquisa dentro do próprio dropdown;
3. é possível digitar para reduzir as opções;
4. existe a opção "Todos".

Também foram refinados:
- altura dos filtros;
- tamanho da fonte;
- ícone da seta;
- bordas e sombras;
- altura da lista;
- campos de período.

O objetivo foi encaixar melhor os controles dentro do layout original do Power BI sem alterar a identidade visual das quatro páginas.

Não há migration.

## Publicação

```powershell
pnpm install
pnpm exec prisma generate
pnpm run check
pnpm run deploy:cloudflare
```

## Git

```powershell
git add .
git commit -m "feat: padroniza todos os filtros pesquisaveis do BI"
git push origin main
```
