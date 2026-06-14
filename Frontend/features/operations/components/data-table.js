"use client";

import { useEffect, useRef } from "react";
import { getNestedValue } from "@/features/operations/config/operation-modules";

const displayValue = (value) => typeof value === "string" ? value.replaceAll("_", " ") : String(value ?? "-");
const recordId = (row) => String(row?._id || row?.id || "");

/* eslint-disable @next/next/no-img-element */
export function DataTable({
  rows,
  columns,
  actions,
  bulkActions,
  selectedIds = [],
  onSelectionChange,
  onBulkAction,
  onAction,
  onView,
  busy
}) {
  const selectAllRef = useRef(null);
  const visibleIds = rows.map(recordId).filter(Boolean);
  const selectedIdSet = new Set(selectedIds);
  const selectedRows = rows.filter((row) => selectedIdSet.has(recordId(row)));
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const someSelected = selectedRows.length > 0 && !allSelected;
  const selectable = Boolean(bulkActions?.length && onSelectionChange);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  if (!rows.length) {
    return (
      <div className="empty-state">
        <strong>No records found</strong>
        <p>Try changing the filters or create the first record.</p>
      </div>
    );
  }

  return (
    <>
      {selectable && selectedRows.length > 0 && (
        <div className="bulk-action-bar">
          <div>
            <strong>{selectedRows.length} selected</strong>
            <span>Apply one action to the selected materials.</span>
          </div>
          <div className="bulk-action-buttons">
            <button className="bulk-clear-button" disabled={busy} onClick={() => onSelectionChange([])}>Clear</button>
            {bulkActions.map((action) => (
              <button
                className={action.danger ? "bulk-action-button danger" : "bulk-action-button"}
                disabled={busy}
                key={action.label}
                onClick={() => onBulkAction(action, selectedRows)}
              >
                {busy ? "Working..." : action.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="table-wrap operational-table">
        <table>
          <thead>
            <tr>
              {selectable && (
                <th className="selection-column">
                  <input
                    aria-label="Select all materials on this page"
                    checked={allSelected}
                    disabled={busy}
                    onChange={(event) => onSelectionChange(event.target.checked ? visibleIds : [])}
                    ref={selectAllRef}
                    type="checkbox"
                  />
                </th>
              )}
              {columns.map(([, label]) => <th key={label}>{label}</th>)}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const id = recordId(row);
              const selected = selectedIdSet.has(id);
              return (
                <tr className={selected ? "selected-row" : undefined} key={id || rowIndex}>
                  {selectable && (
                    <td className="selection-cell" data-label="Select">
                      <input
                        aria-label={`Select ${row.name || "material"}`}
                        checked={selected}
                        disabled={busy || !id}
                        onChange={(event) => onSelectionChange(
                          event.target.checked
                            ? [...selectedIdSet, id]
                            : selectedIds.filter((selectedId) => selectedId !== id)
                        )}
                        type="checkbox"
                      />
                    </td>
                  )}
                  {columns.map(([path, label, formatter, kind]) => {
                    const value = getNestedValue(row, path);
                    return (
                      <td className={kind === "image" ? "image-cell" : undefined} data-label={label} key={label}>
                        {kind === "image" && value
                          ? <img className="table-image" src={value} alt="" />
                          : kind === "image"
                            ? <span className="table-image-placeholder">—</span>
                          : kind === "status"
                            ? <span className={`status-badge status-${String(value).replaceAll("_", "-")}`}>{formatter ? formatter(value, row) : value}</span>
                            : formatter ? formatter(value, row) : displayValue(value)}
                      </td>
                    );
                  })}
                  <td className="actions-cell" data-label="Actions">
                    <div className="row-actions">
                      <button className="row-button" onClick={() => onView(row)}>View</button>
                      {actions?.length > 0 && actions.filter((action) => !action.show || action.show(row)).map((action) => (
                        <button
                          className={action.danger ? "row-button danger" : "row-button"}
                          disabled={busy}
                          key={action.label}
                          onClick={() => onAction(action, row, rowIndex)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
