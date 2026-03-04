# Materials API (Catalog-Aligned) – Integration Guide

This document covers **all material API changes** implemented to align with the Excel catalog (`materials_all.csv`) and support image upload.

Base URL in this project:
- `http://<host>/api`

Auth:
- All endpoints below require `Authorization: Bearer <JWT>`

Caching:
- These endpoints return `ETag` and support `If-None-Match`.
- If client sends `If-None-Match: <etag>` and data hasn’t changed, server responds `304 Not Modified` (no body).
- Recommended client behavior: cache the last response + ETag locally and revalidate occasionally (or on screen focus).

---

## 1) Get Company + Global Materials

### `GET /api/product/materials`

Returns approved company materials + approved global materials.

### Material fields returned
Each material is returned with all stored DB fields **plus** computed fields:
- `unitPrice`: computed as `pricePerUnit || catalogPrice` (number or `null`)
- `isPriced`: `true` if `(unitPrice > 0) || (pricePerSqm > 0)`, else `false`
- `thickness` / `thicknessUnit`: explicit thickness fields (see Notes for derivation)
- `dimensionRule`: normalized UI rule object for project-size inputs (length/width/thickness visibility, requirements, defaults)

### Category dimension rules (new)
The response now includes a top-level `dimensionRulesByCategory` array.
Use this when user selects a category so UI knows:
- which project-size fields to show
- which are required before cost calculation
- what default unit to prefill
- common size patterns in that category

### Query params
- `category` (string, optional, case-insensitive exact match)
- `subCategory` (string, optional, case-insensitive exact match)
- `isActive` (boolean-like, optional, default `true`)
- `search` (string, optional; searches `name`, `category`, `subCategory`, `color`)
- `priced` (boolean-like, optional)
  - `true` → only priced materials
  - `false` → only unpriced materials

### Success response (200)
```json
{
  "success": true,
  "count": 2,
  "dimensionRulesByCategory": [
    {
      "category": "Wood",
      "count": 2,
      "schema": "thickness_width_length",
      "projectInput": {
        "showLength": true,
        "showWidth": true,
        "showThickness": true,
        "requireLength": true,
        "requireWidth": true,
        "requireThickness": true,
        "defaultUnit": "inches"
      },
      "dominantSizePattern": "triple",
      "sizePatternCounts": {
        "triple": 2,
        "double": 0,
        "single": 0,
        "empty": 0,
        "descriptor": 0
      },
      "sampleSizes": ["1\"x10\"x144\""],
      "units": ["Piece", "inches"],
      "note": "Wood size is usually expressed as thickness x width x length."
    }
  ],
  "data": [
    {
      "_id": "67a7...",
      "name": "Handle_pipe_6\"_Piece_Gold",
      "category": "Handle",
      "subCategory": "pipe",
      "size": "6\"",
      "unit": "Piece",
      "color": "Gold",
      "thickness": null,
      "thicknessUnit": "inches",
      "catalogKey": "handle_pipe_6\"_piece_gold|handle|pipe|6\"|piece|gold",
      "catalogPrice": 450,
      "isCatalogMaterial": true,
      "isCatalogPriced": true,
      "unitPrice": 450,
      "isPriced": true,
      "dimensionRule": {
        "schema": "quantity_only",
        "sizePattern": "single",
        "projectInput": {
          "showLength": false,
          "showWidth": false,
          "showThickness": false,
          "requireLength": false,
          "requireWidth": false,
          "requireThickness": false,
          "defaultUnit": "inches"
        },
        "stockDimensions": {
          "thickness": null,
          "width": null,
          "length": null,
          "unit": "inches"
        },
        "sourceSize": "6\"",
        "note": "This material is typically quantity-based unless your UI enables manual dimensions."
      },
      "pricePerUnit": 450,
      "pricingUnit": "piece",
      "image": "https://...",
      "companyName": "GLOBAL",
      "status": "approved",
      "isGlobal": true,
      "isActive": true
    }
  ]
}
```

---

## 1b) Get Materials Grouped (Category → SubCategory → Variants)

### `GET /api/product/materials/grouped`

Use this when you want UI-friendly grouping (e.g., `Board` then `Foreign Plywood`, then variant rows like `0.25"` / `Piece`).

### Grouped variant fields returned
Each `variant` includes:
- `type` (same as `subCategory`)
- `size`, `unit`, `color`
- `thickness`, `thicknessUnit`
- `unitPrice`, `isPriced`
- `dimensionRule` (same shape as `/api/product/materials`)
- plus `pricePerUnit`, `pricePerSqm`, `catalogPrice`, `pricingUnit`, `isCatalogMaterial`, `image`, `status`, `isGlobal`

