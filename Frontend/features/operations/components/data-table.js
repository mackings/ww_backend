"use client";

import { getNestedValue } from "@/features/operations/config/operation-modules";

const displayValue = (value) => typeof value === "string" ? value.replaceAll("_", " ") : String(value ?? "-");

/* eslint-disable @next/next/no-img-element */
export function DataTable({ rows, columns, actions, onAction, onView, busy }) {
  if (!rows.length) {
    return (
      <div className="empty-state">
        <strong>No records found</strong>
        <p>Try changing the filters or create the first record.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap operational-table">
      <table>
        <thead>
          <tr>
            {columns.map(([, label]) => <th key={label}>{label}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row._id || row.id || rowIndex}>
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
                  {actions?.length > 0 && (
                    <>
                    {actions.filter((action) => !action.show || action.show(row)).map((action) => (
                      <button
                        className={action.danger ? "row-button danger" : "row-button"}
                        disabled={busy}
                        key={action.label}
                        onClick={() => onAction(action, row, rowIndex)}
                      >
                        {action.label}
                      </button>
                    ))}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
