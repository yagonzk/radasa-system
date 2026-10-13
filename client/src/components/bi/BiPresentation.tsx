import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Search, SlidersHorizontal, TableProperties } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { StagingBiFact } from "@/lib/bi-staging";

export type BiFact = StagingBiFact & { produtoKey: string; mes: string; percentual: number };
export type BiTotals = { quantidade: number; faturamento: number; frete: number; valorProduto: number; valorFrete: number; percentual: number };
export type BiColumn = { key: string; label: string; get: (row: BiFact) => string };
export type BiRankItem = { name: string; faturamento: number; frete: number };

const formatMoney = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatNumber = (value: number) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const formatPercent = (value: number) => `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const formatDate = (value: string) => {
  const parts = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : value || "—";
};
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const metricDefinitions = [
  { key: "faturamento", label: "Faturamento", subtitle: "Total no período", format: formatMoney, accent: "blue" },
  { key: "frete", label: "Frete total", subtitle: "Valor de frete", format: formatMoney, accent: "gold" },
  { key: "quantidade", label: "Quantidade", subtitle: "Volume movimentado", format: formatNumber, accent: "blue" },
  { key: "valorProduto", label: "Valor unitário produto", subtitle: "Indicador consolidado", format: formatMoney, accent: "neutral" },
  { key: "valorFrete", label: "Valor unitário frete", subtitle: "Indicador consolidado", format: formatMoney, accent: "neutral" },
  { key: "percentual", label: "Frete / faturamento", subtitle: "Participação percentual", format: formatPercent, accent: "gold" },
] as const;

export function BiMetrics({ totals, testId }: { totals: BiTotals; testId?: string }) {
  const [showMore, setShowMore] = useState(false);
  const principalKeys = new Set(["faturamento", "frete", "quantidade", "percentual"]);
  return (
    <section className="bi-v3__metrics" data-testid={testId} aria-label="Indicadores do BI">
      {metricDefinitions.filter((item) => showMore || principalKeys.has(item.key)).map((item) => (
        <div key={item.key} className={`bi-v3__metric bi-v3__metric--${item.accent}`}>
          <span className="bi-v3__metric-accent" aria-hidden="true" />
          <p className="bi-v3__metric-label">{item.label}</p>
          <strong className="bi-v3__metric-value" title={item.format(totals[item.key])}>{item.format(totals[item.key])}</strong>
        </div>
      ))}
      <button type="button" className="bi-v3__more-metrics" onClick={() => setShowMore((value) => !value)} aria-expanded={showMore}>
        {showMore ? "Menos indicadores" : "Mais indicadores"}<ChevronDown className={cn("h-3.5 w-3.5", showMore && "rotate-180")} />
      </button>
    </section>
  );
}

export function BiRanking({ rows, emptyMessage = "Nenhum registro encontrado para os filtros selecionados." }: { rows: BiRankItem[]; emptyMessage?: string }) {
  const maxValue = useMemo(() => rows.reduce((highest, row) => Math.max(highest, row.faturamento, row.frete), 0), [rows]);
  if (!rows.length) return <div className="bi-v3__empty">{emptyMessage}</div>;
  return (
    <div className="bi-v3__ranking" role="list" aria-label="Comparativo de faturamento e frete">
      {rows.map((row, index) => (
        <div className="bi-v3__rank" role="listitem" key={`${row.name}-${index}`}>
          <div className="bi-v3__rank-heading">
            <span className="bi-v3__rank-name" title={row.name}>{row.name}</span>
            <span className="bi-v3__rank-number">{String(index + 1).padStart(2, "0")}</span>
          </div>
          <div className="bi-v3__rank-bars">
            <div className="bi-v3__rank-entry">
              <span>Faturamento</span>
              <div className="bi-v3__bar-track"><span className="bi-v3__bar-fill bi-v3__bar-fill--blue" style={{ width: `${maxValue ? Math.max(0, (row.faturamento / maxValue) * 100) : 0}%` }} /></div>
              <strong>{formatMoney(row.faturamento)}</strong>
            </div>
            <div className="bi-v3__rank-entry">
              <span>Frete</span>
              <div className="bi-v3__bar-track"><span className="bi-v3__bar-fill bi-v3__bar-fill--gold" style={{ width: `${maxValue ? Math.max(0, (row.frete / maxValue) * 100) : 0}%` }} /></div>
              <strong>{formatMoney(row.frete)}</strong>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BiColumnFilter({ label, values, onChange, options, inverted = false }: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: string[];
  inverted?: boolean;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => options.filter((option) => normalized(option).includes(normalized(query))).slice(0, 160), [options, query]);
  const toggle = (value: string) => onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Filtrar ${label}`} title={`Filtrar ${label}`} className={cn("bi-v3__column-filter", inverted && "bi-v3__column-filter--inverted", values.length > 0 && "bi-v3__column-filter--active")}>
          <ChevronsUpDown size={13} />
          {values.length > 0 && <span className="sr-only">{values.length} valores selecionados</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[min(310px,calc(100vw-36px))] bg-popover p-3 text-popover-foreground">
        <p className="mb-2 text-sm font-semibold">Filtrar {label}</p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="bi-v3__filter-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Encontrar valor..." aria-label={`Buscar valores de ${label}`} />
        </div>
        <div className="mb-2 flex justify-between gap-2 text-xs">
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onChange(options)}>Selecionar todos</button>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => onChange([])}>Limpar</button>
        </div>
        <div className="max-h-56 space-y-0.5 overflow-y-auto border-t border-border pt-2">
          {shown.map((value) => (
            <button key={value} type="button" className="bi-v3__filter-option" aria-pressed={values.includes(value)} onClick={() => toggle(value)}>
              <Check className={cn("h-3.5 w-3.5 shrink-0 text-primary", !values.includes(value) && "opacity-0")} />
              <span className="truncate" title={value}>{value || "—"}</span>
            </button>
          ))}
          {shown.length === 0 && <p className="py-3 text-xs text-muted-foreground">Nenhum valor encontrado.</p>}
          {options.length > 160 && <p className="px-2 py-2 text-xs text-muted-foreground">Use a pesquisa para localizar outros valores.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const compactColumnKeys = ["nfSerie", "cliente", "produto", "quantidade", "faturamento", "frete", "data"];
const columnWidths: Record<string, number> = {
  nfSerie: 118, cliente: 230, clienteCod: 122, produtoCod: 124, produto: 240,
  quantidade: 120, valorUnitProduto: 162, faturamento: 160, freteUnit: 162,
  frete: 155, percentual: 152, placa: 120, data: 124, municipio: 220,
};
const currencyKeys = new Set(["valorUnitProduto", "faturamento", "freteUnit", "frete"]);
const numericKeys = new Set(["quantidade", ...currencyKeys, "percentual"]);

function displayValue(row: BiFact, key: string): string {
  if (key === "quantidade") return formatNumber(row.quantidade);
  if (key === "percentual") return formatPercent(row.percentual);
  if (key === "data") return formatDate(row.data);
  if (currencyKeys.has(key)) return formatMoney(Number(row[key as keyof BiFact] || 0));
  return String(row[key as keyof BiFact] ?? "—") || "—";
}

const sortingOptions = [
  ["data-desc", "Data mais recente"], ["data-asc", "Data mais antiga"],
  ["cliente-asc", "Cliente A-Z"], ["cliente-desc", "Cliente Z-A"],
  ["produto-asc", "Produto A-Z"], ["produto-desc", "Produto Z-A"],
  ["quantidade-desc", "Maior quantidade"], ["quantidade-asc", "Menor quantidade"],
  ["valorUnitProduto-desc", "Maior valor unitário do produto"], ["valorUnitProduto-asc", "Menor valor unitário do produto"],
  ["faturamento-desc", "Maior faturamento"], ["faturamento-asc", "Menor faturamento"],
  ["freteUnit-desc", "Maior valor unitário do frete"], ["freteUnit-asc", "Menor valor unitário do frete"],
  ["frete-desc", "Maior frete"], ["frete-asc", "Menor frete"],
  ["percentual-desc", "Maior % frete/faturamento"], ["percentual-asc", "Menor % frete/faturamento"],
];

export function BiConsultation({ rows, totals, columns, columnOptions, columnFilters, setColumnFilters, sort, onSort, resetKey }: {
  rows: BiFact[];
  totals: BiTotals;
  columns: BiColumn[];
  columnOptions: Record<string, string[]>;
  columnFilters: Record<string, string[]>;
  setColumnFilters: (updater: (current: Record<string, string[]>) => Record<string, string[]>) => void;
  sort: string;
  onSort: (sort: string) => void;
  resetKey: string;
}) {
  const [fullColumns, setFullColumns] = useState(false);
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string[]>([]);
  const viewColumns = fullColumns ? columns : columns.filter((column) => compactColumnKeys.includes(column.key));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleRows = useMemo(() => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [rows, currentPage, pageSize]);
  const selectedFilters = columns.filter((column) => (columnFilters[column.key]?.length || 0) > 0);
  useEffect(() => { setPage(1); setExpanded([]); }, [resetKey, pageSize]);
  const toggleExpanded = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const tableWidth = viewColumns.reduce((sum, col) => sum + (columnWidths[col.key] || 125), 0) + 48;

  return (
    <section className="bi-v3__panel bi-v3__consultation" data-testid="bi-consulta">
      <header className="bi-v3__panel-heading bi-v3__panel-heading--wrap">
        <div>
          <p className="bi-v3__overline">Dados detalhados</p>
          <h2>Consulta Geral</h2>
          <p className="bi-v3__secondary">{rows.length.toLocaleString("pt-BR")} registros após os filtros · Valores e datas originais de cada documento</p>
        </div>
        <div className="bi-v3__table-controls">
          <label className="bi-v3__select-label">Ordenar por
            <select className="bi-v3__select" value={sort} onChange={(event) => onSort(event.target.value)}>
              {sortingOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setFullColumns((value) => !value)}>
            <TableProperties className="h-4 w-4" />{fullColumns ? "Colunas essenciais" : "Todas as colunas"}
          </Button>
          <Button variant="outline" size="sm" className="shrink-0" aria-expanded={showColumnFilters} onClick={() => setShowColumnFilters((current) => !current)}>
            <SlidersHorizontal className="h-4 w-4" />Filtros por coluna{selectedFilters.length ? ` (${selectedFilters.length})` : ""}
          </Button>
        </div>
      </header>
      {showColumnFilters && <section className="bi-v3__column-filter-panel" aria-label="Filtros individuais das colunas">
        <div className="bi-v3__column-filter-heading"><div><h3>Filtros por coluna</h3><p>Escolha os valores de cada campo. Esses filtros também são considerados nas exportações.</p></div><button type="button" onClick={() => setColumnFilters(() => ({}))}>Limpar todos</button></div>
        <div className="bi-v3__column-filter-grid">
          {columns.map((column) => <div key={column.key} className="bi-v3__column-filter-item"><span title={column.label}>{column.label}</span><BiColumnFilter label={column.label} values={columnFilters[column.key] || []} onChange={(values) => setColumnFilters((current) => ({ ...current, [column.key]: values }))} options={columnOptions[column.key] || []} /></div>)}
        </div>
      </section>}
      {selectedFilters.length > 0 && <div className="bi-v3__filter-tags">
        {selectedFilters.map((column) => <button type="button" className="bi-v3__filter-tag" key={column.key} onClick={() => setColumnFilters((current) => ({ ...current, [column.key]: [] }))} title={`Remover filtro de ${column.label}`}>{column.label}: {columnFilters[column.key].length} <span aria-hidden="true">×</span></button>)}
      </div>}
      <div className="bi-v3__totals-strip">
        <span><small>Faturamento filtrado</small><strong>{formatMoney(totals.faturamento)}</strong></span>
        <span><small>Frete filtrado</small><strong>{formatMoney(totals.frete)}</strong></span>
        <span><small>Quantidade</small><strong>{formatNumber(totals.quantidade)}</strong></span>
        <span><small>Frete / faturamento</small><strong>{formatPercent(totals.percentual)}</strong></span>
      </div>
      <p className="bi-v3__scroll-hint"><ChevronRight size={14} /> Deslize horizontalmente para consultar outras colunas. Clique em uma linha para ver todos os detalhes.</p>

      <div className="bi-v3__desktop-table">
        <div className="bi-v3__table-scroll" tabIndex={0} aria-label="Tabela do BI Gerencial com rolagem horizontal">
          <table className="bi-v3__table" style={{ minWidth: tableWidth }}>
            <colgroup><col style={{ width: 48 }} />{viewColumns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] || 125 }} />)}</colgroup>
            <thead><tr>
              <th className="bi-v3__expand-th" scope="col"><span className="sr-only">Expandir detalhes</span></th>
              {viewColumns.map((column) => <th key={column.key} scope="col"><span className="bi-v3__th-content"><span>{column.label}</span><BiColumnFilter inverted label={column.label} values={columnFilters[column.key] || []} onChange={(values) => setColumnFilters((current) => ({ ...current, [column.key]: values }))} options={columnOptions[column.key] || []} /></span></th>)}
            </tr></thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const rowId = `${row.id}-${(currentPage - 1) * pageSize + index}`;
                const isExpanded = expanded.includes(rowId);
                return [
                  <tr key={rowId} className="bi-v3__data-row" onClick={() => toggleExpanded(rowId)} aria-expanded={isExpanded}>
                    <td><button type="button" onClick={(event) => { event.stopPropagation(); toggleExpanded(rowId); }} className="bi-v3__expand" aria-label={`${isExpanded ? "Ocultar" : "Mostrar"} detalhes de ${row.nfSerie || "registro"}`}><ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} /></button></td>
                    {viewColumns.map((column) => <td key={column.key} className={cn(numericKeys.has(column.key) && "bi-v3__numeric")} title={displayValue(row, column.key)}><span className="bi-v3__cell-text">{displayValue(row, column.key)}</span></td>)}
                  </tr>,
                  isExpanded ? <tr key={`${rowId}-details`} className="bi-v3__expanded-row"><td colSpan={viewColumns.length + 1}><div className="bi-v3__details-grid">{columns.map((column) => <div key={column.key}><small>{column.label}</small><strong>{displayValue(row, column.key)}</strong></div>)}</div></td></tr> : null,
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bi-v3__mobile-rows">
        {visibleRows.map((row, index) => {
          const rowId = `${row.id}-mobile-${index}`;
          const isExpanded = expanded.includes(rowId);
          return <article className="bi-v3__mobile-row" key={rowId}>
            <div className="bi-v3__mobile-row-heading"><strong title={row.cliente}>{row.cliente || "Cliente não informado"}</strong><span>{formatDate(row.data)}</span></div>
            <p className="bi-v3__mobile-item" title={row.produto}>{row.produto || "Produto não informado"} · NF {row.nfSerie || "—"}</p>
            <div className="bi-v3__mobile-metrics"><span>Qtd. <strong>{formatNumber(row.quantidade)}</strong></span><span>Faturamento <strong>{formatMoney(row.faturamento)}</strong></span><span>Frete <strong>{formatMoney(row.frete)}</strong></span></div>
            <button type="button" className="bi-v3__detail-button" onClick={() => toggleExpanded(rowId)} aria-expanded={isExpanded}>{isExpanded ? "Ocultar detalhes" : "Ver todos os campos"}<ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} /></button>
            {isExpanded && <div className="bi-v3__details-grid">{columns.map((column) => <div key={column.key}><small>{column.label}</small><strong>{displayValue(row, column.key)}</strong></div>)}</div>}
          </article>;
        })}
      </div>
      {rows.length === 0 && <div className="bi-v3__empty">Nenhum registro encontrado. Ajuste o período ou os filtros.</div>}
      <footer className="bi-v3__pagination">
        <span>{rows.length === 0 ? "0 registros" : `${((currentPage - 1) * pageSize + 1).toLocaleString("pt-BR")}–${Math.min(currentPage * pageSize, rows.length).toLocaleString("pt-BR")} de ${rows.length.toLocaleString("pt-BR")}`}</span>
        <div className="bi-v3__pagination-actions">
          <label className="bi-v3__pagination-size">Por página <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Quantidade de linhas por página"><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
          <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="bi-v3__page-indicator">{currentPage} / {pages}</span>
          <Button variant="outline" size="icon-sm" aria-label="Próxima página" disabled={currentPage >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </footer>
    </section>
  );
}
