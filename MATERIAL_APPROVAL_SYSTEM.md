# Material Approval System - Implementation Summary

## ✅ Completed

### 1. Material Model Updates
**File:** `Models/MaterialModel.js`

**Added Fields:**
- `isGlobal` - Boolean (global materials visible to all companies)
- `status` - enum: pending, approved, rejected
- `approvedBy`, `approvedAt`, `rejectionReason`
- `submittedBy`, `submittedAt`, `resubmissionCount`
- `approvalHistory` - Array of approval events

**Indexes Added:**
- `{ isGlobal: 1, status: 1 }`
- `{ status: 1, createdAt: -1 }`
- `{ submittedBy: 1 }`

---

### 2. Create Material Function Updated
**File:** `Src/Quotation/product.js` - `createMaterial()`

**Changes:**
- Platform owners can create global materials (isGlobal: true)
- Global materials: auto-approved, companyName: 'GLOBAL'
- Company materials: status: 'pending', requires approval
- Notifies platform owners when company submits material
- Notifies all company owners when global material added

---

### 3. Platform Owner Endpoints Added
**File:** `Src/Platform/platformController.js`

**New Functions:**
1. `getPendingMaterials()` - GET /api/platform/materials/pending
2. `approveMaterial()` - PATCH /api/platform/materials/:materialId/approve
3. `rejectMaterial()` - PATCH /api/platform/materials/:materialId/reject

**Features:**
- Email notifications on approval/rejection
- In-app notifications
- Approval history tracking

---

### 4. Routes Added
**File:** `Routes/platformRoutes.js`

```javascript
router.get('/materials/pending', platformController.getPendingMaterials);
router.patch('/materials/:materialId/approve', platformController.approveMaterial);
router.patch('/materials/:materialId/reject', platformController.rejectMaterial);
```

---

### 5. Notification Types Added
**File:** `Models/notificationsModel.js`

**New Types:**
- `material_submitted_for_approval`
- `material_approved`
- `material_rejected`
- `material_resubmitted`
- `global_material_added`

---

### 6. Migration Script
**File:** `Scripts/migrateMaterialApproval.js`

**Result:** ✅ 7 existing materials auto-approved

---

## 📋 How It Works

### For Platform Owners:
1. **Create Global Material**: POST to material endpoint with `isGlobal: true`
   - Instantly approved
   - Visible to ALL companies
   - All company owners notified

2. **View Pending Materials**: GET /api/platform/materials/pending
   - Filter by company, category
   - Pagination support

3. **Approve Material**: PATCH /api/platform/materials/:id/approve
   - Email sent to submitter
   - Material visible in company
   - Notification created

4. **Reject Material**: PATCH /api/platform/materials/:id/reject
   - Requires rejection reason
   - Email sent with reason
   - Company can resubmit

### For Company Users:
1. **Create Material**: POST /api/product/creatematerial
   - Status: pending
   - Platform owners notified
   - Not visible until approved

2. **View Materials**: GET /api/product/materials
   - Shows approved company materials
   - Shows approved global materials
   - Owners/admins see all company materials

---

## 🧪 Testing

### Test Platform Owner Creating Global Material:
```bash
POST /api/product/creatematerial
Authorization: Bearer <platform_owner_token>
Body: {
  "name": "Premium Mahogany",
  "category": "WOOD",
  "isGlobal": true,
  "standardWidth": 48,
  "standardLength": 96,
  "standardUnit": "inches",
  "pricePerSqm": 150
}
```

Expected: Status: approved, companyName: GLOBAL

### Test Company Creating Material:
```bash
POST /api/product/creatematerial
Authorization: Bearer <company_user_token>
Body: {
  "name": "Custom Oak",
  "category": "WOOD",
  "standardWidth": 48,
  "standardLength": 96,
  "standardUnit": "inches",
  "pricePerSqm": 120
}
```

Expected: Status: pending, platform owners notified

### Test Viewing Pending Materials:
```bash
GET /api/platform/materials/pending
Authorization: Bearer <platform_owner_token>
```

### Test Approving Material:
```bash
PATCH /api/platform/materials/:id/approve
Authorization: Bearer <platform_owner_token>
Body: {
  "notes": "Good quality material"
}
```

### Test Rejecting Material:
```bash
PATCH /api/platform/materials/:id/reject
Authorization: Bearer <platform_owner_token>
Body: {
  "reason": "Incomplete pricing information"
}
```

---

## 📊 Current Status

- ✅ Material model updated
- ✅ Create material function updated
- ✅ Platform owner endpoints added
- ✅ Routes registered
- ✅ Notification types added
- ✅ Migration script run (7 materials approved)
- ✅ Server syntax validated

---

## 🔄 Material Flow

```
Company User Creates Material
         ↓
    Status: pending
         ↓
Platform Owners Notified
         ↓
Platform Owner Reviews
         ↓
    ┌────────┴────────┐
    ↓                 ↓
Approve           Reject
    ↓                 ↓
Status: approved  Status: rejected
    ↓                 ↓
Company notified  Company notified
    ↓                 ↓
Material visible  Can resubmit
```

---

## 🎯 Same as Products

Material approval system now works **exactly like product approval**:
- Global materials by platform owners
- Company materials require approval
- Email + in-app notifications
- Approval history tracking
- Resubmission support

✅ **Implementation Complete**
