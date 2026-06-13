"use client";

import { use, useCallback, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/features/navigation/components/app-shell";
import { useAuth } from "@/features/auth/context/auth-context";
import { operationModules } from "@/features/operations/config/operation-modules";
import { DataTable } from "@/features/operations/components/data-table";
import { MaterialForm } from "@/features/operations/components/material-form";
import { RecordForm } from "@/features/operations/components/record-form";
import { RecordDetail } from "@/features/operations/components/record-detail";
import { SalesAnalytics } from "@/features/operations/components/sales-analytics";
import { RecordCards } from "@/features/operations/components/record-cards";
import { loadResource, submitOperation } from "@/features/operations/services/operations-service";
import { BomQuotationWorkspace } from "@/features/operations/screens/bom-quotation-workspace";

export function OperationsScreen({ params }) {
  const resolvedParams = use(params);
  const moduleConfig = operationModules[resolvedParams.module];
  const { token, user, isAdmin, ready, refreshUser } = useAuth();
  const [activeId, setActiveId] = useState(moduleConfig?.resources?.[0]?.id);

  if (!ready || !user) return <div className="page-loader"><span className="spinner" />Loading workspace...</div>;
  if (!moduleConfig || (moduleConfig.admin && !isAdmin)) notFound();
  if (["boms", "quotations"].includes(resolvedParams.module)) {
    return <BomQuotationWorkspace token={token} user={user} mode={resolvedParams.module} />;
  }

  const activeResource = moduleConfig.resources.find((resource) => resource.id === activeId) || moduleConfig.resources[0];

  return (
    <ResourceWorkspace
      key={activeResource.id}
      activeResource={activeResource}
      moduleConfig={moduleConfig}
      onSelectResource={setActiveId}
      refreshUser={refreshUser}
      isAdmin={isAdmin}
      token={token}
      user={user}
    />
  );
}

function ResourceWorkspace({
  activeResource,
  moduleConfig,
  onSelectResource,
  refreshUser,
  isAdmin,
  token,
  user
}) {
  const [rows, setRows] = useState([]);
  const [payload, setPayload] = useState(null);
  const [query, setQuery] = useState(activeResource.query || {});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState(null);
  const [actionForm, setActionForm] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchRows = useCallback(async () => {
    if (!token || !activeResource) return;
    setLoading(true);
    setError("");
    try {
      const payload = await loadResource(activeResource, token, query);
      setPayload(payload);
      const nextRows = activeResource.rows(payload);
      setRows(Array.isArray(nextRows) ? nextRows : []);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeResource, query, token]);

  useEffect(() => {
    queueMicrotask(fetchRows);
  }, [fetchRows]);

  const mutate = async ({ path, method, body, multipart, refreshSession }) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await submitOperation({ path, method, body, multipart, token });
      setNotice(result?.message || "Operation completed successfully");
      if (refreshSession) await refreshUser();
      await fetchRows();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (body) => {
    const success = await mutate({
      path: activeResource.create.path,
      method: activeResource.create.method || "POST",
      body,
      multipart: activeResource.create.multipart
    });
    if (success) setFormOpen(false);
    return success;
  };

  const handleMaterialSubmit = async (body, { mode, materialId }) => {
    const success = await mutate({
      path: mode === "edit" ? `/api/product/materials/${materialId}` : activeResource.create.path,
      method: mode === "edit" ? "PUT" : "POST",
      body,
      multipart: true
    });
    if (success) setFormOpen(false);
    return success;
  };

  const handleAction = async (action, row, rowIndex) => {
    if (action.danger && !window.confirm(`${action.label} this record?`)) return;
    if (action.materialEdit) {
      setMaterialToEdit(row);
      return;
    }
    if (action.form) {
      setActionForm({ action, row, rowIndex });
      return;
    }
    let promptedValue;
    if (action.prompt) {
      promptedValue = window.prompt(action.prompt.label);
      if (promptedValue === null || promptedValue === "") return;
    }
    const path = typeof action.path === "function" ? action.path(row) : action.path;
    if (action.preview) {
      setBusy(true);
      setError("");
      try {
        const result = await submitOperation({ path, method: action.method, token });
        setSelectedRecord(result?.data || result);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    await mutate({
      path,
      method: action.method,
      body: action.body ? action.body(row, rowIndex, promptedValue) : undefined,
      multipart: action.multipart,
      refreshSession: action.refreshUser
    });
  };

  const submitActionForm = async (values) => {
    const { action, row, rowIndex } = actionForm;
    const path = typeof action.path === "function" ? action.path(row) : action.path;
    const body = action.form.transform ? action.form.transform(values, row) : values;
    const success = await mutate({ path, method: action.method, body, multipart: action.multipart });
    if (success) setActionForm(null);
    return success;
  };

  const cacheScope = {
    userId: user?._id || user?.id || user?.email,
    companyName: user?.activeCompany?.name || user?.companies?.[user?.activeCompanyIndex || 0]?.name
  };

  return (
    <AppShell>
      <section className="workspace-heading operations-heading">
        <div>
          <span className="eyebrow">{moduleConfig.admin ? "Platform controls" : "Operations workspace"}</span>
          <h1>{moduleConfig.title}</h1>
          <p>{moduleConfig.description}</p>
        </div>
        {activeResource.create && (
          <button className="primary-button inline" onClick={() => setFormOpen(true)}>{activeResource.create.label}</button>
        )}
      </section>

      <div className="resource-tabs">
        {moduleConfig.resources.map((resource) => (
          <button className={activeResource.id === resource.id ? "resource-tab active" : "resource-tab"} key={resource.id} onClick={() => onSelectResource(resource.id)}>
            {resource.label}
          </button>
        ))}
      </div>

      {activeResource.stats && (
        <section className="stat-grid resource-stats">
          {activeResource.stats.map(([label, calculate]) => (
            <article className="stat-card" key={label}><span>{label}</span><strong>{calculate(rows)}</strong><small>Current view</small></article>
          ))}
        </section>
      )}

      <section className="panel resource-panel">
        <div className="resource-toolbar">
          <div>
            <span className="eyebrow">Live records</span>
            <h2>{activeResource.label}</h2>
          </div>
          <div className="toolbar-actions">
            {activeResource.query && Object.entries(activeResource.query).map(([key]) => (
              <label key={key}>
                {key.replace(/([A-Z])/g, " $1")}
                {["status", "paymentStatus", "priced", "isActive", "unreadOnly"].includes(key) ? (
                  <select value={query[key] ?? ""} onChange={(event) => setQuery({ ...query, [key]: event.target.value })}>
                    <option value="">All</option>
                    {key === "status" && ["pending", "in_progress", "completed", "approved", "sent", "rejected", "paid", "cancelled"].map((value) => <option key={value}>{value}</option>)}
                    {key === "paymentStatus" && ["unpaid", "partial", "paid"].map((value) => <option key={value}>{value}</option>)}
                    {["priced", "isActive", "unreadOnly"].includes(key) && <><option value="true">Yes</option><option value="false">No</option></>}
                  </select>
                ) : (
                  <input type={key === "page" || key === "limit" ? "number" : "search"} value={query[key] ?? ""} onChange={(event) => setQuery({ ...query, [key]: event.target.value })} />
                )}
              </label>
            ))}
            {activeResource.toolbarActions?.map((action) => (
              <button className="secondary-button" key={action.label} onClick={() => handleAction(action, null, 0)}>{action.label}</button>
            ))}
            <button className="secondary-button" onClick={fetchRows}>Refresh</button>
          </div>
        </div>

        {notice && <div className="alert success">{notice}</div>}
        {error && <div className="alert error">{error}</div>}
        {loading ? (
          <div className="loading-block"><span className="spinner" />Loading {activeResource.label.toLowerCase()}...</div>
        ) : activeResource.view === "sales-analytics" ? (
          <SalesAnalytics payload={payload} />
        ) : activeResource.view === "cards" ? (
          <RecordCards type={activeResource.cardType} rows={rows} actions={activeResource.rowActions} onAction={handleAction} onView={setSelectedRecord} busy={busy} />
        ) : (
          <DataTable rows={rows} columns={activeResource.columns} actions={activeResource.rowActions} onAction={handleAction} onView={setSelectedRecord} busy={busy} />
        )}
      </section>

      {formOpen && activeResource.id === "materials" && (
        <MaterialForm
          materials={rows}
          companyName={cacheScope.companyName}
          isAdmin={isAdmin}
          onSubmit={handleMaterialSubmit}
          onClose={() => setFormOpen(false)}
          submitting={busy}
        />
      )}
      {formOpen && activeResource.id !== "materials" && (
        <RecordForm definition={activeResource.create} onSubmit={handleCreate} onClose={() => setFormOpen(false)} submitting={busy} token={token} cacheScope={cacheScope} />
      )}
      {materialToEdit && (
        <MaterialForm
          materials={[materialToEdit]}
          companyName={materialToEdit.companyName}
          initialMaterial={materialToEdit}
          editOnly
          isAdmin
          onSubmit={async (body, { materialId }) => {
            const success = await mutate({
              path: `/api/platform/materials/${materialId}`,
              method: "PUT",
              body,
              multipart: true
            });
            if (success) setMaterialToEdit(null);
            return success;
          }}
          onClose={() => setMaterialToEdit(null)}
          submitting={busy}
        />
      )}
      {actionForm && <RecordForm definition={actionForm.action.form} onSubmit={submitActionForm} onClose={() => setActionForm(null)} submitting={busy} token={token} cacheScope={cacheScope} />}
      {selectedRecord && <RecordDetail record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
    </AppShell>
  );
}