### Query params
- Same as `/api/product/materials` (`category`, `subCategory`, `isActive`, `search`, `priced`)

### Success response (200)
```json
{
  "success": true,
  "count": 304,
  "categoryCount": 25,
  "data": [
    {
      "category": "Board",
      "total": 26,
      "priced": 8,
      "unpriced": 18,
      "subCategories": [
        {
          "subCategory": "Foreign Plywood",
          "total": 3,
          "priced": 3,
          "unpriced": 0,
          "variants": [
            {
              "id": "6989...",
              "name": "Board_Foreign Plywood_0.25\"_Piece",
              "size": "0.25\"",
              "unit": "Piece",
              "color": "",
              "thickness": 0.25,
              "thicknessUnit": "inches",
              "pricingUnit": "piece",
              "unitPrice": 10000,
              "pricePerUnit": 10000,
              "pricePerSqm": null,
              "catalogPrice": 10000,
              "isPriced": true,
              "isCatalogMaterial": true,
              "image": null,
              "status": "approved",
              "isGlobal": true
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 1c) Mobile App Integration (Project Size Prefill)

Use `GET /api/product/materials` as the source for both material options and project-size behavior.

### Recommended flow
1. Load materials once for the screen (`/api/product/materials`).
2. When category changes (e.g. `Wood`), read matching rule from `dimensionRulesByCategory`.
3. Show/hide project-size inputs using:
   - `projectInput.showLength`
   - `projectInput.showWidth`
   - `projectInput.showThickness`
4. Mark required fields using:
   - `projectInput.requireLength`
   - `projectInput.requireWidth`
   - `projectInput.requireThickness`
5. Prefill unit selector from `projectInput.defaultUnit`.
6. When a specific material variant is selected, apply `material.dimensionRule.stockDimensions` to prefill values:
   - Wood from `1"x10"x144"` -> thickness `1`, width `10`, length `144`, unit `inches`
   - Board from `0.5"` -> thickness `0.5` only

### UI behavior notes
- If schema is `quantity_only`, hide project-size inputs and collect quantity/unit.
- If schema is `sheet_with_thickness`, show Length + Width + Thickness.
- If schema is `length_width_area`, show Length + Width only (thickness optional/hidden).
- Always keep manual override enabled for users when data is incomplete.

---

## 2) Get Supported Materials (Exact Excel Catalog)

### `GET /api/product/materials/supported`

Returns the exact supported catalog rows from `materials_all.csv` so clients can drive dropdowns/forms.

### Query params
- `category` (optional)
- `subCategory` (optional)
- `search` (optional)
- `priced` (optional boolean-like)
- `page` (optional, default `1`)
- `limit` (optional, default `100`, max `500`)

### Success response (200)
```json
{
  "success": true,
  "message": "Supported materials fetched successfully",
  "count": 2,
  "total": 304,
  "page": 1,
  "totalPages": 152,
  "data": [
    {
      "id": 1,
      "key": "handle_knob_piece|handle|knob|||piece|",
      "material": "Handle_knob_Piece",
      "category": "Handle",
      "subCategory": "knob",
      "size": "",
      "unit": "Piece",
      "color": "",
      "thickness": null,
      "thicknessUnit": "inches",
      "priceRaw": "",
      "priceNumeric": null,
      "isPriced": false
    }
  ]
}
```

---

## 3) Get Supported Materials Summary (Category/Subcategory)

### `GET /api/product/materials/supported/summary`

Use this endpoint for quick category/subcategory metadata and priced/unpriced counts.

### Success response (200)
```json
{
  "success": true,
  "message": "Supported material summary fetched successfully",
  "totals": {
    "total": 304,
    "priced": 85,
    "unpriced": 219
  },
  "categories": [
    {
      "category": "Board",
      "total": 26,
      "priced": 8,
      "unpriced": 18,
      "subCategories": [
        "Back cover",
        "Foreign Plywood",
        "Hdf gloss"
      ]
    }
  ]
}
```

---

## 4) Create Material (Catalog-Validated + Image Upload)

### `POST /api/product/creatematerial`

Content type:
- `multipart/form-data` (for image upload)
- file field name must be `image`

