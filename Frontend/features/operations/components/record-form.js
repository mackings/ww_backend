"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/services/api-client";

const initialValues = (fields) => Object.fromEntries(
  fields.map((field) => [field.name, field.type === "multi-lookup" ? [] : field.defaultValue ?? ""])
);

const numberFromFormatted = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrencyInput = (value) => {
  const normalized = String(value || "").replace(/[^\d.]/g, "");
  if (!normalized) return "";
  const [whole, decimal] = normalized.split(".");
  const formattedWhole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(whole || 0));
  return decimal !== undefined ? `${formattedWhole}.${decimal.slice(0, 2)}` : formattedWhole;
};

const normalizeSubmitValues = (fields, values) => fields.reduce((payload, field) => {
  payload[field.name] = field.currency ? numberFromFormatted(values[field.name]) : values[field.name];
  return payload;
}, {});

const serializableDraftValues = (fields, values) => fields.reduce((draft, field) => {
  if (field.type === "file") return draft;
  draft[field.name] = values[field.name];
  return draft;
}, {});

const hasDraftContent = (fields, values) => fields.some((field) => {
  if (field.type === "file") return false;
  const value = values[field.name];
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && String(value).trim() !== "";
});

const buildCacheKey = (definition, cacheScope) => {
  if (!definition.cacheKey) return "";
  return [
    "ww_record_form",
    definition.cacheKey,
    cacheScope?.userId || "user",
    cacheScope?.companyName || "company"
  ].join(":");
};

export function RecordForm({ definition, onSubmit, onClose, submitting, token, cacheScope }) {
  const defaults = useMemo(() => initialValues(definition.fields), [definition.fields]);
  const cacheKey = useMemo(() => buildCacheKey(definition, cacheScope), [definition, cacheScope]);
  const readCachedDraft = () => {
    if (!cacheKey) return { restored: false, values: defaults };
    try {
      const stored = localStorage.getItem(cacheKey);
      return stored ? { restored: true, values: { ...defaults, ...JSON.parse(stored) } } : { restored: false, values: defaults };
    } catch {
      localStorage.removeItem(cacheKey);
      return { restored: false, values: defaults };
    }
  };
  const [initialDraft] = useState(readCachedDraft);
  const [values, setValues] = useState(initialDraft.values);
  const [lookups, setLookups] = useState({});
  const [draftRestored, setDraftRestored] = useState(initialDraft.restored);

  useEffect(() => {
    if (!cacheKey) return;
    const draft = serializableDraftValues(definition.fields, values);
    if (!hasDraftContent(definition.fields, draft)) {
      localStorage.removeItem(cacheKey);
      return;
    }
    localStorage.setItem(cacheKey, JSON.stringify(draft));
  }, [cacheKey, definition.fields, values]);

  useEffect(() => {
    definition.fields.filter((field) => ["lookup", "multi-lookup"].includes(field.type)).forEach((field) => {
      apiRequest(field.lookup.path, { token, query: field.lookup.query }).then((payload) => {
        const rows = field.lookup.rows(payload);
        setLookups((current) => ({ ...current, [field.name]: rows }));
      }).catch(() => {
        setLookups((current) => ({ ...current, [field.name]: [] }));
      });
    });
  }, [definition.fields, token]);

  const clearDraft = () => {
    if (cacheKey) localStorage.removeItem(cacheKey);
    setValues(defaults);
    setDraftRestored(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    const missingSelection = definition.fields.find(
      (field) => field.required && field.type === "multi-lookup" && !values[field.name]?.length
    );
    if (missingSelection) {
      window.alert(`Select at least one ${missingSelection.label.toLowerCase()}.`);
      return;
    }
    const validationError = definition.validate?.(values);
    if (validationError) {
      window.alert(validationError);
      return;
    }
    const normalizedValues = normalizeSubmitValues(definition.fields, values);
    const payload = definition.transform ? definition.transform(normalizedValues) : normalizedValues;
    const success = await onSubmit(payload);
    if (success) clearDraft();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading">
          <div><span className="eyebrow">New record</span><h2>{definition.label}</h2></div>
          <button className="icon-button" onClick={onClose} type="button">Close</button>
        </div>
        {definition.cacheKey && (
          <div className={draftRestored ? "alert success form-draft-alert" : "alert muted form-draft-alert"}>
            {draftRestored ? "Restored your saved draft. File uploads must be reselected." : "This form is saved automatically until the record is created."}
            {draftRestored && <button type="button" onClick={clearDraft}>Clear draft</button>}
          </div>
        )}
        <form className="form-grid record-form" onSubmit={submit}>
          {definition.fields.map((field) => (
            <label key={field.name} className={field.type === "textarea" || field.full ? "full" : undefined}>
              {field.label}
              {field.type === "select" ? (
                <select required={field.required} value={values[field.name]} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}>
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {field.options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
                </select>
              ) : field.type === "lookup" ? (
                <select required={field.required} value={values[field.name]} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}>
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {(lookups[field.name] || []).filter((row) => !field.lookup.filter || field.lookup.filter(row)).map((row) => (
                    <option key={field.lookup.value(row)} value={field.lookup.serialize ? JSON.stringify(row) : field.lookup.value(row)}>
                      {field.lookup.label(row)}
                    </option>
                  ))}
                </select>
              ) : field.type === "multi-lookup" ? (
                <div className="lookup-checklist">
                  {(lookups[field.name] || []).map((row) => {
                    const serialized = JSON.stringify(row);
                    const selected = Array.isArray(values[field.name]) && values[field.name].includes(serialized);
                    return (
                      <label key={field.lookup.value(row)} className={selected ? "lookup-option selected" : "lookup-option"}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => setValues({
                            ...values,
                            [field.name]: selected
                              ? values[field.name].filter((value) => value !== serialized)
                              : [...(Array.isArray(values[field.name]) ? values[field.name] : []), serialized]
                          })}
                        />
                        <span>{field.lookup.label(row)}</span>
                      </label>
                    );
                  })}
                </div>
              ) : field.type === "textarea" ? (
                <textarea required={field.required} rows="4" value={values[field.name]} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })} />
              ) : field.type === "file" ? (
                <input type="file" accept={field.name === "invoicePdf" ? "application/pdf" : "image/*"} onChange={(e) => setValues({ ...values, [field.name]: e.target.files?.[0] || "" })} />
              ) : field.type === "template-choice" ? (
                <div className="template-choice-grid">
                  {field.options.map((option) => (
                    <button type="button" key={option.value} className={values[field.name] === option.value ? "template-choice-card selected" : "template-choice-card"} onClick={() => setValues({ ...values, [field.name]: option.value })}>
                      <span className={`template-preview template-${option.value}`}><i /><b /><em /></span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={field.currency ? "text" : field.type}
                  inputMode={field.currency ? "decimal" : undefined}
                  required={field.required}
                  min={!field.currency && field.type === "number" ? "0" : undefined}
                  step={!field.currency && field.type === "number" ? "any" : undefined}
                  placeholder={field.currency ? "e.g. 2,000" : undefined}
                  value={values[field.name]}
                  onChange={(e) => setValues({ ...values, [field.name]: field.currency ? formatCurrencyInput(e.target.value) : e.target.value })}
                />
              )}
            </label>
          ))}
          <div className="form-actions full">
            <button className="text-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={submitting}>{submitting ? "Saving..." : definition.submitLabel || definition.label}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
