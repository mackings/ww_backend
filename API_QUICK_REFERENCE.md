# Platform Owner Dashboard - API Quick Reference

## Authentication
All endpoints require Bearer token authentication.

```bash
Authorization: Bearer <your-jwt-token>
```

Get token from: `POST /api/auth/signin`

---

## Platform Owner Endpoints

### 1. Dashboard Statistics
```http
GET /api/platform/dashboard/stats
```

**Response:**
- Companies: total, active, inactive
- Products: total, pending, global, company products
- Orders, Quotations, Users count
- Recent pending products (last 5)
- Recent companies (last 5)

---

### 2. List All Companies
```http
GET /api/platform/companies?page=1&limit=20&search=wood&isActive=true
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `search` (string, optional) - Search by name/email
- `isActive` (boolean, optional) - Filter active/inactive

**Response:** Paginated list with company stats (products, orders, quotations, users)

---

### 3. Company Usage Details
```http
GET /api/platform/companies/:companyId/usage
```

**Response:**
- Company details
- Product breakdown (pending, approved, rejected)
- Order count
- Quotation count
- User count
- Revenue data (total revenue, total paid)
- Recent orders (last 10)

---

### 4. Pending Products
```http
GET /api/platform/products/pending?page=1&limit=20&companyName=WoodCraft&category=Furniture
```

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `companyName` (string, optional) - Filter by company
- `category` (string, optional) - Filter by category

**Response:** Paginated list of products awaiting approval

---

### 5. Approve Product
```http
PATCH /api/platform/products/:productId/approve
Content-Type: application/json

{
  "notes": "Great product! Approved for platform."
}
```

**Effects:**
- Product status → 'approved'
- Sends email to submitter
- Creates in-app notification
- Product visible to company users

---

### 6. Reject Product
```http
PATCH /api/platform/products/:productId/reject
Content-Type: application/json

{
  "reason": "Description incomplete. Add more details."
}
```

**Required:** `reason` field is mandatory

**Effects:**
- Product status → 'rejected'
- Sends email with reason
- Creates in-app notification
- Company can resubmit after editing

---

### 7. Create Global Product
```http
POST /api/platform/products/global
Content-Type: multipart/form-data

Form Data:
- name: "Premium Mahogany Wood Plank"
- category: "Raw Materials"
- subCategory: "Hardwood"
- description: "High-quality mahogany..."
- isGlobal: true
- image: [file]
```

**Effects:**
- Instantly approved
- Visible to ALL companies
- Notifies all company owners

---

## Product Status Flow

```
Company Creates Product
        ↓
    [pending]
        ↓
   Platform Owner Reviews
        ↓
    ┌───────────┐
    ↓           ↓
[approved]  [rejected]
    ↓           ↓
 Visible    Company can
           edit & resubmit
                ↓
           [pending]
```

---

## Data Structures

### Product Object
```json
{
  "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
  "name": "Modern Oak Dining Table",
  "productId": "PRD-A1B2C3",
  "category": "Furniture",
  "subCategory": "Dining Tables",
  "companyName": "WoodCraft Co.",
  "status": "pending",
  "isGlobal": false,
  "submittedBy": {
    "_id": "507f...",
    "fullname": "John Smith",
    "email": "john@example.com"
  },
  "approvalHistory": [
    {
      "action": "submitted",
      "performedByName": "John Smith",
      "timestamp": "2024-01-15T14:30:00.000Z"
    }
  ]
}
```

### Company Stats Object
```json
{
  "_id": "65a1b2c3...",
  "name": "WoodCraft Co.",
  "email": "info@woodcraft.com",
  "isActive": true,
  "owner": { ... },
  "stats": {
    "products": 85,
    "orders": 142,
    "quotations": 230,
    "users": 8
  }
}
```

---

## Common Errors

| Status | Message | Cause |
|--------|---------|-------|
| 401 | Not authorized to access this route | Missing/invalid token |
| 403 | Access denied: Platform Owner role required | User is not platform owner |
| 404 | Resource not found | Company/Product doesn't exist |
| 400 | Product is already approved/rejected | Invalid state transition |
| 400 | Rejection reason is required | Missing required field |

---

## Testing with cURL

### 1. Login & Get Token
```bash
curl -X POST https://your-api.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "platformowner@example.com",
    "password": "your_password"
  }'
```

### 2. Get Dashboard Stats
```bash
curl -X GET https://your-api.com/api/platform/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Get Pending Products
```bash
curl -X GET "https://your-api.com/api/platform/products/pending?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Approve Product
```bash
curl -X PATCH https://your-api.com/api/platform/products/PRODUCT_ID/approve \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Approved! Great product."
  }'
```

### 5. Reject Product
```bash
curl -X PATCH https://your-api.com/api/platform/products/PRODUCT_ID/reject \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Please add more details about dimensions."
  }'
```

### 6. Create Global Product
```bash
curl -X POST https://your-api.com/api/platform/products/global \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "name=Premium Mahogany Plank" \
  -F "category=Raw Materials" \
  -F "subCategory=Hardwood" \
  -F "description=High-quality mahogany" \
  -F "isGlobal=true" \
  -F "image=@/path/to/image.jpg"
```

---

## Best Practices

1. **Always check dashboard stats first** to see pending count
2. **Include approval notes** when approving (optional but recommended)
3. **Always provide clear rejection reasons** (required)
4. **Use pagination** for large result sets
5. **Filter pending products by company** for focused review
6. **Monitor company usage regularly** for insights
7. **Create global products sparingly** - they appear for everyone

---

## Notification Flow

### Product Submitted
- **Platform Owners receive:** In-app notification + system alert
- **Company members receive:** In-app notification

### Product Approved
- **Submitter receives:** Email + in-app notification
- **Company members receive:** In-app notification

### Product Rejected
- **Submitter receives:** Email with reason + in-app notification
- **Company members receive:** In-app notification

### Global Product Created
- **All company owners receive:** In-app notification
- **Product appears:** In all company product lists

---

## Support

- **Full Documentation:** [API_DOCUMENTATION_PLATFORM_OWNER.json](./API_DOCUMENTATION_PLATFORM_OWNER.json)
- **Backend Team:** Contact for additional support
- **Issues:** Report to development team

---

## Quick Checklist for App Developers

- [ ] Implement authentication flow
- [ ] Create dashboard stats screen
- [ ] Build company list with search/filter
- [ ] Design pending products review interface
- [ ] Add approve/reject buttons with forms
- [ ] Implement global product creation
- [ ] Show company usage details
- [ ] Display approval history
- [ ] Handle email notification previews
- [ ] Add pagination controls
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Create confirmation dialogs
- [ ] Test all workflows end-to-end