### Behavior
- By default (`useCatalog=true`) API validates input against supported catalog.
- If match is exact, category/subCategory/size/unit/color are auto-aligned to catalog.
- Thickness rules:
  - For `Board` and `Wood`, `thickness` is required.
  - If the catalog row contains thickness-like `size` (e.g. `0.25"` for Board, or `1"x10"x144"` for Wood), thickness is auto-derived.
  - If it cannot be derived, client must pass `thickness` and optionally `thicknessUnit`.
- Saves catalog metadata (`catalogKey`, `catalogPrice`, `isCatalogMaterial`, `isCatalogPriced`).
- Non-platform user → created as `pending`.
- Platform owner (default) can create global approved material.

### Request fields
- `catalogMaterial` (string, preferred material name from supported list)
- `name` (string, fallback if not using `catalogMaterial`)
- `category` (string, optional if catalog resolves it)
- `subCategory` (string, optional but required when ambiguous)
- `size` (string, optional but required when ambiguous)
- `unit` (string, optional but required when ambiguous)
- `color` (string, optional but required when ambiguous)
- `thickness` (number, required for `Board` and `Wood` materials; optional for others)
- `thicknessUnit` (string, optional, default `inches`; allowed: `mm`, `cm`, `m`, `inches`, `ft`)
- `useCatalog` (boolean-like, optional, default `true`)
- `pricePerUnit` (number, optional override)
- `pricePerSqm` (number, optional for sqm-based materials)
- `pricingUnit` (string, optional; default inferred from unit)
- `standardWidth`, `standardLength`, `standardUnit` (optional; for sheet/sqm calculations)
- `types`, `sizeVariants`, `foamVariants`, `commonThicknesses` (JSON array string or array)
- `wasteThreshold` (number, optional, default `0.75`)
- `notes` (string, optional)
- `isGlobal` (platform owner only, optional)
- `image` (file, optional)

### Example request (multipart)
- text:
  - `catalogMaterial=Handle_pipe_6"_Piece_Gold`
  - `category=Handle`
  - `subCategory=pipe`
  - `size=6"`
  - `unit=Piece`
  - `color=Gold`
- file:
  - `image=<binary>`

### Success response (201)
```json
{
  "success": true,
  "data": {
    "_id": "67a8...",
    "name": "Handle_pipe_6\"_Piece_Gold",
    "category": "Handle",
    "subCategory": "pipe",
    "size": "6\"",
    "unit": "Piece",
    "color": "Gold",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogPrice": 450,
    "isCatalogMaterial": true,
    "isCatalogPriced": true,
    "unitPrice": 450,
    "isPriced": true,
    "pricePerUnit": 450,
    "pricingUnit": "piece",
    "image": "https://...",
    "status": "pending"
  }
}
```

### Common validation errors

#### Missing material name (400)
```json
{
  "success": false,
  "message": "Material name is required"
}
```

#### Ambiguous catalog match (400)
```json
{
  "success": false,
  "message": "Multiple supported variants found. Please include category/subCategory/size/unit/color.",
  "options": [
    {
      "material": "Edge_tape_matte_Yard_Offwhite",
      "category": "Edge_tape",
      "subCategory": "matte",
      "size": "",
      "unit": "Yard",
      "color": "Offwhite"
    }
  ]
}
```

#### Not in supported catalog (400)
```json
{
  "success": false,
  "message": "Material must match supported catalog entries from the uploaded Excel sheet."
}
```

#### Missing thickness for Board/Wood (400)
```json
{
  "success": false,
  "message": "Thickness is required for Board/Wood materials. Provide thickness (e.g. 0.25) and thicknessUnit (e.g. inches)."
}
```

---

## 5) Calculate Material Cost (Unit-Based + Sheet-Based)

### `POST /api/product/material/:materialId/calculate-cost`

### Modes

1. **Unit-based mode** (no dimensions sent):
   - Uses `quantity` × `pricePerUnit` (or `catalogPrice` fallback)
2. **Sheet/area mode** (dimensions sent):
   - Uses width/length/unit + sheet dimensions + waste logic for sqm pricing

### Request body (unit-based)
```json
{
  "quantity": 4
}
```

### Unit-based success (200)
```json
{
  "success": true,
  "data": {
    "material": {
      "id": "67a8...",
      "name": "Handle_pipe_6\"_Piece_Gold",
      "category": "Handle",
      "subCategory": "pipe",
      "unit": "Piece"
    },
    "calculation": {
      "mode": "unit_based",
      "quantity": 4
    },
    "pricing": {
      "pricePerUnit": "450.00",
      "totalMaterialCost": "1800.00"
    }
  }
}
```

### Request body (sheet/area mode)
```json
{
  "requiredWidth": 96,
  "requiredLength": 120,
  "requiredUnit": "inches",
  "quantity": 1
}
```

