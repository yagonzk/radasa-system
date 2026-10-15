import { useEffect } from "react";

/**
 * Adapta tabelas legadas sem duplicar registros ou handlers React.
 * Desktop mantém a tabela original; somente quando a largura disponível
 * não suporta as colunas, cada <tr> passa a ser exibido como um cartão.
 * Não modifica dados, ordenação, filtros ou ações.
 */
const EXCLUDED_TABLES = ".romaneios-list-table, .bi-v3__table, [data-radasa-native-table]";

function getColumnHeadings(table: HTMLTableElement): string[] {
  const header = table.tHead?.rows[0];
  if (!header) return [];
  const headings: string[] = [];
  for (const cell of Array.from(header.cells)) {
    const label = cell.textContent?.replace(/\s+/g, " ").trim() || "";
    const span = Math.max(cell.colSpan || 1, 1);
    for (let i = 0; i < span; i++) headings.push(label);
    // Preserva seleção em massa, filtros e botões de ordenação quando a tabela virar cartões.
    const control = cell.querySelector("button, input, select, [role='button']");
    cell.classList.toggle("radasa-card-head-control", Boolean(control) || cell.classList.contains("cursor-pointer"));
  }
  return headings;
}

function applyLabels(table: HTMLTableElement, headings: string[]) {
  for (const section of Array.from(table.tBodies)) {
    for (const row of Array.from(section.rows)) {
      let columnIndex = 0;
      for (const cell of Array.from(row.cells)) {
        const span = Math.max(cell.colSpan || 1, 1);
        const label = headings[columnIndex] || (cell.querySelector('input[type="checkbox"]') ? "Selecionar" : "Ações");
        if (cell.dataset.radasaLabel !== label) cell.dataset.radasaLabel = label;
        cell.classList.toggle("radasa-card-span", span > 1);
        columnIndex += span;
      }
    }
  }
  if (table.tFoot) {
    for (const row of Array.from(table.tFoot.rows)) {
      let columnIndex = 0;
      for (const cell of Array.from(row.cells)) {
        const span = Math.max(cell.colSpan || 1, 1);
        const label = headings[columnIndex] || "Total";
        if (cell.dataset.radasaLabel !== label) cell.dataset.radasaLabel = label;
        cell.classList.toggle("radasa-card-span", span > 1);
        columnIndex += span;
      }
    }
  }
}

export function updateAdaptiveTables(root: ParentNode = document) {
  const tables = root.querySelectorAll<HTMLTableElement>("table");
  for (const table of Array.from(tables)) {
    if (table.matches(EXCLUDED_TABLES) || table.closest(".bi-v3__desktop-table") || table.closest(".romaneios-list-container")) continue;
    const headings = getColumnHeadings(table);
    if (headings.length < 3) continue;
    const container = table.parentElement;
    if (!container) continue;
    const availableWidth = Math.min(container.clientWidth, document.documentElement.clientWidth - 24);
    if (!availableWidth || !table.isConnected) continue;

    // As larguras mínimas originais são usadas para determinar o ponto de quebra.
    // Após a transformação, não medimos a tabela em cartões para evitar alternância infinita.
    const isCard = table.classList.contains("radasa-adaptive-card");
    const minimum = isCard
      ? Number(table.dataset.radasaMinWidth || 0)
      : Number.parseFloat(window.getComputedStyle(table).minWidth) || 0;
    if (!isCard) table.dataset.radasaMinWidth = String(Math.ceil(minimum));
    const explicitReadableWidth = Number(table.dataset.radasaMinReadableWidth || 0);
    const minimumReadableWidth = explicitReadableWidth > 0
      ? explicitReadableWidth
      : Math.max(minimum, headings.length * (headings.length >= 7 ? 116 : 125));
    const intrinsicWidth = explicitReadableWidth > 0
      ? 0
      : isCard
        ? Number(table.dataset.radasaNaturalWidth || 0)
        : table.scrollWidth > availableWidth + 2 ? table.scrollWidth : 0;
    if (!isCard) table.dataset.radasaNaturalWidth = String(Math.ceil(intrinsicWidth));
    const requiredWidth = Math.max(minimumReadableWidth, intrinsicWidth);
    const enableCards = availableWidth + 2 < requiredWidth;

    table.classList.toggle("radasa-adaptive-card", enableCards);
    container.classList.toggle("radasa-adaptive-container", enableCards);
    if (enableCards) applyLabels(table, headings);
  }
}

/** Montado uma única vez para abranger Transportes, Agro, Administração e diálogos. */
export default function AdaptiveTables() {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateAdaptiveTables(document);
      });
    };
    const observer = new MutationObserver(schedule);
    // Observa inclusive conteúdo de abas lazy e diálogos abertos via portal.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "data-state", "open"],
    });
    const sizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    sizeObserver?.observe(root);
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => {
      observer.disconnect();
      sizeObserver?.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
