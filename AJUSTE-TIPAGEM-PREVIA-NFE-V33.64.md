# V33.64 — correção de tipagem da prévia de NF-e

Corrige os erros TS2339/TS2345 em `client/src/pages/Estoque.tsx` introduzidos na V33.63.

A causa era a interseção `EstoqueNfeParsed & { itens: ... }`, que preservava também o tipo original de `itens` e fazia o TypeScript tratar os elementos como `EstoqueNfeItem` sem os campos de UI (`incluir`, `categoria`, `subcategoria`, `nomeEditado`).

A prévia agora usa `Omit<EstoqueNfeParsed, "itens">` e redefine `itens` com `EstoqueNfePreviewItem[]`.

Não há nova migração de banco nesta versão.
