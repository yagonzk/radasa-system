export const normalizeEstoqueFilterText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

export function matchesEstoqueGlobalSearch(
  produto: { nome?: string | null; codigoInterno?: string | null },
  search: string,
) {
  const term = normalizeEstoqueFilterText(search);
  if (!term) return true;

  return [produto.nome, produto.codigoInterno]
    .some((value) => normalizeEstoqueFilterText(value).includes(term));
}
