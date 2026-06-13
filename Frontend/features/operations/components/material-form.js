"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const categories = ["Wood", "Board", "Foam", "Fabric", "Marble", "Hardware", "Paint", "Adhesive", "Nail", "Other"];
const units = [
  ["piece", "Piece"],
  ["yard", "Yard"],
  ["bag", "Bag"],
  ["pair", "Pair"],
  ["pack", "Pack"],
  ["set", "Set"],
  ["roll", "Roll"],
  ["sqm", "sqm"],
  ["liter", "Liter"],
  ["pound", "Pound Weight"],
  ["gallon", "Gallon"],
  ["kilogram", "Kilogram"]
];
const dimensionUnits = [
  ["inches", "inches"],
  ["mm", "mm"],
  ["cm", "cm"],
  ["m", "meters"],
  ["ft", "feet"]
];

const emptyMaterial = {
  category: "",
  customCategory: "",
  subCategory: "",
  unit: "",
  size: "",
  color: "",
  thickness: "",
  thicknessUnit: "inches",
  standardWidth: "",
  standardLength: "",
  standardUnit: "inches",
  pricingUnit: "",
  sqmPricingBasis: "SQM",
  pricePerUnit: "",
  notes: "",
  image: ""
};

const titleCase = (value) => String(value || "")
  .trim()
  .replace(/\s+/g, " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

const materialCategory = (values) => values.category === "Other"
  ? titleCase(values.customCategory)
  : values.category;

const generatedName = (values) => {
  const category = materialCategory(values);
  const dimension = values.unit === "sqm" ? values.thickness : values.size;
  return [category, titleCase(values.subCategory), dimension, titleCase(values.color)]
    .filter((value) => String(value || "").trim())
    .join(" ");
};

const searchableText = (material) => [
  material.name,
  material.category,
  material.subCategory,
  material.unit,
  material.pricingUnit,
  material.size,
  material.color
].filter(Boolean).join(" ").toLowerCase();

const valuesFromMaterial = (material) => {
  const knownCategory = categories.find((category) => category.toLowerCase() === String(material.category || "").toLowerCase());
  const unit = String(material.unit || material.pricingUnit || "").toLowerCase();
  const pricingUnit = String(material.pricingUnit || unit || "").toLowerCase();
  const displayedPrice = pricingUnit === "sqm" && material.sqmPricingBasis !== "Sheet Size"
    ? material.pricePerSqm
    : material.pricePerUnit ?? material.unitPrice;

  return {
    ...emptyMaterial,
    category: knownCategory || "Other",
    customCategory: knownCategory ? "" : material.category || "",
    subCategory: material.subCategory || "",
    unit,
    size: material.size || "",
    color: material.color || "",
    thickness: material.thickness ?? "",
    thicknessUnit: material.thicknessUnit || "inches",
    standardWidth: material.standardWidth ?? "",
    standardLength: material.standardLength ?? "",
    standardUnit: material.standardUnit || "inches",
    pricingUnit,
    sqmPricingBasis: material.sqmPricingBasis || "SQM",
    pricePerUnit: displayedPrice ?? "",
    notes: material.notes || "",
    image: ""
  };
};

export function MaterialForm({ materials, companyName, editOnly = false, initialMaterial = null, isAdmin, onSubmit, onClose, submitting }) {
  const [mode, setMode] = useState(editOnly ? "edit" : "create");
  const [values, setValues] = useState(() => initialMaterial ? valuesFromMaterial(initialMaterial) : emptyMaterial);
  const [selectedMaterial, setSelectedMaterial] = useState(initialMaterial);
  const [search, setSearch] = useState(initialMaterial?.name || "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const editableMaterials = useMemo(() => (
    isAdmin
      ? materials
      : materials.filter((material) => String(material.companyName || "").toLowerCase() === String(companyName || "").toLowerCase())
  ), [companyName, isAdmin, materials]);

  const imagePreview = useMemo(() => {
    if (values.image instanceof File) return URL.createObjectURL(values.image);
    return selectedMaterial?.image || "";
  }, [selectedMaterial, values.image]);

  useEffect(() => () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const subcategories = useMemo(() => [...new Set(
    editableMaterials
      .filter((material) => !materialCategory(values) || String(material.category || "").toLowerCase() === materialCategory(values).toLowerCase())
      .map((material) => material.subCategory)
      .filter(Boolean)
  )].sort(), [editableMaterials, values]);

  const filteredMaterials = useMemo(() => {
    const term = search.trim().toLowerCase();
    return editableMaterials
      .filter((material) => !term || searchableText(material).includes(term))
      .slice(0, 40);
  }, [editableMaterials, search]);

  const setField = (name, value) => {
    setError("");
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === "category") {
        next.customCategory = "";
        next.subCategory = "";
      }
      if (name === "unit") {
        next.pricingUnit = value;
        if (value !== "sqm") {
          next.thickness = "";
          next.standardWidth = "";
          next.standardLength = "";
          next.sqmPricingBasis = "SQM";
        } else {
          next.size = "";
        }
      }
      return next;
    });
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setValues(emptyMaterial);
    setSelectedMaterial(null);
    setSearch("");
    setPickerOpen(nextMode === "edit");
    setError("");
  };

  const selectMaterial = (material) => {
    setSelectedMaterial(material);
    setValues(valuesFromMaterial(material));
    setSearch(material.name);
    setPickerOpen(false);
    setError("");
  };

  const validate = () => {
    if (!materialCategory(values)) return "Select a category.";
    if (values.category === "Other" && !values.customCategory.trim()) return "Enter the material category.";
    if (!values.subCategory.trim()) return "Enter a subcategory.";
    if (!values.unit) return "Select a material unit.";
    if (mode === "edit" && !selectedMaterial?._id) return "Select a saved material.";
    if (values.unit === "sqm") {
      if (!(Number(values.thickness) > 0)) return "Thickness must be greater than zero.";
      if (!(Number(values.standardWidth) > 0)) return "Standard width must be greater than zero.";
      if (!(Number(values.standardLength) > 0)) return "Standard length must be greater than zero.";
    }
    if (values.pricePerUnit !== "" && (!Number.isFinite(Number(values.pricePerUnit)) || Number(values.pricePerUnit) < 0)) {
      return "Price must be a valid non-negative number.";
    }
    return "";
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const isSqm = values.unit === "sqm";
    const payload = {
      name: generatedName(values),
      category: materialCategory(values),
      subCategory: titleCase(values.subCategory),
      unit: values.unit,
      size: isSqm ? "" : values.size.trim(),
      color: titleCase(values.color),
      pricingUnit: values.pricingUnit || values.unit,
      billingMode: isSqm ? "area_prorated" : "unit",
      notes: values.notes.trim(),
      useCatalog: false
    };

    if (values.pricePerUnit !== "") payload.pricePerUnit = Number(values.pricePerUnit);
    if (values.image instanceof File) payload.image = values.image;
    if (isSqm) {
      payload.thickness = Number(values.thickness);
      payload.thicknessUnit = values.thicknessUnit;
      payload.standardWidth = Number(values.standardWidth);
      payload.standardLength = Number(values.standardLength);
      payload.standardUnit = values.standardUnit;
      payload.sqmPricingBasis = values.sqmPricingBasis;
    }

    await onSubmit(payload, {
      mode,
      materialId: selectedMaterial?._id
    });
  };

  return (
    <div className="modal-backdrop material-modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card material-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="material-modal-header">
          <div>
            <span className="eyebrow">Materials</span>
            <h2>{mode === "create" ? "Add material" : "Edit material"}</h2>
            <p>{mode === "create" ? "Add a material and submit it for approval." : "Choose a saved material and update its details."}</p>
          </div>
          <button className="material-close" onClick={onClose} type="button" aria-label="Close">×</button>
        </header>

        {!editOnly && (
          <div className="material-mode-tabs" role="tablist" aria-label="Material form mode">
            <button className={mode === "create" ? "active" : ""} onClick={() => changeMode("create")} type="button">Create New</button>
            <button className={mode === "edit" ? "active" : ""} onClick={() => changeMode("edit")} type="button">Edit Existing</button>
          </div>
        )}

        <form className="material-form" onSubmit={submit}>
          {mode === "edit" && !editOnly && (
            <section className="material-form-section">
              <div className="material-section-heading">
                <span>01</span>
                <div><h3>Select Saved Material</h3><p>Search by name, category, subcategory, unit, size or color.</p></div>
              </div>
              <div className="material-picker">
                <input
                  type="search"
                  placeholder="Search saved materials"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPickerOpen(true);
                  }}
                  onFocus={() => setPickerOpen(true)}
                />
                {pickerOpen && (
                  <div className="material-picker-results">
                    {filteredMaterials.map((material) => (
                      <button key={material._id} onClick={() => selectMaterial(material)} type="button">
                        <span className="material-picker-thumb">
                          {material.image
                            ? <span className="material-picker-image" style={{ backgroundImage: `url("${material.image}")` }} />
                            : material.name?.slice(0, 2).toUpperCase()}
                        </span>
                        <span><strong>{material.name}</strong><small>{[material.category, material.subCategory, material.size, material.color].filter(Boolean).join(" · ")}</small></span>
                      </button>
                    ))}
                    {!filteredMaterials.length && <p>No saved materials found.</p>}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="material-form-section">
            <div className="material-section-heading">
              <span>{mode === "edit" ? "02" : "01"}</span>
              <div><h3>Material Image</h3><p>Add a clear photo of the material or its finish.</p></div>
            </div>
            <button className={imagePreview ? "material-image-upload has-image" : "material-image-upload"} onClick={() => fileInputRef.current?.click()} type="button">
              {imagePreview ? (
                <>
                  <span className="material-image-preview" role="img" aria-label="Material preview" style={{ backgroundImage: `url("${imagePreview}")` }} />
                  <span>Replace image</span>
                </>
              ) : (
                <>
                  <strong>+</strong>
                  <span>Add Material Image</span>
                  <small>PNG, JPG or WEBP</small>
                </>
              )}
            </button>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => setField("image", event.target.files?.[0] || "")} />
          </section>

          <section className="material-form-section">
            <div className="material-section-heading">
              <span>{mode === "edit" ? "03" : "02"}</span>
              <div><h3>Material Details</h3><p>Choose the category, unit and identifying details.</p></div>
            </div>

            <fieldset className="material-fieldset">
              <legend>Category</legend>
              <div className="material-choice-grid category-choices">
                {categories.map((category) => (
                  <button className={values.category === category ? "active" : ""} key={category} onClick={() => setField("category", category)} type="button">{category}</button>
                ))}
              </div>
            </fieldset>

            {values.category === "Other" && (
              <label>Category Name<input value={values.customCategory} onChange={(event) => setField("customCategory", event.target.value)} placeholder="Enter material category" /></label>
            )}

            <div className="material-fields-grid">
              <label>
                Subcategory
                <input list="material-subcategories" value={values.subCategory} onChange={(event) => setField("subCategory", event.target.value)} placeholder="Enter or select subcategory" required />
                <datalist id="material-subcategories">{subcategories.map((subcategory) => <option key={subcategory} value={subcategory} />)}</datalist>
              </label>
              <label>Color <span className="optional">Optional</span><input value={values.color} onChange={(event) => setField("color", event.target.value)} placeholder="e.g. Walnut" /></label>
            </div>

            <fieldset className="material-fieldset">
              <legend>Unit</legend>
              <div className="material-choice-grid unit-choices">
                {units.map(([value, label]) => (
                  <button className={values.unit === value ? "active" : ""} key={value} onClick={() => setField("unit", value)} type="button">{label}</button>
                ))}
              </div>
            </fieldset>

            {values.unit === "sqm" ? (
              <div className="material-dimension-panel">
                <div className="material-fields-grid">
                  <label>Thickness<input min="0" step="any" type="number" value={values.thickness} onChange={(event) => setField("thickness", event.target.value)} required /></label>
                  <label>Thickness Unit<select value={values.thicknessUnit} onChange={(event) => setField("thicknessUnit", event.target.value)}>{dimensionUnits.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </div>
                <div>
                  <h4>Standard Sheet Size</h4>
                  <p>Enter the supplier’s sheet dimensions, not the project dimensions.</p>
                </div>
                <div className="material-fields-grid three">
                  <label>Width<input min="0" step="any" type="number" value={values.standardWidth} onChange={(event) => setField("standardWidth", event.target.value)} required /></label>
                  <label>Length<input min="0" step="any" type="number" value={values.standardLength} onChange={(event) => setField("standardLength", event.target.value)} required /></label>
                  <label>Measurement Unit<select value={values.standardUnit} onChange={(event) => setField("standardUnit", event.target.value)}>{dimensionUnits.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </div>
              </div>
            ) : values.unit ? (
              <label>Size <span className="optional">Optional</span><input value={values.size} onChange={(event) => setField("size", event.target.value)} placeholder="e.g. 50 yards, 25kg or Large" /></label>
            ) : null}

            <label>Material Name<input className="generated-material-name" value={generatedName(values)} readOnly placeholder="Generated from the material details" /></label>
          </section>

          <section className="material-form-section">
            <div className="material-section-heading">
              <span>{mode === "edit" ? "04" : "03"}</span>
              <div><h3>Pricing</h3><p>Pricing is optional. Unpriced materials can be completed later.</p></div>
            </div>
            <div className="material-fields-grid">
              <label>Pricing Unit<select value={values.pricingUnit} onChange={(event) => setField("pricingUnit", event.target.value)}><option value="">Match material unit</option>{units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Price per Unit <span className="optional">Optional</span><div className="currency-field"><span>₦</span><input min="0" step="any" type="number" value={values.pricePerUnit} onChange={(event) => setField("pricePerUnit", event.target.value)} placeholder="0.00" /></div></label>
            </div>
            {(values.pricingUnit || values.unit) === "sqm" && (
              <fieldset className="material-fieldset">
                <legend>Is this price per SQM or per sheet?</legend>
                <div className="material-segmented-control">
                  {["SQM", "Sheet Size"].map((basis) => (
                    <button className={values.sqmPricingBasis === basis ? "active" : ""} key={basis} onClick={() => setField("sqmPricingBasis", basis)} type="button">{basis}</button>
                  ))}
                </div>
              </fieldset>
            )}
            <label>Notes <span className="optional">Optional</span><textarea rows="4" value={values.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Supplier, quality, specification or approval notes" /></label>
          </section>

          {error && <div className="alert error material-form-error">{error}</div>}

          <footer className="material-form-actions">
            <button className="text-button" onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "Saving..." : mode === "create" ? "Submit for Approval" : "Update Material"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
