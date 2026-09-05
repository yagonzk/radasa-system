export type MaintenanceSelectableRow = { id: string; status: string };

export function selectableMaintenanceIds(rows: MaintenanceSelectableRow[]) {
  return rows
    .filter((row) => row.status !== "CONCLUIDA" && row.status !== "CANCELADA")
    .map((row) => row.id);
}

export function toggleAllMaintenanceSelection(current: Set<string>, rows: MaintenanceSelectableRow[]) {
  const selectableIds = selectableMaintenanceIds(rows);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => current.has(id));
  return allSelected ? new Set<string>() : new Set(selectableIds);
}