### Sheet/area success (200)
```json
{
  "success": true,
  "data": {
    "material": {
      "id": "67a8...",
      "name": "Board_Foreign Plywood_0.5\"_Piece",
      "category": "Board",
      "type": null,
      "variant": null
    },
    "project": {
      "requiredWidth": 96,
      "requiredLength": 120,
      "requiredUnit": "inches",
      "projectAreaSqm": "7.4322"
    },
    "standard": {
      "standardWidth": 48,
      "standardLength": 96,
      "standardUnit": "inches",
      "standardAreaSqm": "2.9735"
    },
    "calculation": {
      "minimumUnits": 3,
      "wasteThreshold": 0.75,
      "rawRemainder": "1.4852",
      "wasteThresholdArea": "2.2301",
      "extraUnitAdded": false
    },
    "pricing": {
      "pricePerSqm": "6725.00",
      "pricePerFullUnit": "20000.00",
      "totalMaterialCost": "60000.00"
    },
    "waste": {
      "totalAreaUsed": "8.9207",
      "wasteArea": "1.4885",
      "wastePercentage": "16.69"
    }
  }
}
```

### Common errors
- `400` quantity invalid:
```json
{ "success": false, "message": "Quantity must be a positive number" }
```
- `404` material not found:
```json
{ "success": false, "message": "Material not found" }
```

### Unpriced materials behavior
If a material has no price (`pricePerUnit`/`catalogPrice`/`pricePerSqm` missing), the API returns **200** with:
- `pricing.pricePerUnit: "0.00"`
- `pricing.totalMaterialCost: "0.00"`
- `calculation.needsPricing: true`

---

## 6) Platform One-Shot Reseed (Delete All + Import All Catalog Rows)

### `POST /api/platform/materials/reseed-from-catalog`

Access:
- Platform owner only

### Warning
- This endpoint **deletes all existing materials** (`Material.deleteMany({})`) before inserting catalog rows.

### Request body
```json
{
  "confirm": true
}
```

### Success response (200)
```json
{
  "success": true,
  "message": "Materials reseeded successfully from catalog",
  "data": {
    "deletedMaterials": 120,
    "insertedMaterials": 304,
    "pricedMaterials": 85,
    "unpricedMaterials": 219
  }
}
```

### Safety validation error (400)
```json
{
  "success": false,
  "message": "This action deletes all existing materials. Set confirm=true to proceed."
}
```

---

## 6b) User-Submitted Materials (Pending Approval) – Mobile Integration

This section documents the workflow where **company users submit materials** and **platform owners approve/reject** them.

### Key rule (Excel-aligned)
By default, material submission is **strictly validated against the Excel catalog** (`materials_all.csv`) using:
- `material(name)` + `category` + `subCategory(type)` + `size` + `unit` + `color`

If the selected material variant is not in the catalog, the API rejects it.

---

### A) Company user: Submit Material (Pending)

#### `POST /api/product/creatematerial`

Content type:
- `multipart/form-data`
- image field name: `image` (optional)

Behavior:
- For non-platform users, material is created as:
  - `status: "pending"`
  - `isGlobal: false`
  - `companyName: <user company>`
- It will not appear in normal lists until approved (because list endpoints filter by `status: "approved"`).

Required fields (recommended from supported catalog):
- `catalogMaterial` (string)
- plus enough of: `category`, `subCategory`, `size`, `unit`, `color` to uniquely match the catalog row

Thickness rule:
- For `Board` and `Wood`, thickness must be present (derived from catalog `size` when possible, else pass `thickness` + `thicknessUnit`).

Success response (201) – pending
```json
{
  "success": true,
  "data": {
    "_id": "....",
    "name": "Angle_bracket_Iron_Pack",
    "category": "Angle_bracket",
    "subCategory": "Iron",
    "size": "",
    "unit": "Pack",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "...",
    "catalogPrice": 2500,
    "unitPrice": 2500,
    "isPriced": true,
    "isCatalogMaterial": true,
    "isCatalogPriced": true,
    "status": "pending",
    "isGlobal": false
  }
}
```

Common rejection (400) – not in catalog
```json
{
  "success": false,
  "message": "Material must match supported catalog entries from the uploaded Excel sheet."
}
```

Common rejection (400) – ambiguous variant (send more fields)
```json
{
  "success": false,
  "message": "Multiple supported variants found. Please include category/subCategory/size/unit/color.",
  "options": [ ... ]
}
```

