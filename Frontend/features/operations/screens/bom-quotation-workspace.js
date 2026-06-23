"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/features/navigation/components/app-shell";
import { MaterialCatalogSelector } from "@/features/operations/components/material-catalog-selector";
import {
  calculateBomPricing,
  isAreaUnit,
  isIntegerUnit,
  materialLineTotal,
  materialUnit,
  money,
  numberValue
} from "@/features/operations/utils/bom-pricing";
import { apiRequest } from "@/services/api-client";
import { WorkspaceSkeleton } from "@/features/shared/components/loading-skeletons";

const emptyBom = {
  materials: [],
  additionalCosts: [],
  product: null,
  pricingMethod: "direct_markup",
  overheadCost: "",
  markupPercentage: "",
  expectedDuration: "",
  expectedPeriod: "Day",
  dueDate: ""
};

const emptyProductForm = {
  name: "",
  category: "",
  subCategory: "",
  description: "",
  image: null
};

const emptyMaterialInput = {
  quantity: "1",
  width: "",
  length: "",
  dimensionUnit: "cm",
  manualPrice: "",
  manualPriceBasis: "sqm"
};

const formatThousandsInput = (value) => {
  const normalized = String(value || "").replace(/[^\d.]/g, "");
  if (!normalized) return "";
  const [whole, decimal] = normalized.split(".");
  const formattedWhole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(whole || 0));
  return decimal !== undefined ? `${formattedWhole}.${decimal.slice(0, 2)}` : formattedWhole;
};

const emptyClient = {
  clientName: "",
  email: "",
  phoneNumber: "",
  clientAddress: "",
  nearestBusStop: "",
  description: "",
  discount: "0",
  dueDate: ""
};

const unwrapRows = (payload) => Array.isArray(payload?.data) ? payload.data : [];
const overheadLabel = (item) => [item.description, item.category, item.period].filter(Boolean).join(" · ");

const materialForApi = (material) => {
  const { sourceMaterial, ...cleanMaterial } = material;
  if (isAreaUnit(material) && (cleanMaterial.squareMeter === undefined || cleanMaterial.squareMeter === null)) {
    cleanMaterial.squareMeter = numberValue(material.squareMeter);
  }
  return cleanMaterial;
};

const bomForApi = (bom) => ({
  name: bom.name,
  description: bom.description,
  product: bom.product,
  materials: (bom.materials || []).map(materialForApi),
  additionalCosts: bom.additionalCosts || [],
  pricing: bom.pricing,
  expectedDuration: bom.expectedDuration,
  dueDate: bom.dueDate
});

