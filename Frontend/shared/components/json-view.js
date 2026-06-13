"use client";

const isPrimitive = (value) => value === null || ["string", "number", "boolean"].includes(typeof value);

export function JsonView({ value }) {
  if (Array.isArray(value) && value.length && value.every((item) => item && typeof item === "object")) {
    const columns = Array.from(new Set(value.slice(0, 20).flatMap((item) => Object.keys(item)))).slice(0, 8);
    return (
      <div className="table-wrap">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            {value.slice(0, 100).map((row, index) => (
              <tr key={row._id || row.id || index}>
                {columns.map((column) => (
                  <td key={column}>
                    {isPrimitive(row[column]) ? String(row[column] ?? "-") : JSON.stringify(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <pre className="json-output">{JSON.stringify(value, null, 2)}</pre>;
}
