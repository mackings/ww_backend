const iconPaths = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  auth: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  materials: (
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </>
  ),
  products: (
    <>
      <path d="m21 8-9 5-9-5 9-5 9 5Z" />
      <path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z" />
      <path d="M12 13v8" />
    </>
  ),
  quotations: (
    <>
      <path d="M6 2h9l5 5v15H6V2Z" />
      <path d="M14 2v6h6M9 13h8M9 17h6" />
    </>
  ),
  boms: (
    <>
      <path d="M9 3h6l1 3h4v15H4V6h4l1-3Z" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  orders: (
    <>
      <path d="M6 2h12v20H6z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  sales: (
    <>
      <path d="M3 20h18M5 17l4-5 4 3 6-9" />
      <path d="M15 6h4v4" />
    </>
  ),
  invoices: (
    <>
      <path d="M5 2h14v20l-3-2-4 2-4-2-3 2V2Z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  operations: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  permissions: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 3h3v3M5 15h6" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </>
  ),
  platform: (
    <>
      <path d="M4 21V10l8-7 8 7v11" />
      <path d="M9 21v-6h6v6M8 10h8" />
    </>
  )
};

export function WorkspaceIcon({ name, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {iconPaths[name] || iconPaths.overview}
    </svg>
  );
}