export function BomQuotationWorkspace({ token, user, mode }) {
  const companyName = user?.activeCompany?.name || user?.companies?.[user?.activeCompanyIndex || 0]?.name || "company";
  const draftKey = `ww_bom_workspace:${user?._id || user?.id || user?.email}:${companyName}`;
  const [groups, setGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [overheadCosts, setOverheadCosts] = useState([]);
  const [savedBoms, setSavedBoms] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [workingBoms, setWorkingBoms] = useState([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draft, setDraft] = useState(emptyBom);
  const [builderStep, setBuilderStep] = useState("materials");
  const [editingBomIndex, setEditingBomIndex] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialInput, setMaterialInput] = useState(emptyMaterialInput);
  const [calculationResult, setCalculationResult] = useState(null);
  const [editingMaterialIndex, setEditingMaterialIndex] = useState(null);
  const [additionalCost, setAdditionalCost] = useState({ name: "", description: "", amount: "" });
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [client, setClient] = useState(emptyClient);
  const [screen, setScreen] = useState(mode === "boms" ? "saved" : "working");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const calculationRequestRef = useRef(0);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [groupPayload, productPayload, overheadPayload, bomPayload, quotationPayload, clientPayload] = await Promise.all([
        apiRequest("/api/product/materials/grouped", { token, query: { limit: 500 } }),
        apiRequest("/api/product", { token, query: { page: 1, limit: 200 } }),
        apiRequest("/api/oc/get-oc", { token }),
        apiRequest("/api/bom", { token, query: { page: 1, limit: 200 } }),
        apiRequest("/api/quotation", { token, query: { page: 1, limit: 200 } }),
        apiRequest("/api/sales/get-clients", { token })
      ]);
      setGroups(unwrapRows(groupPayload));
      setProducts(unwrapRows(productPayload));
      setOverheadCosts(unwrapRows(overheadPayload));
      setSavedBoms(unwrapRows(bomPayload));
      setQuotations(unwrapRows(quotationPayload));
      setClients(unwrapRows(clientPayload));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const updateMaterialInput = useCallback((nextInput) => {
    calculationRequestRef.current += 1;
    setMaterialInput(nextInput);
  }, []);

  useEffect(() => {
    queueMicrotask(loadWorkspace);
  }, [loadWorkspace]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(draftKey);
        setWorkingBoms(stored ? JSON.parse(stored) : []);
      } catch {
        localStorage.removeItem(draftKey);
        setWorkingBoms([]);
      } finally {
        setDraftLoaded(true);
      }
    });
  }, [draftKey]);

  useEffect(() => {
    if (!draftLoaded) return;
    localStorage.setItem(draftKey, JSON.stringify(workingBoms));
  }, [draftKey, draftLoaded, workingBoms]);

  const pricing = useMemo(() => calculateBomPricing({
    materials: draft.materials,
    additionalCosts: draft.additionalCosts,
    overheadCost: draft.overheadCost,
    markupPercentage: draft.markupPercentage,
    pricingMethod: draft.pricingMethod
  }), [draft]);

  const savedOverheadTotal = useMemo(
    () => overheadCosts.reduce((sum, item) => sum + numberValue(item.cost), 0),
    [overheadCosts]
  );

  const applySavedOverhead = (amount = savedOverheadTotal) => {
    setDraft({
      ...draft,
      pricingMethod: "include_overhead",
      overheadCost: amount ? String(amount) : ""
    });
  };

  const workingTotals = useMemo(() => workingBoms.reduce((totals, item) => ({
    cost: totals.cost + numberValue(item.bom.pricing?.costPrice || item.bom.totalCost) * item.quantity,
    selling: totals.selling + numberValue(item.bom.pricing?.sellingPrice || item.bom.totalCost) * item.quantity
  }), { cost: 0, selling: 0 }), [workingBoms]);

  const openNewBom = () => {
    setDraft(emptyBom);
    setSelectedMaterial(null);
    setMaterialInput(emptyMaterialInput);
    setCalculationResult(null);
    setEditingMaterialIndex(null);
    setAdditionalCost({ name: "", description: "", amount: "" });
    setProductForm(emptyProductForm);
    setBuilderStep("materials");
    setEditingBomIndex(null);
    setBuilderOpen(true);
  };

  const openEditBom = (item, index) => {
    const bom = item.bom;
    setDraft({
      ...emptyBom,
      materials: bom.materials || [],
      additionalCosts: bom.additionalCosts || [],
      product: bom.product || null,
      pricingMethod: bom.pricing?.pricingMethod || "direct_markup",
      overheadCost: bom.pricing?.overheadCost ? String(bom.pricing.overheadCost) : "",
      markupPercentage: bom.pricing?.markupPercentage ? String(bom.pricing.markupPercentage) : "",
      expectedDuration: bom.expectedDuration?.value ? String(bom.expectedDuration.value) : "",
      expectedPeriod: bom.expectedDuration?.unit || "Day",
      dueDate: bom.dueDate ? String(bom.dueDate).slice(0, 10) : ""
    });
    setSelectedMaterial(null);
    setMaterialInput(emptyMaterialInput);
    setCalculationResult(null);
    setEditingMaterialIndex(null);
    setAdditionalCost({ name: "", description: "", amount: "" });
    setProductForm(emptyProductForm);
    setBuilderStep("materials");
    setEditingBomIndex(index);
    setBuilderOpen(true);
  };

  const calculateMaterial = useCallback(async ({ silent = false } = {}) => {
    if (!selectedMaterial) {
      if (!silent) setError("Select a material variant first.");
      return false;
    }
    const unit = materialUnit(selectedMaterial);
    const areaBased = isAreaUnit(selectedMaterial);
    const quantity = numberValue(materialInput.quantity);
    const manualPrice = numberValue(materialInput.manualPrice);

    if (!areaBased && quantity <= 0) {
      if (!silent) setError("Quantity must be greater than zero.");
      return false;
    }
    if (!areaBased && isIntegerUnit(unit) && !Number.isInteger(quantity)) {
      if (!silent) setError(`${unit} uses whole-number quantities.`);
      return false;
    }
    if (!selectedMaterial.isPriced && manualPrice <= 0) {
      if (!silent) setError("This material is unpriced. Enter a manual price.");
      return false;
    }
    if (areaBased && (numberValue(materialInput.width) <= 0 || numberValue(materialInput.length) <= 0)) {
      if (!silent) setError("Enter the project length and width for an sqm material.");
      return false;
    }

    const requestId = calculationRequestRef.current + 1;
    calculationRequestRef.current = requestId;
    setBusy(true);
    setError("");
    try {
      let calculation = null;
      let squareMeter = 0;
      let price = manualPrice || numberValue(selectedMaterial.unitPrice || selectedMaterial.pricePerSqm);
      let lineTotal = price * quantity;

      if (areaBased || selectedMaterial.isPriced) {
        const result = await apiRequest(`/api/product/material/${selectedMaterial.id}/calculate-cost`, {
          method: "POST",
          token,
          body: areaBased ? {
            length: numberValue(materialInput.length),
            width: numberValue(materialInput.width),
            unit: materialInput.dimensionUnit,
            requiredLength: numberValue(materialInput.length),
            requiredWidth: numberValue(materialInput.width),
            requiredUnit: materialInput.dimensionUnit,
            quantity: 1,
            manualPrice: selectedMaterial.isPriced ? undefined : manualPrice,
            manualPriceBasis: selectedMaterial.isPriced ? undefined : materialInput.manualPriceBasis
          } : { quantity }
        });
        const data = result.data;
        calculation = {
          ...data.calculation,
          totalMaterialCost: numberValue(data.pricing?.totalMaterialCost),
          manualPrice: !selectedMaterial.isPriced,
          manualPriceValue: !selectedMaterial.isPriced ? manualPrice : undefined,
          manualPriceBasis: !selectedMaterial.isPriced ? materialInput.manualPriceBasis : undefined
        };
        squareMeter = numberValue(data.project?.projectAreaSqm || data.dimensions?.projectAreaSqm);
        price = numberValue(
          data.calculation?.mode === "full_sheet"
            ? data.pricing?.pricePerFullUnit
            : data.pricing?.pricePerUnit || data.pricing?.pricePerSqm || data.pricing?.pricePerFullUnit || price
        );
        lineTotal = numberValue(data.pricing?.totalMaterialCost);
      } else {
        calculation = { mode: "unit_based", quantity, totalMaterialCost: lineTotal, manualPrice: true, manualPriceValue: manualPrice };
      }

      const material = {
        materialId: selectedMaterial.id,
        name: selectedMaterial.name,
        category: selectedMaterial.category,
        subCategory: selectedMaterial.subCategory,
        type: selectedMaterial.type,
        unit,
        billingMode: selectedMaterial.billingMode,
        size: selectedMaterial.size,
        color: selectedMaterial.color,
        thickness: selectedMaterial.thickness,
        width: areaBased ? numberValue(materialInput.width) : undefined,
        length: areaBased ? numberValue(materialInput.length) : undefined,
        dimensionUnit: areaBased ? materialInput.dimensionUnit : undefined,
        squareMeter: areaBased ? squareMeter : undefined,
        quantity: areaBased ? 1 : quantity,
        price,
        subtotal: lineTotal,
        description: [selectedMaterial.size, selectedMaterial.color].filter(Boolean).join(" · "),
        calculation,
        sourceMaterial: selectedMaterial
      };

      if (calculationRequestRef.current !== requestId) return false;
      setCalculationResult(material);
      return true;
    } catch (requestError) {
      if (calculationRequestRef.current !== requestId) return false;
      setError(requestError.message);
      return false;
    } finally {
      if (calculationRequestRef.current === requestId) setBusy(false);
    }
  }, [materialInput, selectedMaterial, token]);

  useEffect(() => {
    if (!builderOpen || builderStep !== "materials" || !selectedMaterial) return undefined;
    const timeout = setTimeout(() => {
      calculateMaterial({ silent: true });
    }, 450);
    return () => clearTimeout(timeout);
  }, [builderOpen, builderStep, calculateMaterial, selectedMaterial]);

  const addCalculatedMaterial = () => {
    if (!calculationResult) return;
    setDraft((current) => ({
      ...current,
      materials: editingMaterialIndex === null
        ? [...current.materials, calculationResult]
        : current.materials.map((material, index) => index === editingMaterialIndex ? calculationResult : material)
    }));
    setNotice(`${calculationResult.name} ${editingMaterialIndex === null ? "added to" : "updated in"} this BOM.`);
    setSelectedMaterial(null);
    setMaterialInput(emptyMaterialInput);
    setCalculationResult(null);
    setEditingMaterialIndex(null);
  };

  const editMaterial = (material, index) => {
    setSelectedMaterial(material.sourceMaterial || {
      id: material.materialId,
      name: material.name,
      category: material.category,
      subCategory: material.subCategory,
      type: material.type,
      pricingUnit: material.unit,
      unit: material.unit,
      size: material.size,
      color: material.color,
      thickness: material.thickness,
      isPriced: !material.calculation?.manualPrice,
      unitPrice: material.price
    });
    updateMaterialInput({
      quantity: String(material.quantity || 1),
      width: material.width ? String(material.width) : "",
      length: material.length ? String(material.length) : "",
      dimensionUnit: material.dimensionUnit || "cm",
      manualPrice: material.calculation?.manualPrice ? String(material.calculation?.manualPriceValue || material.price) : "",
      manualPriceBasis: material.calculation?.manualPriceBasis || "sqm"
    });
    setCalculationResult(null);
    setEditingMaterialIndex(index);
    setBuilderStep("materials");
  };

  const addCost = () => {
    if (!additionalCost.name.trim() || numberValue(additionalCost.amount) <= 0) {
      return setError("Enter an additional cost name and amount.");
    }
    setDraft((current) => ({
      ...current,
      additionalCosts: [...current.additionalCosts, {
        name: additionalCost.name.trim(),
        description: additionalCost.description.trim(),
        amount: numberValue(additionalCost.amount)
      }]
    }));
    setAdditionalCost({ name: "", description: "", amount: "" });
    setError("");
  };

  const updateMaterialQuantity = async (index, nextQuantity) => {
    const material = draft.materials[index];
    if (!material) return;
    const unit = materialUnit(material);
    const quantity = Math.max(1, numberValue(nextQuantity, 1));

    if (isIntegerUnit(unit) && !Number.isInteger(quantity)) {
      return setError(`${unit} uses whole-number quantities.`);
    }

    setBusy(true);
    setError("");
    try {
      let updated;
      if (isAreaUnit(material) || !material.calculation?.manualPrice) {
        const result = await apiRequest(`/api/product/material/${material.materialId}/calculate-cost`, {
          method: "POST",
          token,
          body: isAreaUnit(material) ? {
            length: material.length,
            width: material.width,
            unit: material.dimensionUnit,
            requiredLength: material.length,
            requiredWidth: material.width,
            requiredUnit: material.dimensionUnit,
            quantity,
            manualPrice: material.calculation?.manualPrice ? (material.calculation?.manualPriceValue || material.price) : undefined,
            manualPriceBasis: material.calculation?.manualPriceBasis
          } : { quantity }
        });
        const data = result.data;
        updated = {
          ...material,
          quantity,
          squareMeter: numberValue(data.project?.projectAreaSqm || data.dimensions?.projectAreaSqm || material.squareMeter),
          price: numberValue(
            data.calculation?.mode === "full_sheet"
              ? data.pricing?.pricePerFullUnit
              : data.pricing?.pricePerUnit || data.pricing?.pricePerSqm || data.pricing?.pricePerFullUnit || material.price
          ),
          calculation: {
            ...material.calculation,
            ...data.calculation,
            totalMaterialCost: numberValue(data.pricing?.totalMaterialCost)
          }
        };
      } else {
        updated = {
          ...material,
          quantity,
          calculation: {
            ...material.calculation,
            quantity,
            totalMaterialCost: quantity * numberValue(material.price)
          }
        };
      }
      setDraft((current) => ({
        ...current,
        materials: current.materials.map((item, itemIndex) => itemIndex === index ? updated : item)
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const continueFromMaterials = () => {
    if (!draft.materials.length) return setError("Add at least one calculated material before continuing.");
    setError("");
    setBuilderStep("product");
  };

  const selectProductForDraft = (product) => {
    setDraft((current) => ({
      ...current,
      product: {
        productId: product.productId || null,
        name: product.name,
        description: product.description || null,
        image: product.image || null
      }
    }));
    setError("");
  };

  const createProductForDraft = async () => {
    if (!productForm.name.trim() || !productForm.category.trim()) {
      return setError("Enter product name and category to create a product.");
    }

    const formData = new FormData();
    formData.append("name", productForm.name.trim());
    formData.append("category", productForm.category.trim());
    if (productForm.subCategory.trim()) formData.append("subCategory", productForm.subCategory.trim());
    if (productForm.description.trim()) formData.append("description", productForm.description.trim());
    if (productForm.image) formData.append("image", productForm.image);

    setBusy(true);
    setError("");
    try {
      const result = await apiRequest("/api/product", {
        method: "POST",
        token,
        formData
      });
      const product = result.data;
      setProducts((current) => [product, ...current]);
      selectProductForDraft(product);
      setProductForm(emptyProductForm);
      setNotice(`${product.name} created and attached to this BOM.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const continueFromProduct = () => {
    if (!draft.product?.name) return setError("Select or create the product this BOM is for.");
    setError("");
    setBuilderStep("summary");
  };

  const finishBomToQuotation = () => {
    if (!draft.materials.length) return setError("Add at least one calculated material before continuing.");
    if (!draft.product?.name) return setError("Select or create the product this BOM is for.");

    const materialNames = [...new Set(draft.materials.map((material) => material.name).filter(Boolean))];
    const generatedName = materialNames.length > 2
      ? `${materialNames.slice(0, 2).join(" + ")} + ${materialNames.length - 2} more`
      : materialNames.join(" + ");

    setError("");
    const workingBom = {
      _id: draft._id || `draft-bom-${Date.now()}`,
      bomNumber: draft.bomNumber || "Draft BOM",
      name: draft.product?.name || generatedName || "Material BOM",
      description: `BOM for ${draft.product?.name || generatedName || "selected product"} with ${draft.materials.length} material item${draft.materials.length === 1 ? "" : "s"}`,
      product: draft.product,
      materials: draft.materials,
      additionalCosts: draft.additionalCosts,
      pricing,
      materialsCost: pricing.materialsTotal,
      additionalCostsTotal: pricing.additionalTotal,
      totalCost: pricing.costPrice,
      expectedDuration: draft.expectedDuration ? {
        value: numberValue(draft.expectedDuration),
        unit: draft.expectedPeriod
      } : undefined,
      dueDate: draft.dueDate || null
    };

    setWorkingBoms((current) => editingBomIndex === null
      ? [...current, { bom: workingBom, quantity: 1 }]
      : current.map((item, index) => index === editingBomIndex ? { ...item, bom: workingBom } : item));
    setDraft(emptyBom);
    setBuilderOpen(false);
    setBuilderStep("materials");
    setEditingBomIndex(null);
    setScreen("working");
    setNotice(`${workingBom.name} ${editingBomIndex === null ? "added to" : "updated in"} the quotation workspace.`);
  };

  const importBom = (bom) => {
    setWorkingBoms((current) => current.some((item) => item.bom._id === bom._id)
      ? current
      : [...current, { bom, quantity: 1 }]);
    setNotice(`${bom.bomNumber} imported into the working quotation.`);
    if (mode === "quotations") setScreen("working");
  };

  const submitQuotation = async () => {
    if (!client.clientName.trim()) return setError("Client name is required.");
    if (!client.email.trim()) return setError("Client email is required so the quotation can be sent.");
    if (!workingBoms.length) return setError("Add at least one BOM to the quotation.");

    const discount = numberValue(client.discount);
    const items = workingBoms.map(({ bom, quantity }) => ({
      woodType: bom.product?.name || bom.name,
      description: bom.name,
      quantity,
      costPrice: numberValue(bom.pricing?.costPrice || bom.totalCost),
      sellingPrice: numberValue(bom.pricing?.sellingPrice || bom.totalCost),
      unit: "piece",
      image: bom.product?.image || null
    }));
    const aggregateOverhead = workingBoms.reduce(
      (sum, item) => sum + numberValue(item.bom.pricing?.overheadCost) * item.quantity,
      0
    );

    setBusy(true);
    setError("");
    try {
      const result = await apiRequest("/api/quotation", {
        method: "POST",
        token,
        body: {
          ...client,
          discount,
          dueDate: client.dueDate || null,
          items,
          costPrice: workingTotals.cost,
          overheadCost: aggregateOverhead,
          service: {
            product: workingBoms.map((item) => item.bom.product?.name || item.bom.name).join(", "),
            quantity: workingBoms.reduce((sum, item) => sum + item.quantity, 0),
            discount,
            totalPrice: workingTotals.selling - (workingTotals.selling * discount) / 100
          },
          boms: workingBoms.map(({ bom }) => bomForApi(bom))
        }
      });
      setQuotations((current) => [result.data, ...current]);
      setWorkingBoms([]);
      setClient(emptyClient);
      setQuotationOpen(false);
      setScreen("archive");
      setNotice(`${result.data.quotationNumber} created for ${result.data.clientName}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteBom = async (bom) => {
    if (!window.confirm(`Delete ${bom.bomNumber}?`)) return;
    setBusy(true);
    try {
      await apiRequest(`/api/bom/${bom._id}`, { method: "DELETE", token });
      setSavedBoms((current) => current.filter((item) => item._id !== bom._id));
      setWorkingBoms((current) => current.filter((item) => item.bom._id !== bom._id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <AppShell><WorkspaceSkeleton titleWidth="48%" /></AppShell>;

  return (
    <AppShell>
      <section className="workspace-heading bom-heading">
        <div>
          <span className="eyebrow">Materials to client document</span>
          <h1>{mode === "boms" ? "Bill of Materials" : "Quotation Workspace"}</h1>
          <p>Build each product from approved materials, calculate its BOM, then combine completed BOMs into a client quotation.</p>
        </div>
        <button className="primary-button inline" onClick={openNewBom}>Create BOM</button>
      </section>

      {notice && <div className="alert success">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="resource-tabs">
        <button className={screen === "working" ? "resource-tab active" : "resource-tab"} onClick={() => setScreen("working")}>Working quotation ({workingBoms.length})</button>
        <button className={screen === "saved" ? "resource-tab active" : "resource-tab"} onClick={() => setScreen("saved")}>Saved BOMs ({savedBoms.length})</button>
        {mode === "quotations" && <button className={screen === "archive" ? "resource-tab active" : "resource-tab"} onClick={() => setScreen("archive")}>Sent quotations ({quotations.length})</button>}
      </div>

      {screen === "working" && (
        <WorkingQuotation
          items={workingBoms}
          totals={workingTotals}
          onEdit={openEditBom}
          onImport={() => setScreen("saved")}
          onContinue={() => setQuotationOpen(true)}
          setItems={setWorkingBoms}
        />
      )}
      {screen === "saved" && <SavedBoms rows={savedBoms} onImport={importBom} onDelete={deleteBom} busy={busy} />}
      {screen === "archive" && <QuotationArchive rows={quotations} />}

      {builderOpen && (
        <BomBuilder
          additionalCost={additionalCost}
          busy={busy}
          draft={draft}
          builderStep={builderStep}
          groups={groups}
          products={products}
          productForm={productForm}
          overheadCosts={overheadCosts}
          savedOverheadTotal={savedOverheadTotal}
          materialInput={materialInput}
          calculationResult={calculationResult}
          editingMaterialIndex={editingMaterialIndex}
          pricing={pricing}
          selectedMaterial={selectedMaterial}
          setAdditionalCost={setAdditionalCost}
          setDraft={setDraft}
          setBuilderStep={setBuilderStep}
          setMaterialInput={updateMaterialInput}
          setProductForm={setProductForm}
          setSelectedMaterial={setSelectedMaterial}
          setCalculationResult={setCalculationResult}
          setEditingMaterialIndex={setEditingMaterialIndex}
          onAddCost={addCost}
          onAddCalculatedMaterial={addCalculatedMaterial}
          onEditMaterial={editMaterial}
          onUpdateMaterialQuantity={updateMaterialQuantity}
          onContinueMaterials={continueFromMaterials}
          onSelectProduct={selectProductForDraft}
          onCreateProduct={createProductForDraft}
          onContinueProduct={continueFromProduct}
          onApplySavedOverhead={applySavedOverhead}
          onClose={() => setBuilderOpen(false)}
          onSave={finishBomToQuotation}
        />
      )}

      {quotationOpen && (
        <QuotationClientModal
          busy={busy}
          client={client}
          clients={clients}
          items={workingBoms}
          setClient={setClient}
          totals={workingTotals}
          onClose={() => setQuotationOpen(false)}
          onSubmit={submitQuotation}
        />
      )}
    </AppShell>
  );
}

function WorkingQuotation({ items, totals, onEdit, onImport, onContinue, setItems }) {
  const margin = totals.selling - totals.cost;
  return (
    <>
      <section className="stat-grid resource-stats">
        <article className="stat-card"><span>BOMs</span><strong>{items.length}</strong><small>Products in this quotation</small></article>
        <article className="stat-card"><span>Total cost</span><strong>{money(totals.cost)}</strong><small>Materials, costs and overhead</small></article>
        <article className="stat-card"><span>Selling price</span><strong>{money(totals.selling)}</strong><small>Before client discount</small></article>
        <article className="stat-card"><span>Margin</span><strong>{money(margin)}</strong><small>{totals.selling ? `${((margin / totals.selling) * 100).toFixed(1)}%` : "0%"} margin</small></article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">Local working list</span><h2>BOMs to send to the client</h2></div>
          <div className="workspace-actions"><button className="secondary-button" onClick={onImport}>Import saved BOM</button></div>
        </div>
        {!items.length ? (
          <div className="empty-state"><h3>No BOMs added yet</h3><p>Create a BOM from materials or import a saved one.</p></div>
        ) : (
          <div className="working-bom-list">
            {items.map((item, index) => <BomSummaryCard key={item.bom._id || index} item={item} onEdit={() => onEdit(item, index)} onQuantity={(quantity) => setItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity } : entry))} onRemove={() => setItems((current) => current.filter((_, entryIndex) => entryIndex !== index))} />)}
          </div>
        )}
        <div className="continue-bar">
          <span><strong>{items.length}</strong> BOM{items.length === 1 ? "" : "s"} selected</span>
          <button className="primary-button" disabled={!items.length} onClick={onContinue}>Continue to client details</button>
        </div>
      </section>
    </>
  );
}

function BomSummaryCard({ item, onEdit, onQuantity, onRemove }) {
  const { bom, quantity } = item;
  const title = bom.product?.name || bom.name;
  return (
    <article className="working-bom-card">
      <div className="bom-product">
        {bom.product?.image ? <span className="bom-product-image has-image" style={{ backgroundImage: `url("${bom.product.image}")` }} /> : <span className="record-monogram">{title.slice(0, 2).toUpperCase()}</span>}
        <div><small>{bom.bomNumber || "Draft BOM"}</small><h3>{title}</h3><p>{bom.materials?.length || 0} materials · {bom.additionalCosts?.length || 0} additional costs</p></div>
      </div>
      <div className="bom-breakdown">
        {(bom.materials || []).slice(0, 4).map((material) => <span key={material._id || material.materialId || material.name}>{material.name}<strong>{money(materialLineTotal(material))}</strong></span>)}
      </div>
      <div className="quantity-stepper">
        <button onClick={() => onQuantity(Math.max(1, quantity - 1))}>−</button><strong>{quantity}</strong><button onClick={() => onQuantity(quantity + 1)}>+</button>
      </div>
      <div className="bom-card-total">
        <small>Selling total</small>
        <strong>{money(numberValue(bom.pricing?.sellingPrice || bom.totalCost) * quantity)}</strong>
        <div className="bom-card-actions"><button className="text-button" onClick={onEdit}>Edit</button><button className="text-button" onClick={onRemove}>Remove</button></div>
      </div>
    </article>
  );
}

function SavedBoms({ rows, onImport, onDelete, busy }) {
  return (
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">Reusable production plans</span><h2>Saved BOMs</h2></div></div>
      <div className="saved-bom-grid">
        {rows.map((bom) => (
          <article className="saved-bom-card" key={bom._id}>
            <div className="record-card-head"><span className="record-monogram">{bom.name.slice(0, 2).toUpperCase()}</span><div><small>{bom.bomNumber}</small><h3>{bom.product?.name || bom.name}</h3></div></div>
            <div className="saved-bom-metrics"><span>Materials<strong>{bom.materials?.length || 0}</strong></span><span>Cost<strong>{money(bom.pricing?.costPrice || bom.totalCost)}</strong></span><span>Selling<strong>{money(bom.pricing?.sellingPrice || bom.totalCost)}</strong></span></div>
            <div className="record-card-actions"><button className="primary-button" disabled={busy} onClick={() => onImport(bom)}>Add to quotation</button><button className="row-button danger" disabled={busy} onClick={() => onDelete(bom)}>Delete</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function QuotationArchive({ rows }) {
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const quotationImage = (quotation) => (
    quotation.boms?.find((bom) => bom.product?.image)?.product?.image
    || quotation.items?.find((item) => item.image)?.image
    || null
  );

  return (
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">Client documents</span><h2>Sent quotations</h2></div></div>
      <div className="saved-bom-grid">
        {rows.map((quotation) => {
          const image = quotationImage(quotation);
          return (
          <article className="saved-bom-card quotation-card" key={quotation._id}>
            <div className="record-card-head">
              {image ? <span className="quotation-card-image" style={{ backgroundImage: `url("${image}")` }} /> : <span className="record-monogram">QT</span>}
              <div><small>{quotation.quotationNumber}</small><h3>{quotation.clientName}</h3></div><span className={`status-badge status-${quotation.status}`}>{quotation.status}</span>
            </div>
            <p>{quotation.description || quotation.items?.map((item) => item.description).join(", ")}</p>
            <div className="saved-bom-metrics"><span>BOMs<strong>{quotation.boms?.length || quotation.items?.length || 0}</strong></span><span>Cost<strong>{money(quotation.costPrice)}</strong></span><span>Total<strong>{money(quotation.finalTotal)}</strong></span></div>
            <div className="record-card-actions"><button className="primary-button" onClick={() => setSelectedQuotation(quotation)}>View quotation</button></div>
          </article>
          );
        })}
      </div>
      {selectedQuotation && <QuotationDetailModal quotation={selectedQuotation} image={quotationImage(selectedQuotation)} onClose={() => setSelectedQuotation(null)} />}
    </section>
  );
}

function QuotationDetailModal({ quotation, image, onClose }) {
  const boms = quotation.boms || [];
  const items = quotation.items || [];
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card quotation-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading">
          <div><span className="eyebrow">Sent quotation</span><h2>{quotation.quotationNumber} · {quotation.clientName}</h2></div>
          <button className="icon-button" onClick={onClose}>Close</button>
        </div>

        <div className="quotation-detail-hero">
          {image ? <span className="quotation-detail-image" style={{ backgroundImage: `url("${image}")` }} /> : <span className="record-monogram">QT</span>}
          <div>
            <small className={`status-badge status-${quotation.status}`}>{quotation.status}</small>
            <h3>{quotation.description || items.map((item) => item.description).filter(Boolean).join(", ") || "Client quotation"}</h3>
            <p>{quotation.email || quotation.phoneNumber || "No contact detail supplied"}</p>
          </div>
        </div>

        <div className="quotation-detail-totals">
          <span>Cost price<strong>{money(quotation.costPrice)}</strong></span>
          <span>Overhead<strong>{money(quotation.overheadCost)}</strong></span>
          <span>Discount<strong>{numberValue(quotation.discount)}%</strong></span>
          <span>Total<strong>{money(quotation.finalTotal)}</strong></span>
        </div>

        <div className="quotation-detail-grid">
          <section>
            <div className="sidebar-section-heading"><div><span className="eyebrow">BOMs</span><h3>{boms.length} attached BOM{boms.length === 1 ? "" : "s"}</h3></div></div>
            <div className="quotation-detail-list">
              {boms.map((bom, index) => (
                <article key={bom._id || index}>
                  <div className="added-material-head">
                    {bom.product?.image ? <span className="product-image has-image" style={{ backgroundImage: `url("${bom.product.image}")` }} /> : <span className="material-card-icon">{(bom.product?.name || bom.name || "BOM").slice(0, 2).toUpperCase()}</span>}
                    <span><strong>{bom.product?.name || bom.name}</strong><small>{bom.materials?.length || 0} materials · {money(bom.pricing?.sellingPrice || bom.totalCost)}</small></span>
                  </div>
                  <div className="bom-breakdown">
                    {(bom.materials || []).map((material, materialIndex) => <span key={material._id || material.materialId || materialIndex}>{material.name}<strong>{money(materialLineTotal(material))}</strong></span>)}
                  </div>
                </article>
              ))}
              {!boms.length && <p>No BOM records were returned for this quotation.</p>}
            </div>
          </section>
          <section>
            <div className="sidebar-section-heading"><div><span className="eyebrow">Items</span><h3>{items.length} quotation item{items.length === 1 ? "" : "s"}</h3></div></div>
            <div className="quotation-detail-list">
              {items.map((item, index) => (
                <article key={item._id || index}>
                  <div className="bom-breakdown">
                    <span>Description<strong>{item.description || item.woodType || "Item"}</strong></span>
                    <span>Quantity<strong>{item.quantity || 1}</strong></span>
                    <span>Cost<strong>{money(item.costPrice)}</strong></span>
                    <span>Selling<strong>{money(item.sellingPrice)}</strong></span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function BomBuilder(props) {
  const {
    additionalCost, busy, builderStep, calculationResult, draft, editingMaterialIndex, groups,
    materialInput, overheadCosts, pricing, products, productForm, savedOverheadTotal, selectedMaterial, setAdditionalCost,
    setBuilderStep, setCalculationResult, setDraft, setEditingMaterialIndex, setMaterialInput,
    setProductForm, setSelectedMaterial, onAddCalculatedMaterial, onAddCost,
    onApplySavedOverhead, onClose, onContinueMaterials, onContinueProduct, onCreateProduct,
    onEditMaterial, onSave, onSelectProduct, onUpdateMaterialQuantity
  } = props;
  const areaBased = isAreaUnit(selectedMaterial);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewZoomed, setPreviewZoomed] = useState(false);
  const materialEntryRef = useRef(null);
  const calculationResultRef = useRef(null);
  const updateMaterialInput = (nextValues) => {
    setMaterialInput(nextValues);
    setCalculationResult(null);
  };
  const chooseMaterial = (material) => {
    setSelectedMaterial(material);
    setMaterialInput(emptyMaterialInput);
    setCalculationResult(null);
    setEditingMaterialIndex(null);
  };

  useEffect(() => {
    if (builderStep !== "materials" || !selectedMaterial) return;
    requestAnimationFrame(() => {
      materialEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [builderStep, selectedMaterial]);

  useEffect(() => {
    if (builderStep !== "materials" || !calculationResult) return;
    requestAnimationFrame(() => {
      calculationResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [builderStep, calculationResult]);

  return (
    <div className="modal-backdrop bom-builder-backdrop" onMouseDown={onClose}>
      <section className="modal-card bom-builder" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading">
          <div><span className="eyebrow">BOM builder</span><h2>Add the materials needed for one product</h2></div>
          <button className="icon-button" onClick={onClose}>Close</button>
        </div>

        <div className="builder-stepper">
          {[
            ["materials", "1. Materials"],
            ["product", "2. Product"],
            ["summary", "3. Summary"]
          ].map(([step, label]) => (
            <button type="button" key={step} className={builderStep === step ? "active" : ""} onClick={() => setBuilderStep(step)}>
              {label}
            </button>
          ))}
        </div>

        <div className="builder-layout">
          <div className="builder-main">
            {builderStep === "materials" && (
              <>
                <MaterialCatalogSelector groups={groups} selected={selectedMaterial} onSelect={chooseMaterial} />
                {selectedMaterial && (
                  <section className="material-entry" ref={materialEntryRef}>
                    <div><span className="eyebrow">Selected material</span><h3>{selectedMaterial.name}</h3><p>{selectedMaterial.category} · {selectedMaterial.subCategory} · {materialUnit(selectedMaterial)}</p></div>
                    {areaBased && selectedMaterial.dimensionRule?.stockDimensions?.width && selectedMaterial.dimensionRule?.stockDimensions?.length && (
                      <div className="standard-size">
                        Standard material size
                        <strong>{selectedMaterial.dimensionRule.stockDimensions.length} × {selectedMaterial.dimensionRule.stockDimensions.width} {selectedMaterial.dimensionRule.stockDimensions.unit}</strong>
                      </div>
                    )}
                    <div className="material-input-heading">
                      <strong>{areaBased ? "Project Size" : "Quantity"}</strong>
                      <small>{areaBased ? "Required only because this material unit is sqm" : `${materialUnit(selectedMaterial)} uses quantity only`}</small>
                    </div>
                    <div className="form-grid">
                      {areaBased ? (
                        <>
                          <label>Length (longer side)<input type="number" min="0" step="any" value={materialInput.length} onChange={(event) => updateMaterialInput({ ...materialInput, length: event.target.value })} /></label>
                          <label>Width (shorter side)<input type="number" min="0" step="any" value={materialInput.width} onChange={(event) => updateMaterialInput({ ...materialInput, width: event.target.value })} /></label>
                          <label>Measurement unit<select value={materialInput.dimensionUnit} onChange={(event) => updateMaterialInput({ ...materialInput, dimensionUnit: event.target.value })}><option value="inches">Inches</option><option value="cm">Centimetres</option><option value="mm">Millimetres</option><option value="m">Metres</option><option value="ft">Feet</option></select></label>
                        </>
                      ) : (
                        <label>Quantity<input type="number" min="0" step={isIntegerUnit(materialUnit(selectedMaterial)) ? "1" : "any"} value={materialInput.quantity} onChange={(event) => updateMaterialInput({ ...materialInput, quantity: event.target.value })} /></label>
                      )}
                      {!selectedMaterial.isPriced && areaBased && (
                        <label>Manual price basis<select value={materialInput.manualPriceBasis} onChange={(event) => updateMaterialInput({ ...materialInput, manualPriceBasis: event.target.value })}><option value="sqm">Per sqm</option><option value="full_unit">Full sheet price</option></select></label>
                      )}
                      {!selectedMaterial.isPriced && <label>{areaBased ? (materialInput.manualPriceBasis === "full_unit" ? "Manual full sheet price" : "Manual price per sqm") : "Manual price per unit"}<input inputMode="decimal" placeholder="e.g. 300,000" value={materialInput.manualPrice} onChange={(event) => updateMaterialInput({ ...materialInput, manualPrice: formatThousandsInput(event.target.value) })} /></label>}
                    </div>
                    {busy && <div className="material-auto-calculate-status">Calculating...</div>}
                    {calculationResult && (
                      <div className="calculation-result" ref={calculationResultRef}>
                        {areaBased && <span>Required area<strong>{numberValue(calculationResult.squareMeter).toFixed(2)} sqm</strong></span>}
                        <span>{areaBased ? "Billable quantity" : "Quantity"}<strong>{areaBased ? numberValue(calculationResult.calculation?.billableUnits || calculationResult.calculation?.minimumUnits || 1).toFixed(2) : calculationResult.quantity} {areaBased ? (calculationResult.calculation?.mode === "full_sheet" ? "sheet(s)" : "sqm") : calculationResult.unit}</strong></span>
                        <span>Price per unit<strong>{money(calculationResult.price)}</strong></span>
                        <span className="calculation-total">Material total<strong>{money(materialLineTotal(calculationResult))}</strong></span>
                        <button className="primary-button" onClick={onAddCalculatedMaterial}>{editingMaterialIndex === null ? "Add Item" : "Update Item"}</button>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {builderStep === "product" && (
              <section className="builder-section product-step-section">
                <div className="material-input-heading">
                  <strong>Attach product</strong>
                  <small>Click a product to preview its image and details before using it.</small>
                </div>
                {draft.product && (
                  <div className="attached-product-card product-step-attached">
                    {draft.product.image ? <span className="attached-product-image" style={{ backgroundImage: `url("${draft.product.image}")` }} /> : <span className="record-monogram">{draft.product.name.slice(0, 2).toUpperCase()}</span>}
                    <span><strong>{draft.product.name}</strong><small>{draft.product.description || "Selected for this BOM"}</small></span>
                    <button className="text-button" onClick={() => setDraft({ ...draft, product: null })}>Unselect product</button>
                  </div>
                )}
                <div className="product-scroll-list">
                  {products.map((product) => {
                    const active = draft.product?.productId === product.productId || draft.product?.name === product.name;
                    return (
                      <button type="button" className={active ? "product-option selected" : "product-option"} key={product._id || product.productId} onClick={() => { setPreviewProduct(product); setPreviewZoomed(false); }}>
                        {product.image ? <span className="product-image has-image" style={{ backgroundImage: `url("${product.image}")` }} /> : <span className="record-monogram">{product.name.slice(0, 2).toUpperCase()}</span>}
                        <span><strong>{product.name}</strong><small>{product.category}{product.subCategory ? ` · ${product.subCategory}` : ""}</small></span>
                        <small className="product-option-action">{active ? "Selected" : "Preview"}</small>
                      </button>
                    );
                  })}
                </div>
                {!draft.product && (
                  <div className="product-create-card">
                    <div><span className="eyebrow">Create product</span><h3>New product for this BOM</h3></div>
                    <div className="form-grid">
                      <label>Product name<input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
                      <label>Category<input value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} /></label>
                      <label>Sub-category<input value={productForm.subCategory} onChange={(event) => setProductForm({ ...productForm, subCategory: event.target.value })} /></label>
                      <label>Product image<input type="file" accept="image/*" onChange={(event) => setProductForm({ ...productForm, image: event.target.files?.[0] || null })} /></label>
                      <label className="full">Description<textarea rows="3" value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
                    </div>
                    <div className="product-create-actions">
                      <button className="secondary-button create-product-button" disabled={busy} onClick={onCreateProduct}>{busy ? "Creating..." : "Create and attach product"}</button>
                    </div>
                  </div>
                )}
                {previewProduct && (
                  <div className="product-preview-backdrop" onMouseDown={() => setPreviewProduct(null)}>
                    <div className="product-preview-dialog" onMouseDown={(event) => event.stopPropagation()}>
                      <div className="panel-heading">
                        <div><span className="eyebrow">Product preview</span><h2>{previewProduct.name}</h2></div>
                        <button className="icon-button" onClick={() => setPreviewProduct(null)}>Close</button>
                      </div>
                      <button type="button" className={previewZoomed ? "product-preview-image zoomed" : "product-preview-image"} onClick={() => setPreviewZoomed(!previewZoomed)} style={previewProduct.image ? { backgroundImage: `url("${previewProduct.image}")` } : undefined}>
                        {!previewProduct.image && <span className="record-monogram">{previewProduct.name.slice(0, 2).toUpperCase()}</span>}
                      </button>
                      <small className="product-zoom-hint">{previewZoomed ? "Click image to zoom out" : "Click image to zoom in"}</small>
                      <div className="product-preview-details">
                        <span>Category<strong>{previewProduct.category || "Not set"}</strong></span>
                        <span>Sub-category<strong>{previewProduct.subCategory || "Not set"}</strong></span>
                        <span>Product code<strong>{previewProduct.productId || "New product"}</strong></span>
                        <span>Status<strong>{previewProduct.status || "Available"}</strong></span>
                      </div>
                      {previewProduct.description && <p>{previewProduct.description}</p>}
                      <button className="primary-button" onClick={() => { onSelectProduct(previewProduct); setPreviewProduct(null); }}>Use product</button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {builderStep === "summary" && (
              <section className="builder-section">
                <div className="material-input-heading">
                  <strong>BOM summary</strong>
                  <small>Review the attached product, material cost, overhead and margin before adding this BOM to the quotation page.</small>
                </div>
                <div className="bom-summary-grid">
                  {draft.product && (
                    <div className="attached-product-card summary-product-card">
                      {draft.product.image ? <span className="attached-product-image" style={{ backgroundImage: `url("${draft.product.image}")` }} /> : <span className="record-monogram">{draft.product.name.slice(0, 2).toUpperCase()}</span>}
                      <span><strong>{draft.product.name}</strong><small>{draft.product.description || "Attached product"}</small></span>
                      <button className="text-button" onClick={() => setBuilderStep("product")}>Change</button>
                    </div>
                  )}
                  <div className="summary-overhead-card">
                    <span className="eyebrow">Saved overhead</span>
                    <strong>{money(savedOverheadTotal)}</strong>
                    <small>{overheadCosts.length ? `${overheadCosts.length} company cost${overheadCosts.length === 1 ? "" : "s"} available` : "No overhead costs have been saved yet"}</small>
                    <button className="secondary-button" disabled={!savedOverheadTotal} onClick={() => onApplySavedOverhead()}>Use saved overhead</button>
                  </div>
                  <div className="pricing-summary summary-large">
                    <span>Material cost<strong>{money(pricing.materialsTotal)}</strong></span>
                    <span>Additional costs<strong>{money(pricing.additionalTotal)}</strong></span>
                    {draft.pricingMethod === "include_overhead" && <span>Manufacturing overhead<strong>{money(pricing.overheadCost)}</strong></span>}
                    <span>Cost price<strong>{money(pricing.costPrice)}</strong></span>
                    <span>Markup ({pricing.markupPercentage}%)<strong>{money(pricing.markupAmount)}</strong></span>
                    <span className="grand">Final selling price<strong>{money(pricing.sellingPrice)}</strong></span>
                  </div>
                </div>
              </section>
            )}

          </div>

          <aside className="builder-summary">
            <div className="sidebar-section-heading">
              <span className="eyebrow">Added materials</span>
              <strong>{draft.materials.length}</strong>
            </div>

            <div className="summary-lines">
              {draft.materials.map((material, index) => (
                <article className="added-material-card" key={`${material.materialId}-${index}`}>
                  <div className="added-material-head">
                    <span className="material-card-icon">{material.name.slice(0, 2).toUpperCase()}</span>
                    <span>
                      <strong>{material.name}</strong>
                      <small>{material.category} · {material.subCategory}</small>
                    </span>
                    <strong className="material-card-total">{money(materialLineTotal(material))}</strong>
                  </div>
                  <div className="added-material-details">
                    <span>Unit<strong>{material.unit}</strong></span>
                    {(material.size || material.color) && <span>Variant<strong>{[material.size, material.color].filter(Boolean).join(" / ")}</strong></span>}
                    {isAreaUnit(material) ? (
                      <>
                        <span>Project size<strong>{material.length} × {material.width} {material.dimensionUnit}</strong></span>
                        <span>Required area<strong>{numberValue(material.squareMeter).toFixed(2)} sqm</strong></span>
                        <span>Billable<strong>{numberValue(material.calculation?.billableUnits || material.calculation?.minimumUnits || 1).toFixed(2)}</strong></span>
                      </>
                    ) : <span>Price / unit<strong>{money(material.price)}</strong></span>}
                  </div>
                  <div className="material-card-footer">
                    <div className="material-quantity-control">
                      <button disabled={busy || material.quantity <= 1} onClick={() => onUpdateMaterialQuantity(index, material.quantity - 1)}>−</button>
                      <span><small>Quantity</small><strong>{material.quantity}</strong></span>
                      <button disabled={busy} onClick={() => onUpdateMaterialQuantity(index, material.quantity + 1)}>+</button>
                    </div>
                    <div className="bom-item-actions">
                      <button onClick={() => onEditMaterial(material, index)}>Edit</button>
                      <button className="danger" onClick={() => setDraft({ ...draft, materials: draft.materials.filter((_, itemIndex) => itemIndex !== index) })}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {draft.product && (
              <div className="attached-product-mini">
                {draft.product.image ? <span className="attached-product-image mini" style={{ backgroundImage: `url("${draft.product.image}")` }} /> : <span className="record-monogram">{draft.product.name.slice(0, 2).toUpperCase()}</span>}
                <span><small>Attached product</small><strong>{draft.product.name}</strong></span>
              </div>
            )}

            {builderStep === "summary" && (
              <>
                <section className="sidebar-other-section">
                  <div className="sidebar-section-heading">
                    <div><span className="eyebrow">Other</span><h3>Additional costs</h3></div>
                    <strong>{draft.additionalCosts.length}</strong>
                  </div>
                  <div className="sidebar-cost-form">
                    <label>Name<input value={additionalCost.name} onChange={(event) => setAdditionalCost({ ...additionalCost, name: event.target.value })} placeholder="Labour, delivery..." /></label>
                    <label>Amount<input type="number" min="0" value={additionalCost.amount} onChange={(event) => setAdditionalCost({ ...additionalCost, amount: event.target.value })} /></label>
                    <button className="secondary-button" onClick={onAddCost}>Add Other</button>
                  </div>
                  {draft.additionalCosts.length > 0 && (
                    <div className="other-cost-list">
                      {draft.additionalCosts.map((cost, index) => (
                        <div key={`${cost.name}-${index}`}>
                          <span>{cost.name}<small>{cost.description || "Additional cost"}</small></span>
                          <strong>{money(cost.amount)}</strong>
                          <button onClick={() => setDraft({ ...draft, additionalCosts: draft.additionalCosts.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="pricing-controls">
                  <label>Pricing method<select value={draft.pricingMethod} onChange={(event) => {
                    const nextMethod = event.target.value;
                    setDraft({
                      ...draft,
                      pricingMethod: nextMethod,
                      overheadCost: nextMethod === "include_overhead" && !numberValue(draft.overheadCost) && savedOverheadTotal ? String(savedOverheadTotal) : draft.overheadCost
                    });
                  }}><option value="direct_markup">Direct markup</option><option value="include_overhead">Include manufacturing overhead</option></select></label>
                  {draft.pricingMethod === "include_overhead" && (
                    <div className="overhead-picker">
                      <div className="overhead-picker-head">
                        <span>Manufacturing overhead</span>
                        <button type="button" disabled={!savedOverheadTotal} onClick={() => onApplySavedOverhead()}>Use all saved ({money(savedOverheadTotal)})</button>
                      </div>
                      {overheadCosts.length > 0 && (
                        <div className="overhead-chip-grid">
                          {overheadCosts.map((item) => (
                            <button type="button" key={item._id || `${item.description}-${item.cost}`} onClick={() => onApplySavedOverhead(numberValue(item.cost))}>
                              <span>{overheadLabel(item)}</span>
                              <strong>{money(item.cost)}</strong>
                            </button>
                          ))}
                        </div>
                      )}
                      <label>Manual overhead amount<input inputMode="decimal" value={formatThousandsInput(draft.overheadCost)} onChange={(event) => setDraft({ ...draft, overheadCost: formatThousandsInput(event.target.value) })} placeholder="0" /></label>
                    </div>
                  )}
                  <label>Markup %<input type="number" min="0" value={draft.markupPercentage} onChange={(event) => setDraft({ ...draft, markupPercentage: event.target.value })} /></label>
                  <div className="form-grid compact-form"><label>Duration<input type="number" min="0" value={draft.expectedDuration} onChange={(event) => setDraft({ ...draft, expectedDuration: event.target.value })} /></label><label>Period<select value={draft.expectedPeriod} onChange={(event) => setDraft({ ...draft, expectedPeriod: event.target.value })}>{["Hour", "Day", "Week", "Month"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
                  <label>Due date<input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>
                </div>
              </>
            )}

            <div className="pricing-summary">
              <span>Materials<strong>{money(pricing.materialsTotal)}</strong></span>
              <span>Additional costs<strong>{money(pricing.additionalTotal)}</strong></span>
              {draft.pricingMethod === "include_overhead" && <span>Manufacturing overhead<strong>{money(pricing.overheadCost)}</strong></span>}
              <span>Cost price<strong>{money(pricing.costPrice)}</strong></span>
              <span>Markup ({pricing.markupPercentage}%)<strong>{money(pricing.markupAmount)}</strong></span>
              <span className="grand">Selling price<strong>{money(pricing.sellingPrice)}</strong></span>
            </div>
            {builderStep === "materials" && <button className="primary-button save-bom-button" disabled={busy} onClick={onContinueMaterials}>Continue</button>}
            {builderStep === "product" && <button className="primary-button save-bom-button" disabled={busy} onClick={onContinueProduct}>Continue to summary</button>}
            {builderStep === "summary" && <button className="primary-button save-bom-button" disabled={busy} onClick={onSave}>Add BOM to quotation page</button>}
          </aside>
        </div>
      </section>
    </div>
  );
}

function QuotationClientModal({ busy, client, clients, items, setClient, totals, onClose, onSubmit }) {
  const finalTotal = totals.selling - (totals.selling * numberValue(client.discount)) / 100;
  const selectClient = (value) => {
    const found = clients.find((item) => item.clientName === value);
    setClient(found ? { ...client, ...found } : { ...client, clientName: value });
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card quotation-client-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading"><div><span className="eyebrow">Client quotation</span><h2>Review and send {items.length} BOM{items.length === 1 ? "" : "s"}</h2></div><button className="icon-button" onClick={onClose}>Close</button></div>
        <div className="quotation-review">
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
            <label>Existing client<select value={clients.some((item) => item.clientName === client.clientName) ? client.clientName : ""} onChange={(event) => selectClient(event.target.value)}><option value="">Enter a new client</option>{clients.map((item) => <option key={`${item.clientName}-${item.phoneNumber || item.email}`} value={item.clientName}>{item.clientName}</option>)}</select></label>
            <label>Client name<input required value={client.clientName} onChange={(event) => setClient({ ...client, clientName: event.target.value })} /></label>
            <label>Email<input type="email" value={client.email || ""} onChange={(event) => setClient({ ...client, email: event.target.value })} /></label>
            <label>Phone<input value={client.phoneNumber || ""} onChange={(event) => setClient({ ...client, phoneNumber: event.target.value })} /></label>
            <label>Address<input value={client.clientAddress || ""} onChange={(event) => setClient({ ...client, clientAddress: event.target.value })} /></label>
            <label>Nearest bus stop<input value={client.nearestBusStop || ""} onChange={(event) => setClient({ ...client, nearestBusStop: event.target.value })} /></label>
            <label className="full">Description<textarea rows="3" value={client.description} onChange={(event) => setClient({ ...client, description: event.target.value })} /></label>
            <label>Discount %<input type="number" min="0" max="100" value={client.discount} onChange={(event) => setClient({ ...client, discount: event.target.value })} /></label>
            <label>Due date<input type="date" value={client.dueDate} onChange={(event) => setClient({ ...client, dueDate: event.target.value })} /></label>
            <div className="form-actions full"><button type="button" className="text-button" onClick={onClose}>Back</button><button className="primary-button" disabled={busy}>{busy ? "Creating quotation..." : `Create quotation · ${money(finalTotal)}`}</button></div>
          </form>
          <aside className="quotation-review-list">
            {items.map((item) => <div key={item.bom._id}><span><strong>{item.bom.product?.name || item.bom.name}</strong><small>{item.quantity} × {money(item.bom.pricing?.sellingPrice || item.bom.totalCost)}</small></span><strong>{money(numberValue(item.bom.pricing?.sellingPrice || item.bom.totalCost) * item.quantity)}</strong></div>)}
            <div className="quotation-grand"><span>Quotation total</span><strong>{money(finalTotal)}</strong></div>
          </aside>
        </div>
      </section>
    </div>
  );
}
