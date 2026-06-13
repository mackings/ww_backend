# Frontend Architecture

The frontend uses Next.js App Router with feature ownership and a small shared core.

## Folders

- `app/`: routing, metadata and the backend proxy only. Route files stay thin.
- `features/auth/`: session state, authentication screens and auth components.
- `features/dashboard/`: user and platform-admin dashboard composition.
- `features/navigation/`: authenticated application shell and role-aware navigation.
- `features/operations/`: inventory tables, forms, workflow actions and domain configuration.
- `services/`: network and external-service clients.
- `shared/components/`: feature-independent presentation components.

## Data Flow

1. The browser calls `/api/backend/*` on the Next application.
2. The Next route handler proxies the request to `BACKEND_API_URL`.
3. `services/api-client.js` supplies bearer authentication and consistent errors.
4. Feature screens consume the service through the auth context.

Domain configuration defines lists, filters, forms and workflow actions while
feature services own backend communication. New backend capabilities should be
integrated into the relevant domain workflow rather than exposed as raw requests.
