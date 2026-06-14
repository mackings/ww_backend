const items = (count) => Array.from({ length: count }, (_, index) => index);

export function StatGridSkeleton({ count = 4 }) {
  return (
    <>
      {items(count).map((index) => (
        <article className="stat-card skeleton-card" aria-hidden="true" key={index}>
          <span className="skeleton skeleton-label" />
          <span className="skeleton skeleton-value" />
          <span className="skeleton skeleton-note" />
        </article>
      ))}
    </>
  );
}

export function RecentListSkeleton({ count = 4 }) {
  return (
    <div className="recent-list skeleton-list" aria-hidden="true">
      {items(count).map((index) => (
        <div className="skeleton-recent-row" key={index}>
          <span className="skeleton skeleton-avatar" />
          <span className="skeleton-row-copy">
            <span className="skeleton skeleton-line medium" />
            <span className="skeleton skeleton-line short" />
          </span>
          <span className="skeleton skeleton-line amount" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ columns = 7, rows = 6 }) {
  return (
    <div className="table-wrap operational-table skeleton-table" aria-label="Loading records" role="status">
      <table>
        <thead>
          <tr>{items(columns).map((index) => <th key={index}><span className="skeleton skeleton-table-heading" /></th>)}</tr>
        </thead>
        <tbody>
          {items(rows).map((rowIndex) => (
            <tr key={rowIndex}>
              {items(columns).map((columnIndex) => (
                <td data-label="Loading" key={columnIndex}>
                  <span className={`skeleton skeleton-line ${columnIndex === 1 ? "long" : "medium"}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sr-only">Loading records...</span>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="record-card-grid skeleton-record-grid" aria-label="Loading records" role="status">
      {items(count).map((index) => (
        <article className="record-card skeleton-record-card" aria-hidden="true" key={index}>
          <div className="record-card-head">
            <span className="skeleton skeleton-avatar" />
            <span className="skeleton-row-copy">
              <span className="skeleton skeleton-line short" />
              <span className="skeleton skeleton-line medium" />
            </span>
          </div>
          <span className="skeleton skeleton-value compact" />
          <div className="skeleton-meta-grid">
            {items(3).map((metaIndex) => <span className="skeleton skeleton-block" key={metaIndex} />)}
          </div>
          <span className="skeleton skeleton-button-line" />
        </article>
      ))}
      <span className="sr-only">Loading records...</span>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="analytics-layout skeleton-analytics" aria-label="Loading analytics" role="status">
      <div className="analytics-cards">
        <StatGridSkeleton />
      </div>
      <div className="analytics-grid">
        <article className="analytics-panel wide skeleton-panel" />
        <article className="analytics-panel skeleton-panel" />
        <article className="analytics-panel skeleton-panel" />
      </div>
      <span className="sr-only">Loading analytics...</span>
    </div>
  );
}

export function WorkspaceSkeleton({ titleWidth = "42%" }) {
  return (
    <div className="workspace-skeleton" aria-label="Loading workspace" role="status">
      <section className="workspace-heading skeleton-workspace-heading">
        <div>
          <span className="skeleton skeleton-label" />
          <span className="skeleton skeleton-heading" style={{ width: titleWidth }} />
          <span className="skeleton skeleton-copy" />
        </div>
        <span className="skeleton skeleton-primary-button" />
      </section>
      <div className="skeleton-tabs">
        {items(3).map((index) => <span className="skeleton skeleton-tab" key={index} />)}
      </div>
      <section className="stat-grid">
        <StatGridSkeleton />
      </section>
      <section className="panel skeleton-workspace-panel">
        <span className="skeleton skeleton-heading small" />
        <div className="skeleton-card-grid">
          {items(3).map((index) => <span className="skeleton skeleton-large-card" key={index} />)}
        </div>
      </section>
      <span className="sr-only">Loading workspace...</span>
    </div>
  );
}