Mobile UI instructions (company user):
1. Use `GET /api/product/materials/supported/summary` to populate category/subCategory selectors.
2. Use `GET /api/product/materials/supported` to let user pick the exact variant row.
3. Submit with `POST /api/product/creatematerial` (+ optional `image`).
4. Show “Pending approval” state from `status: "pending"`.

---

### B) Platform owner: View Pending Materials

#### `GET /api/platform/materials/pending`

Query params (optional):
- `page` (default `1`)
- `limit` (default `20`)
- `companyName`
- `category` (case-insensitive exact match)

Success response (200)
```json
{
  "success": true,
  "data": [ { "_id": "...", "name": "...", "category": "...", "status": "pending" } ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 }
}
```

Mobile UI instructions (platform owner):
1. Create a “Pending Materials” screen that calls this endpoint.
2. Show key fields: `name`, `category`, `subCategory`, `size`, `unit`, `color`, `unitPrice/isPriced`, `submittedBy`, `companyName`, `image`.

---

### C) Platform owner: Approve Material

#### `PATCH /api/platform/materials/:materialId/approve`

Request body (optional):
```json
{ "notes": "Approved" }
```

Success response (200)
```json
{ "success": true, "message": "Material approved successfully", "data": { "status": "approved" } }
```

After approval:
- Company users will now see it in `GET /api/product/materials` and `GET /api/product/materials/grouped`.

---

### D) Platform owner: Reject Material

#### `PATCH /api/platform/materials/:materialId/reject`

Request body:
```json
{ "reason": "Incorrect variant / pricing" }
```

Success response (200)
```json
{ "success": true, "message": "Material rejected successfully", "data": { "status": "rejected" } }
```

Mobile UI instructions (platform owner):
- Require a rejection reason input.

---

## 7) Integration Flow Recommendation (Mobile/App)

1. Call `GET /api/product/materials/supported/summary` to build category/subcategory pickers.
2. Call `GET /api/product/materials/supported` with filters to choose exact material variant.
3. Create material with `POST /api/product/creatematerial` using selected catalog row + optional image.
4. For costing:
   - use unit mode for piece/pack/pair/set/yard items
   - use sheet mode only when dimensions + sqm pricing are available
5. Use `GET /api/product/materials` for actual approved materials visible to user/company.

---

## 8) Notes

- Catalog source is `materials_all.csv` in project root.
- Categories are now treated as flexible strings (not fixed enum), matching Excel values.
- Excel mapping:
  - `0.25` / `0.5` / `6"` etc. come from the **Size** column.
  - `Piece`, `Pair`, `Pack`, `Yard`, etc. come from the **Unit** column.
- Thickness derivation (catalog + reseed):
  - `Board`: thickness derived from `size` when it looks like a thickness (e.g. `0.25"`, `5/8"`, `1"`).
  - `Wood`: thickness derived from the first component in `size` when it looks like `1"x10"x144"` → thickness `1`.
- Old endpoints still exist; above are the changed/new material APIs for this rollout.

---

## 9) Admin: Update Pricing by Type (Category → Type)

Some catalog groups are organized as:
`Category (e.g. Board)` → `Type (subCategory, e.g. Foreign Plywood)` → `Variants (size/unit/color/thickness…)`.

To update pricing for a whole Type at once (instead of editing each variant), use the Database API:

### `PUT /api/database/materials/pricing/type`

Access:
- Company `owner/admin`
- Platform owner (can pass `companyName` OR `materialId` to auto-resolve company)

Query params (platform owner only, optional):
- `companyName` (string)

Request body:
- `materialId` (string, optional for platform owner; if provided, API auto-resolves `companyName`, and can infer `category`/`subCategory`/`unit`)
- `category` (string, required if not inferring from `materialId`)
- `subCategory` (string, required if not inferring from `materialId`)
- `unit` (string, optional; limits which variants to update)
- `pricePerUnit` (number, optional)
- `pricePerSqm` (number, optional)
- `pricingUnit` (string, optional; e.g. `piece`, `sqm`)
- `onlyUnpriced` (boolean-like, optional, default `false`)
  - `true` updates only materials that have no price yet (no `pricePerUnit`, no `pricePerSqm`, and no `catalogPrice`).

Example (platform owner, auto-resolve from selected material):
```bash
curl -s -X PUT "https://ww-backend.vercel.app/api/database/materials/pricing/type" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "materialId": "6989abcd1234ef567890abcd",
    "pricePerUnit": 20000,
    "pricingUnit": "piece",
    "onlyUnpriced": false
  }'
```
