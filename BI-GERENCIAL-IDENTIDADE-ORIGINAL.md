# BI Gerencial — identidade visual original do PBIX

Implementação baseada diretamente nos recursos visuais do arquivo `RADASA NF ROMANEIO.pbix`.

## O que foi preservado
- Os 4 backgrounds originais do Power BI em 1280x720 foram copiados sem redesenho.
- Mesmas quatro páginas:
  1. Desempenho de Produtos
  2. Análise por Cliente
  3. Análise por Veículo
  4. Consulta de Documentos
- Títulos e subtítulos nas coordenadas do relatório original.
- Paleta original principal: `#0A508E`, `#072F52` e `#FFBD2B`.
- Cards, áreas de gráfico, filtros e tabelas utilizam as posições do Layout do PBIX.

## Dados
O BI é alimentado pelos Romaneios já armazenados no Radasa System. O faturamento do produto usa a regra de preço de venda configurada em Comercial/Fiscal (`FiscalPrecoProduto`) quando disponível. Frete, quantidade, cliente, produto, placa, NF/Série e romaneio vêm dos Romaneios.

## Exportação
- **Exportar PDF** abre a impressão da página atual com CSS 16:9, preservando o fundo original e os componentes sobrepostos. Selecione “Salvar como PDF” no navegador.
- **Excel** exporta os dados filtrados que alimentam o BI.

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
git commit -m "feat: adiciona BI gerencial com identidade visual original"
git push origin main
```

Não há migration nesta atualização.
