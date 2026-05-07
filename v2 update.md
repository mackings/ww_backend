# V2 Backend Mobile API Integration Guide

Date tested: 2026-05-07

Base URL tested: `http://127.0.0.1:2000`

Smoke script: `Scripts/v2ApiSmoke.js`

Smoke result file: `tmp/v2-smoke-result.json`

## Introduction

This document is the mobile integration contract for the V2 backend. It is written for Flutter/mobile developers who need to call the backend without reading the Express controllers. It covers authentication, company context, material costing, quotation/BOM flow, invoice/order conversion, database screens, notifications, and platform-owner APIs.

The endpoint examples below are based on the successful smoke test run. Where a route was not exercised by the smoke script, it is listed separately in the untested route catalog at the end.

## Smoke Test Result

```json
{
  "baseUrl": "http://127.0.0.1:2000",
  "runId": 1778138512071,
  "passed": 71,
  "failed": 0,
  "totalCalls": 71
}
```

The backend was started locally on port `2000`. The passing test used `http://127.0.0.1:2000`. A previous attempt with `http://localhost:2000` failed before reaching Express in this environment.

## Base Setup

Use the deployed backend URL in production. For local simulator testing, use the LAN IP or emulator host mapping instead of plain `localhost` when needed.

JSON requests use:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Multipart uploads use:

```http
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Auth token types:

- `ownerToken`: returned by owner signup/signin. Use it for normal mobile app screens.
- `platformToken`: returned by platform owner signin. Use it only for admin/platform-owner screens.
- Company-scoped endpoints require the signed-in user to have an active company. Use `GET /api/auth/me` to inspect `activeCompany`, and `POST /api/auth/switch-company` to change it.

## Common Response Contract

Most controllers return one of these shapes:

```json
{
  "success": true,
  "message": "Operation message",
  "data": {}
}
```

```json
{
  "success": false,
  "message": "Error message",
  "errors": null
}
```

Some older/list endpoints return `success` with top-level `data`, `count`, `pagination`, `totals`, or `categories`. Always check `success` first, then read the documented fields for that endpoint.

## Recommended Mobile Flow

1. Sign up or sign in and store `data.token`.
2. Read `GET /api/auth/me` and store `data.activeCompany`.
3. Fetch material catalog with `GET /api/product/materials?limit=500`.
4. Use `dimensionRule.projectInput` to decide whether the UI needs quantity only or length/width/thickness.
5. Call `POST /api/product/material/:materialId/calculate-cost` before adding a material to a BOM.
6. If `calculation.needsPricing` is true, ask the owner for a manual unit price. Do not silently add it as zero.
7. Create products/BOMs/quotations using the calculated material lines.
8. Create invoices and orders from a successfully created quotation.

## Material Costing Rules

- Priced unit materials use `quantity * pricePerUnit`.
- Unpriced unit materials return `needsPricing: true` and `totalMaterialCost: "0.00"`.
- Board and Cushion use default stock size `48 x 96 inches` when stock dimensions are missing.
- Wood sizes like `1"x10"x144"` derive stock thickness, width, and length from the material DB size.
- Area materials return `projectAreaSqm`, `standardAreaSqm`, `minimumUnits`, `billableUnits`, `pricePerSqm`, and `totalMaterialCost`.
- Custom `Wood` and `Board` creation requires `thickness` and `thicknessUnit` unless the backend can derive them from catalog data.

Latest material catalog reseed result:

```json
{
  "deletedMaterials": 306,
  "insertedMaterials": 304,
  "pricedMaterials": 85,
  "unpricedMaterials": 219
}
```

## Tested API Summary

| # | API | Method | Endpoint | Status |
|---:|---|---|---|---:|
| 1 | Health check | GET | `/health` | 200 |
| 2 | Platform signin | POST | `/api/auth/signin` | 200 |
| 3 | Platform dashboard stats | GET | `/api/platform/dashboard/stats` | 200 |
| 4 | Reseed materials from material DB catalog | POST | `/api/platform/materials/reseed-from-catalog` | 200 |
| 5 | Supported material summary | GET | `/api/product/materials/supported/summary` | 200 |
| 6 | Owner signup with company | POST | `/api/auth/signup` | 201 |
| 7 | Owner me | GET | `/api/auth/me` | 200 |
| 8 | Owner companies embedded | GET | `/api/auth/companies` | 200 |
| 9 | Switch active company | POST | `/api/auth/switch-company` | 200 |
| 10 | Get settings | GET | `/api/settings` | 200 |
| 11 | Update settings | PUT | `/api/settings` | 200 |
| 12 | Get approved materials | GET | `/api/product/materials?limit=500` | 200 |
| 13 | Get grouped materials | GET | `/api/product/materials/grouped?limit=500` | 200 |
| 14 | Get supported materials | GET | `/api/product/materials/supported?category=Wood&limit=20` | 200 |
| 15 | Upload/create company material with image | POST | `/api/product/creatematerial` | 201 |
| 16 | Reject custom wood material without thickness | POST | `/api/product/creatematerial` | 400 |
| 17 | Create custom wood material with thickness | POST | `/api/product/creatematerial` | 201 |
| 18 | Create custom board material with thickness | POST | `/api/product/creatematerial` | 201 |
| 19 | Create company material for approval | POST | `/api/product/creatematerial` | 201 |
| 20 | Create company material for rejection | POST | `/api/product/creatematerial` | 201 |
| 21 | Create company material for pricing/update/delete | POST | `/api/product/creatematerial` | 201 |
| 22 | Add material types | POST | `/api/product/:materialId/add-types` | 200 |
| 23 | Platform update company material price | PATCH | `/api/platform/materials/:materialId/price` | 200 |
| 24 | Database update material type pricing | PUT | `/api/database/materials/pricing/type` | 200 |
| 25 | Database update single material | PUT | `/api/database/materials/:id` | 200 |
| 26 | Platform approve pending material | PATCH | `/api/platform/materials/:materialId/approve` | 200 |
| 27 | Platform reject pending material | PATCH | `/api/platform/materials/:materialId/reject` | 200 |
| 28 | Database delete test material | DELETE | `/api/database/materials/:id` | 200 |
| 29 | Database delete uploaded material | DELETE | `/api/database/materials/:id` | 200 |
| 30 | Database delete custom wood material | DELETE | `/api/database/materials/:id` | 200 |
| 31 | Database delete custom board material | DELETE | `/api/database/materials/:id` | 200 |
| 32 | Calculate priced wood area cost | POST | `/api/product/material/:materialId/calculate-cost` | 200 |
| 33 | Calculate unpriced nail quantity cost | POST | `/api/product/material/:materialId/calculate-cost` | 200 |
| 34 | Calculate priced gum quantity cost | POST | `/api/product/material/:materialId/calculate-cost` | 200 |
| 35 | Calculate unpriced paint quantity cost | POST | `/api/product/material/:materialId/calculate-cost` | 200 |
| 36 | Create product | POST | `/api/product` | 201 |
| 37 | Get products | GET | `/api/product` | 200 |
| 38 | Get product by id | GET | `/api/product/:id` | 200 |
| 39 | Create BOM | POST | `/api/bom` | 201 |
| 40 | Get BOMs | GET | `/api/bom` | 200 |
| 41 | Get BOM by id | GET | `/api/bom/:id` | 200 |
| 42 | Create quotation | POST | `/api/quotation` | 201 |
| 43 | Get quotations | GET | `/api/quotation` | 200 |
| 44 | Get quotation by id | GET | `/api/quotation/:id` | 200 |
| 45 | Create invoice from quotation | POST | `/api/invoices/create` | 201 |
| 46 | Get invoices | GET | `/api/invoices/invoices` | 200 |
| 47 | Get invoice stats | GET | `/api/invoices/invoices/stats` | 200 |
| 48 | Create order from quotation | POST | `/api/orders/create` | 201 |
| 49 | Get orders | GET | `/api/orders/get-orders` | 200 |
| 50 | Get order stats | GET | `/api/orders/stats` | 200 |
| 51 | Get order by id | GET | `/api/orders/get-orders/:id` | 200 |
| 52 | Get order receipt | GET | `/api/orders/get-orders/:id/receipt` | 200 |
| 53 | Get sales clients | GET | `/api/sales/get-clients` | 200 |
| 54 | Get sales analytics | GET | `/api/sales/get-sales` | 200 |
| 55 | Get inventory status | GET | `/api/sales/get-inventory` | 200 |
| 56 | Create overhead cost | POST | `/api/oc/create-oc` | 201 |
| 57 | Get overhead costs | GET | `/api/oc/get-oc` | 200 |
| 58 | Get notifications | GET | `/api/notifications` | 200 |
| 59 | Get notification unread count | GET | `/api/notifications/unread-count` | 200 |
| 60 | Database quotations | GET | `/api/database/quotations` | 200 |
| 61 | Database BOMs | GET | `/api/database/boms` | 200 |
| 62 | Database clients | GET | `/api/database/clients` | 200 |
| 63 | Database staff | GET | `/api/database/staff` | 200 |
| 64 | Database products | GET | `/api/database/products` | 200 |
| 65 | Database materials | GET | `/api/database/materials` | 200 |
| 66 | Database invoices | GET | `/api/database/invoices` | 200 |
| 67 | Database receipts | GET | `/api/database/receipts` | 200 |
| 68 | Platform overview | GET | `/api/platform/stats/overview` | 200 |
| 69 | Platform companies | GET | `/api/platform/companies?limit=5` | 200 |
| 70 | Platform products all | GET | `/api/platform/products/all?limit=5` | 200 |
| 71 | Platform materials pending | GET | `/api/platform/materials/pending?limit=5` | 200 |

## Tested API Reference

Each endpoint below includes the API call, auth requirement, request contract, and expected response from the smoke run. Passwords and tokens are redacted. Large arrays are shortened but keep the response structure.

## System APIs

### GET /health

Name: Health check

Purpose: Checks that Express is running. This route does not require MongoDB.

Auth: Public

API call:

```http
GET /health HTTP/1.1
Host: <base-url-host>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, timestamp: string }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-05-07T07:21:52.125Z"
}
```

## Authentication APIs

### POST /api/auth/signin

Name: Platform signin

Purpose: Signs in the platform owner and returns a platform token.

Auth: Public

API call:

```http
POST /api/auth/signin HTTP/1.1
Host: <base-url-host>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `email` | `string` | Sent in smoke run |
| `password` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "email": "admin@woodworker.com",
  "password": "<redacted>"
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { token: string, user: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Signed in successfully",
  "data": {
    "token": "<redacted>",
    "user": {
      "id": "6964b6078c3ced74787860b5",
      "fullname": "Platform Admin",
      "email": "admin@woodworker.com",
      "phoneNumber": "+1234567890",
      "isVerified": true,
      "isPlatformOwner": true,
      "companies": [
        {
          "permissions": {
            "quotation": true,
            "sales": true,
            "order": true,
            "database": true,
            "receipts": true,
            "backupAlerts": true,
            "invoice": true,
            "products": true,
            "boms": true
          },
          "name": "Zillow",
          "email": "macsonline500@gmail.com",
          "phoneNumber": "08110947817",
          "address": "No 22 Heritage estate Ibadan.",
          "role": "owner",
          "position": "Owner",
          "accessGranted": true,
          "joinedAt": "2026-01-12T22:33:49.879Z",
          "_id": "696576cdddd58d02b764d34c"
        }
      ],
      "activeCompanyIndex": 0,
      "activeCompany": {
        "permissions": {
          "quotation": false,
          "sales": false,
          "order": false,
          "database": false,
          "receipts": false,
          "backupAlerts": false,
          "invoice": false,
          "products": false,
          "boms": false
        },
        "name": "Zillow",
        "email": "macsonline500@gmail.com",
        "phoneNumber": "08110947817",
        "address": "No 22 Heritage estate Ibadan.",
        "role": "owner",
        "position": "Owner",
        "accessGranted": true,
        "joinedAt": "2026-01-12T22:33:49.879Z",
        "_id": "696576cdddd58d02b764d34c"
      }
    }
  }
}
```

### POST /api/auth/signup

Name: Owner signup with company

Purpose: Creates a normal owner user and optionally embeds the first company.

Auth: Public

API call:

```http
POST /api/auth/signup HTTP/1.1
Host: <base-url-host>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `fullname` | `string` | Sent in smoke run |
| `email` | `string` | Sent in smoke run |
| `phoneNumber` | `string` | Sent in smoke run |
| `password` | `string` | Sent in smoke run |
| `companyName` | `string` | Sent in smoke run |
| `companyEmail` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "fullname": "V2 Material Owner",
  "email": "v2.owner.1778138512071@example.com",
  "phoneNumber": "+2348038512071",
  "password": "<redacted>",
  "companyName": "V2 Material Test Co 1778138512071",
  "companyEmail": "company.1778138512071@example.com"
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, message: string, data: { token: string, user: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "token": "<redacted>",
    "user": {
      "id": "69fc3da0065936b6a83f6ccf",
      "fullname": "V2 Material Owner",
      "email": "v2.owner.1778138512071@example.com",
      "phoneNumber": "+2348038512071",
      "isVerified": false,
      "companies": [
        {
          "name": "V2 Material Test Co 1778138512071",
          "email": "company.1778138512071@example.com",
          "phoneNumber": "+2348038512071",
          "role": "owner",
          "position": "Owner",
          "accessGranted": true,
          "joinedAt": "2026-05-07T07:22:08.594Z",
          "permissions": {
            "quotation": true,
            "sales": true,
            "order": true,
            "database": true,
            "receipts": true,
            "backupAlerts": true,
            "invoice": true,
            "products": true,
            "boms": true
          },
          "_id": "69fc3da0065936b6a83f6cd0"
        }
      ],
      "activeCompany": {
        "name": "V2 Material Test Co 1778138512071",
        "email": "company.1778138512071@example.com",
        "phoneNumber": "+2348038512071",
        "role": "owner",
        "position": "Owner",
        "accessGranted": true,
        "joinedAt": "2026-05-07T07:22:08.594Z",
        "permissions": {
          "quotation": true,
          "sales": true,
          "order": true,
          "database": true,
          "receipts": true,
          "backupAlerts": true,
          "invoice": true,
          "products": true,
          "boms": true
        },
        "_id": "69fc3da0065936b6a83f6cd0"
      }
    }
  }
}
```

### GET /api/auth/me

Name: Owner me

Purpose: Returns current user, companies, active company, and effective permissions.

Auth: User token

API call:

```http
GET /api/auth/me HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { id: string, fullname: string, email: string, phoneNumber: string, isVerified: boolean, isPlatformOwner: boolean, companies: array<object>, activeCompanyIndex: number, activeCompany: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "id": "69fc3da0065936b6a83f6ccf",
    "fullname": "V2 Material Owner",
    "email": "v2.owner.1778138512071@example.com",
    "phoneNumber": "+2348038512071",
    "isVerified": false,
    "isPlatformOwner": false,
    "companies": [
      {
        "permissions": {
          "quotation": true,
          "sales": true,
          "order": true,
          "database": true,
          "receipts": true,
          "backupAlerts": true,
          "invoice": true,
          "products": true,
          "boms": true
        },
        "name": "V2 Material Test Co 1778138512071",
        "email": "company.1778138512071@example.com",
        "phoneNumber": "+2348038512071",
        "role": "owner",
        "position": "Owner",
        "accessGranted": true,
        "joinedAt": "2026-05-07T07:22:08.594Z",
        "_id": "69fc3da0065936b6a83f6cd0"
      }
    ],
    "activeCompanyIndex": 0,
    "activeCompany": {
      "permissions": {
        "quotation": true,
        "sales": true,
        "order": true,
        "database": true,
        "receipts": true,
        "backupAlerts": true,
        "invoice": true,
        "products": true,
        "boms": true
      },
      "name": "V2 Material Test Co 1778138512071",
      "email": "company.1778138512071@example.com",
      "phoneNumber": "+2348038512071",
      "role": "owner",
      "position": "Owner",
      "accessGranted": true,
      "joinedAt": "2026-05-07T07:22:08.594Z",
      "_id": "69fc3da0065936b6a83f6cd0"
    }
  }
}
```

### GET /api/auth/companies

Name: Owner companies embedded

Purpose: Returns companies linked through the UserCompany collection.

Auth: User token

API call:

```http
GET /api/auth/companies HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: array }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Companies fetched successfully",
  "data": []
}
```

### POST /api/auth/switch-company

Name: Switch active company

Purpose: Changes which embedded company is used by company-scoped APIs.

Auth: User token

API call:

```http
POST /api/auth/switch-company HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `companyIndex` | `number` | Sent in smoke run |

Request JSON example:

```json
{
  "companyIndex": 0
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { activeCompanyIndex: number, activeCompany: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Company switched successfully",
  "data": {
    "activeCompanyIndex": 0,
    "activeCompany": {
      "permissions": {
        "quotation": true,
        "sales": true,
        "order": true,
        "database": true,
        "receipts": true,
        "backupAlerts": true,
        "invoice": true,
        "products": true,
        "boms": true
      },
      "name": "V2 Material Test Co 1778138512071",
      "email": "company.1778138512071@example.com",
      "phoneNumber": "+2348038512071",
      "role": "owner",
      "position": "Owner",
      "accessGranted": true,
      "joinedAt": "2026-05-07T07:22:08.594Z",
      "_id": "69fc3da0065936b6a83f6cd0"
    }
  }
}
```

## Settings APIs

### GET /api/settings

Name: Get settings

Purpose: Fetches company settings. Creates default settings if missing.

Auth: User token + active company

API call:

```http
GET /api/settings HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { companyName: string, cloudSyncEnabled: boolean, autoBackupEnabled: boolean, updatedBy: string, _id: string, notifications: object, createdAt: string, updatedAt: string, __v: number } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Settings fetched successfully",
  "data": {
    "companyName": "V2 Material Test Co 1778138512071",
    "cloudSyncEnabled": false,
    "autoBackupEnabled": false,
    "updatedBy": "69fc3da0065936b6a83f6ccf",
    "_id": "69fc3da3065936b6a83f6ce3",
    "notifications": {
      "pushNotification": true,
      "emailNotification": true,
      "quotationReminders": true,
      "projectDeadlines": true,
      "backupAlerts": true
    },
    "createdAt": "2026-05-07T07:22:11.990Z",
    "updatedAt": "2026-05-07T07:22:11.990Z",
    "__v": 0
  }
}
```

### PUT /api/settings

Name: Update settings

Purpose: Updates company settings booleans.

Auth: Owner/admin token + active company

API call:

```http
PUT /api/settings HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `cloudSyncEnabled` | `boolean` | Sent in smoke run |
| `autoBackupEnabled` | `boolean` | Sent in smoke run |
| `notifications` | `object` | Sent in smoke run |

Request JSON example:

```json
{
  "cloudSyncEnabled": true,
  "autoBackupEnabled": true,
  "notifications": {
    "emailNotification": false,
    "quotationReminders": true,
    "projectDeadlines": true
  }
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { _id: string, companyName: string, cloudSyncEnabled: boolean, autoBackupEnabled: boolean, updatedBy: string, notifications: object, createdAt: string, updatedAt: string, __v: number } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "_id": "69fc3da3065936b6a83f6ce3",
    "companyName": "V2 Material Test Co 1778138512071",
    "cloudSyncEnabled": true,
    "autoBackupEnabled": true,
    "updatedBy": "69fc3da0065936b6a83f6ccf",
    "notifications": {
      "pushNotification": true,
      "emailNotification": false,
      "quotationReminders": true,
      "projectDeadlines": true,
      "backupAlerts": true
    },
    "createdAt": "2026-05-07T07:22:11.990Z",
    "updatedAt": "2026-05-07T07:22:13.015Z",
    "__v": 0
  }
}
```

## Materials APIs

### GET /api/product/materials/supported/summary

Name: Supported material summary

Purpose: Returns catalog category totals and pricing coverage.

Auth: User or platform token

API call:

```http
GET /api/product/materials/supported/summary HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, totals: { total: number, priced: number, unpriced: number }, categories: array<object> }`.

Response JSON example:

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
      "category": "Adhensive",
      "total": 5,
      "priced": 2,
      "unpriced": 3,
      "subCategories": [
        "China glue",
        "Gum",
        "... 2 more item(s)"
      ]
    },
    {
      "category": "Angle_bracket",
      "total": 3,
      "priced": 1,
      "unpriced": 2,
      "subCategories": [
        "Aluminium",
        "Iron",
        "... 1 more item(s)"
      ]
    },
    "... 23 more item(s)"
  ]
}
```

### GET /api/product/materials?limit=500

Name: Get approved materials

Purpose: Fetches material catalog and company materials visible to the active company.

Auth: User token + active company

API call:

```http
GET /api/product/materials?limit=500 HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Query parameters used in smoke run:

```json
{
  "limit": "500"
}
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, count: number, dimensionRulesByCategory: array<object>, data: array<object> }`.

Response JSON example:

```json
{
  "success": true,
  "count": 304,
  "dimensionRulesByCategory": [
    {
      "category": "Adhensive",
      "count": 5,
      "schema": "quantity_only",
      "projectInput": {
        "showLength": false,
        "showWidth": false,
        "showThickness": false,
        "requireLength": false,
        "requireWidth": false,
        "requireThickness": false,
        "defaultUnit": "piece"
      },
      "dominantSizePattern": "empty",
      "sizePatternCounts": {
        "triple": 0,
        "double": 0,
        "single": 0,
        "empty": 3,
        "descriptor": 2
      },
      "sampleSizes": [
        "15kg",
        "3kg"
      ],
      "units": [
        "piece",
        "Piece"
      ],
      "note": "This material is typically quantity-based unless your UI enables manual dimensions."
    },
    {
      "category": "Angle_bracket",
      "count": 3,
      "schema": "quantity_only",
      "projectInput": {
        "showLength": false,
        "showWidth": false,
        "showThickness": false,
        "requireLength": false,
        "requireWidth": false,
        "requireThickness": false,
        "defaultUnit": "inches"
      },
      "dominantSizePattern": "empty",
      "sizePatternCounts": {
        "triple": 0,
        "double": 0,
        "single": 1,
        "empty": 2,
        "descriptor": 0
      },
      "sampleSizes": [
        "8\""
      ],
      "units": [
        "inches",
        "pack",
        "... 2 more item(s)"
      ],
      "note": "This material is typically quantity-based unless your UI enables manual dimensions."
    },
    "... 23 more item(s)"
  ],
  "data": [
    {
      "_id": "69fc3d9d065936b6a83f6bd3",
      "companyName": "GLOBAL",
      "isGlobal": true,
      "status": "approved",
      "approvedBy": "6964b6078c3ced74787860b5",
      "approvedAt": "2026-05-07T07:22:05.231Z",
      "rejectionReason": null,
      "submittedBy": "6964b6078c3ced74787860b5",
      "submittedAt": "2026-05-07T07:22:05.231Z",
      "resubmissionCount": 0,
      "approvalHistory": [
        {
          "action": "approved",
          "performedBy": "6964b6078c3ced74787860b5",
          "performedByName": "Platform Admin",
          "reason": "Reseeded from materials_all.csv catalog",
          "timestamp": "2026-05-07T07:22:05.231Z",
          "_id": "69fc3d9d065936b6a83f6bd4"
        }
      ],
      "name": "Adhensive_China glue_Piece",
      "category": "Adhensive",
      "subCategory": "China glue",
      "size": "",
      "color": "",
      "thickness": null,
      "thicknessUnit": "inches",
      "catalogKey": "adhensive_china glue_piece|adhensive|china glue||piece|",
      "catalogPrice": null,
      "isCatalogMaterial": true,
      "isCatalogPriced": false,
      "image": null,
      "standardWidth": null,
      "_more": "22 more field(s)"
    },
    {
      "_id": "69fc3d9d065936b6a83f6bcf",
      "companyName": "GLOBAL",
      "isGlobal": true,
      "status": "approved",
      "approvedBy": "6964b6078c3ced74787860b5",
      "approvedAt": "2026-05-07T07:22:05.231Z",
      "rejectionReason": null,
      "submittedBy": "6964b6078c3ced74787860b5",
      "submittedAt": "2026-05-07T07:22:05.231Z",
      "resubmissionCount": 0,
      "approvalHistory": [
        {
          "action": "approved",
          "performedBy": "6964b6078c3ced74787860b5",
          "performedByName": "Platform Admin",
          "reason": "Reseeded from materials_all.csv catalog",
          "timestamp": "2026-05-07T07:22:05.231Z",
          "_id": "69fc3d9d065936b6a83f6bd0"
        }
      ],
      "name": "Adhensive_Gum_15kg_Piece",
      "category": "Adhensive",
      "subCategory": "Gum",
      "size": "15kg",
      "color": "",
      "thickness": null,
      "thicknessUnit": "inches",
      "catalogKey": "adhensive_gum_15kg_piece|adhensive|gum|15kg|piece|",
      "catalogPrice": 52000,
      "isCatalogMaterial": true,
      "isCatalogPriced": true,
      "image": null,
      "standardWidth": null,
      "_more": "22 more field(s)"
    },
    "... 302 more item(s)"
  ]
}
```

### GET /api/product/materials/grouped?limit=500

Name: Get grouped materials

Purpose: Fetches materials grouped by category and subcategory for picker UIs.

Auth: User token + active company

API call:

```http
GET /api/product/materials/grouped?limit=500 HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Query parameters used in smoke run:

```json
{
  "limit": "500"
}
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, count: number, categoryCount: number, data: array<object> }`.

Response JSON example:

```json
{
  "success": true,
  "count": 304,
  "categoryCount": 25,
  "data": [
    {
      "category": "Adhensive",
      "total": 5,
      "priced": 2,
      "unpriced": 3,
      "subCategories": [
        {
          "subCategory": "China glue",
          "total": 1,
          "priced": 0,
          "unpriced": 1,
          "variants": [
            {
              "id": "69fc3d9d065936b6a83f6bd3",
              "name": "Adhensive_China glue_Piece",
              "type": "China glue",
              "size": "",
              "unit": "Piece",
              "color": "",
              "thickness": null,
              "thicknessUnit": "inches",
              "pricingUnit": "piece",
              "unitPrice": null,
              "_more": "9 more field(s)"
            }
          ]
        },
        {
          "subCategory": "Gum",
          "total": 2,
          "priced": 2,
          "unpriced": 0,
          "variants": [
            {
              "id": "69fc3d9d065936b6a83f6bcf",
              "name": "Adhensive_Gum_15kg_Piece",
              "type": "Gum",
              "size": "15kg",
              "unit": "Piece",
              "color": "",
              "thickness": null,
              "thicknessUnit": "inches",
              "pricingUnit": "piece",
              "unitPrice": 52000,
              "_more": "9 more field(s)"
            },
            {
              "id": "69fc3d9d065936b6a83f6bcd",
              "name": "Adhensive_Gum_3kg_Piece",
              "type": "Gum",
              "size": "3kg",
              "unit": "Piece",
              "color": "",
              "thickness": null,
              "thicknessUnit": "inches",
              "pricingUnit": "piece",
              "unitPrice": 11300,
              "_more": "9 more field(s)"
            }
          ]
        },
        "... 2 more item(s)"
      ]
    },
    {
      "category": "Angle_bracket",
      "total": 3,
      "priced": 1,
      "unpriced": 2,
      "subCategories": [
        {
          "subCategory": "Aluminium",
          "total": 1,
          "priced": 0,
          "unpriced": 1,
          "variants": [
            {
              "id": "69fc3d9d065936b6a83f6ba3",
              "name": "Angle_bracket_Aluminium_8\"_Piece",
              "type": "Aluminium",
              "size": "8\"",
              "unit": "Piece",
              "color": "",
              "thickness": null,
              "thicknessUnit": "inches",
              "pricingUnit": "piece",
              "unitPrice": null,
              "_more": "9 more field(s)"
            }
          ]
        },
        {
          "subCategory": "Iron",
          "total": 1,
          "priced": 1,
          "unpriced": 0,
          "variants": [
            {
              "id": "69fc3d9d065936b6a83f6ba5",
              "name": "Angle_bracket_Iron_Pack",
              "type": "Iron",
              "size": "",
              "unit": "Pack",
              "color": "",
              "thickness": null,
              "thicknessUnit": "inches",
              "pricingUnit": "pack",
              "unitPrice": 2500,
              "_more": "9 more field(s)"
            }
          ]
        },
        "... 1 more item(s)"
      ]
    },
    "... 23 more item(s)"
  ]
}
```

### GET /api/product/materials/supported?category=Wood&limit=20

Name: Get supported materials

Purpose: Fetches supported material rows with optional category filtering.

Auth: User token + active company

API call:

```http
GET /api/product/materials/supported?category=Wood&limit=20 HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Query parameters used in smoke run:

```json
{
  "category": "Wood",
  "limit": "20"
}
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, count: number, total: number, page: number, totalPages: number, data: array<object> }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Supported materials fetched successfully",
  "count": 2,
  "total": 2,
  "page": 1,
  "totalPages": 1,
  "data": [
    {
      "id": 302,
      "key": "wood_melina_1\"x10\"x144\"_piece|wood|melina|1\"x10\"x144\"|piece|",
      "material": "Wood_Melina_1\"x10\"x144\"_Piece",
      "category": "Wood",
      "subCategory": "Melina",
      "size": "1\"x10\"x144\"",
      "unit": "Piece",
      "color": "",
      "priceRaw": "9000",
      "priceNumeric": 9000,
      "isPriced": true,
      "thickness": 1,
      "thicknessUnit": "inches",
      "pricingUnit": "piece",
      "sizePattern": "triple",
      "standardWidth": 10,
      "standardLength": 144,
      "standardUnit": "inches",
      "stockDimensionSource": "material_database_size",
      "stockAreaSqm": 0.9290304,
      "pricePerSqm": 9687.52
    },
    {
      "id": 303,
      "key": "wood_iroko_1\"x10\"x144\"_piece|wood|iroko|1\"x10\"x144\"|piece|",
      "material": "Wood_Iroko_1\"x10\"x144\"_Piece",
      "category": "Wood",
      "subCategory": "Iroko",
      "size": "1\"x10\"x144\"",
      "unit": "Piece",
      "color": "",
      "priceRaw": "12000",
      "priceNumeric": 12000,
      "isPriced": true,
      "thickness": 1,
      "thicknessUnit": "inches",
      "pricingUnit": "piece",
      "sizePattern": "triple",
      "standardWidth": 10,
      "standardLength": 144,
      "standardUnit": "inches",
      "stockDimensionSource": "material_database_size",
      "stockAreaSqm": 0.9290304,
      "pricePerSqm": 12916.69
    }
  ]
}
```

### POST /api/product/creatematerial

Name: Upload/create company material with image

Purpose: Creates a company material using multipart form-data and uploads an image.

Auth: User token + active company

API call:

```http
POST /api/product/creatematerial HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Request body: multipart form-data.

| Field | Type | Requirement |
|---|---|---|
| `name` | `string` | Required |
| `category` | `string` | Required |
| `subCategory` | `string` | Required |
| `unit` | `string` | Required |
| `pricePerUnit` | `number/string` | Optional pricing |
| `pricingUnit` | `string` | Optional pricing unit |
| `useCatalog` | `boolean/string` | Optional |
| `notes` | `string` | Optional |
| `image` | `file` | Optional file field |

Tested response: `201` (success).

Response shape: `{ success: boolean, data: { companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: null, thicknessUnit: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:20.373Z",
        "_id": "69fc3dac065936b6a83f6f5e"
      }
    ],
    "name": "V2 Uploaded Spray 1778138512071",
    "category": "Paint",
    "subCategory": "Spray paint",
    "size": "",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": null,
    "isCatalogMaterial": false,
    "isCatalogPriced": false,
    "image": "https://ik.imagekit.io/mackingsley/materials/material_1778138538024_v2-material_r1pU7JWlo.jpg",
    "standardUnit": "inches",
    "pricePerSqm": null,
    "pricePerUnit": 2100,
    "_more": "20 more field(s)"
  }
}
```

### POST /api/product/creatematerial

Name: Reject custom wood material without thickness

Purpose: Validation case proving Wood and Board materials require thickness data.

Auth: User token + active company

API call:

```http
POST /api/product/creatematerial HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `name` | `string` | Sent in smoke run |
| `category` | `string` | Sent in smoke run |
| `subCategory` | `string` | Sent in smoke run |
| `unit` | `string` | Sent in smoke run |
| `pricePerUnit` | `number` | Sent in smoke run |
| `pricingUnit` | `string` | Sent in smoke run |
| `useCatalog` | `boolean` | Sent in smoke run |
| `notes` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "name": "V2 Invalid Wood 1778138512071",
  "category": "Wood",
  "subCategory": "Iroko",
  "unit": "Piece",
  "pricePerUnit": 12000,
  "pricingUnit": "piece",
  "useCatalog": false,
  "notes": "Created to verify Wood thickness validation"
}
```

Tested response: `400` (success).

Response shape: `{ success: boolean, message: string }`.

Response JSON example:

```json
{
  "success": false,
  "message": "Thickness is required for Board/Wood materials. Provide thickness (e.g. 0.25) and thicknessUnit (e.g. inches)."
}
```

### POST /api/product/creatematerial

Name: Create custom wood material with thickness

Purpose: Creates a custom Wood material with stock dimensions.

Auth: User token + active company

API call:

```http
POST /api/product/creatematerial HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `name` | `string` | Sent in smoke run |
| `category` | `string` | Sent in smoke run |
| `subCategory` | `string` | Sent in smoke run |
| `unit` | `string` | Sent in smoke run |
| `thickness` | `number` | Sent in smoke run |
| `thicknessUnit` | `string` | Sent in smoke run |
| `standardWidth` | `number` | Sent in smoke run |
| `standardLength` | `number` | Sent in smoke run |
| `standardUnit` | `string` | Sent in smoke run |
| `pricePerUnit` | `number` | Sent in smoke run |
| `pricingUnit` | `string` | Sent in smoke run |
| `useCatalog` | `boolean` | Sent in smoke run |
| `notes` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "name": "V2 Custom Wood 1778138512071",
  "category": "Wood",
  "subCategory": "Iroko",
  "unit": "Piece",
  "thickness": 0.25,
  "thicknessUnit": "inches",
  "standardWidth": 10,
  "standardLength": 144,
  "standardUnit": "inches",
  "pricePerUnit": 12000,
  "pricingUnit": "piece",
  "useCatalog": false,
  "notes": "Created to verify Wood thickness upload"
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, data: { companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: number, thicknessUnit: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:22.111Z",
        "_id": "69fc3dae065936b6a83f6f6f"
      }
    ],
    "name": "V2 Custom Wood 1778138512071",
    "category": "Wood",
    "subCategory": "Iroko",
    "size": "",
    "color": "",
    "thickness": 0.25,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": null,
    "isCatalogMaterial": false,
    "isCatalogPriced": false,
    "image": null,
    "standardWidth": 10,
    "standardLength": 144,
    "standardUnit": "inches",
    "_more": "22 more field(s)"
  }
}
```

### POST /api/product/creatematerial

Name: Create custom board material with thickness

Purpose: Creates a custom Board material with sheet dimensions.

Auth: User token + active company

API call:

```http
POST /api/product/creatematerial HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `name` | `string` | Sent in smoke run |
| `category` | `string` | Sent in smoke run |
| `subCategory` | `string` | Sent in smoke run |
| `unit` | `string` | Sent in smoke run |
| `thickness` | `number` | Sent in smoke run |
| `thicknessUnit` | `string` | Sent in smoke run |
| `standardWidth` | `number` | Sent in smoke run |
| `standardLength` | `number` | Sent in smoke run |
| `standardUnit` | `string` | Sent in smoke run |
| `pricePerUnit` | `number` | Sent in smoke run |
| `pricingUnit` | `string` | Sent in smoke run |
| `useCatalog` | `boolean` | Sent in smoke run |
| `notes` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "name": "V2 Custom Board 1778138512071",
  "category": "Board",
  "subCategory": "Foreign Plywood",
  "unit": "Piece",
  "thickness": 0.75,
  "thicknessUnit": "inches",
  "standardWidth": 48,
  "standardLength": 96,
  "standardUnit": "inches",
  "pricePerUnit": 10000,
  "pricingUnit": "piece",
  "useCatalog": false,
  "notes": "Created to verify Board thickness upload"
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, data: { companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: number, thicknessUnit: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:23.456Z",
        "_id": "69fc3daf065936b6a83f6f7c"
      }
    ],
    "name": "V2 Custom Board 1778138512071",
    "category": "Board",
    "subCategory": "Foreign Plywood",
    "size": "",
    "color": "",
    "thickness": 0.75,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": null,
    "isCatalogMaterial": false,
    "isCatalogPriced": false,
    "image": null,
    "standardWidth": 48,
    "standardLength": 96,
    "standardUnit": "inches",
    "_more": "22 more field(s)"
  }
}
```

### POST /api/product/creatematerial

Name: Create company material for approval

Purpose: Creates a pending company material that platform owner can approve.

Auth: User token + active company

API call:

```http
POST /api/product/creatematerial HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `name` | `string` | Sent in smoke run |
| `category` | `string` | Sent in smoke run |
| `subCategory` | `string` | Sent in smoke run |
| `unit` | `string` | Sent in smoke run |
| `pricePerUnit` | `number` | Sent in smoke run |
| `pricingUnit` | `string` | Sent in smoke run |
| `useCatalog` | `boolean` | Sent in smoke run |
| `notes` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "name": "V2 Approval Material 1778138512071",
  "category": "Paint",
  "subCategory": "Primer",
  "unit": "Piece",
  "pricePerUnit": 1800,
  "pricingUnit": "piece",
  "useCatalog": false,
  "notes": "Created for platform approval smoke test"
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, data: { companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: null, thicknessUnit: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:24.801Z",
        "_id": "69fc3db0065936b6a83f6f89"
      }
    ],
    "name": "V2 Approval Material 1778138512071",
    "category": "Paint",
    "subCategory": "Primer",
    "size": "",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": null,
    "isCatalogMaterial": false,
    "isCatalogPriced": false,
    "image": null,
    "standardUnit": "inches",
    "pricePerSqm": null,
    "pricePerUnit": 1800,
    "_more": "20 more field(s)"
  }
}
```

### POST /api/product/creatematerial

Name: Create company material for rejection

Purpose: Creates a pending company material that platform owner can reject.

Auth: User token + active company

API call:

```http
POST /api/product/creatematerial HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `name` | `string` | Sent in smoke run |
| `category` | `string` | Sent in smoke run |
| `subCategory` | `string` | Sent in smoke run |
| `unit` | `string` | Sent in smoke run |
| `pricePerUnit` | `number` | Sent in smoke run |
| `pricingUnit` | `string` | Sent in smoke run |
| `useCatalog` | `boolean` | Sent in smoke run |
| `notes` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "name": "V2 Reject Material 1778138512071",
  "category": "Paint",
  "subCategory": "Hardner",
  "unit": "Piece",
  "pricePerUnit": 900,
  "pricingUnit": "piece",
  "useCatalog": false,
  "notes": "Created for platform rejection smoke test"
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, data: { companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: null, thicknessUnit: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:26.078Z",
        "_id": "69fc3db2065936b6a83f6f96"
      }
    ],
    "name": "V2 Reject Material 1778138512071",
    "category": "Paint",
    "subCategory": "Hardner",
    "size": "",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": null,
    "isCatalogMaterial": false,
    "isCatalogPriced": false,
    "image": null,
    "standardUnit": "inches",
    "pricePerSqm": null,
    "pricePerUnit": 900,
    "_more": "20 more field(s)"
  }
}
```

### POST /api/product/creatematerial

Name: Create company material for pricing/update/delete

Purpose: Creates a test material used by type pricing, single update, and delete flows.

Auth: User token + active company

API call:

```http
POST /api/product/creatematerial HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `name` | `string` | Sent in smoke run |
| `category` | `string` | Sent in smoke run |
| `subCategory` | `string` | Sent in smoke run |
| `unit` | `string` | Sent in smoke run |
| `pricePerUnit` | `number` | Sent in smoke run |
| `pricingUnit` | `string` | Sent in smoke run |
| `useCatalog` | `boolean` | Sent in smoke run |
| `notes` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "name": "V2 Mutable Material 1778138512071",
  "category": "Paint",
  "subCategory": "Auto base",
  "unit": "Piece",
  "pricePerUnit": 1000,
  "pricingUnit": "piece",
  "useCatalog": false,
  "notes": "Created for material mutation smoke test"
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, data: { companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: null, thicknessUnit: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:27.450Z",
        "_id": "69fc3db3065936b6a83f6fa3"
      }
    ],
    "name": "V2 Mutable Material 1778138512071",
    "category": "Paint",
    "subCategory": "Auto base",
    "size": "",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": null,
    "isCatalogMaterial": false,
    "isCatalogPriced": false,
    "image": null,
    "standardUnit": "inches",
    "pricePerSqm": null,
    "pricePerUnit": 1000,
    "_more": "20 more field(s)"
  }
}
```

### POST /api/product/:materialId/add-types

Name: Add material types

Purpose: Adds type/variant pricing rows to an existing material.

Auth: User token + active company

API call:

```http
POST /api/product/:materialId/add-types HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `types` | `array` | Sent in smoke run |

Request JSON example:

```json
{
  "types": [
    {
      "name": "Gloss finish",
      "pricePerUnit": 1200,
      "pricePerSqm": 3500,
      "standardWidth": 1,
      "standardLength": 1,
      "dimensionUnit": "m"
    }
  ]
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { _id: string, companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: null, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "_id": "69fc3db3065936b6a83f6fa2",
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:27.450Z",
        "_id": "69fc3db3065936b6a83f6fa3"
      }
    ],
    "name": "V2 Mutable Material 1778138512071",
    "category": "Paint",
    "subCategory": "Auto base",
    "size": "",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": null,
    "isCatalogMaterial": false,
    "isCatalogPriced": false,
    "image": null,
    "standardUnit": "inches",
    "pricePerSqm": null,
    "_more": "17 more field(s)"
  }
}
```

## Material Costing APIs

### POST /api/product/material/:materialId/calculate-cost

Name: Calculate priced wood area cost

Purpose: Calculates area-based cost for priced Wood.

Auth: User token + active company

API call:

```http
POST /api/product/material/:materialId/calculate-cost HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `requiredWidth` | `number` | Sent in smoke run |
| `requiredLength` | `number` | Sent in smoke run |
| `requiredUnit` | `string` | Sent in smoke run |
| `quantity` | `number` | Sent in smoke run |

Request JSON example:

```json
{
  "requiredWidth": 20,
  "requiredLength": 48,
  "requiredUnit": "inches",
  "quantity": 1
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { material: object, project: object, standard: object, calculation: object, pricing: object, waste: object } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "material": {
      "id": "69fc3d9d065936b6a83f6cc5",
      "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
      "category": "Wood",
      "type": null,
      "variant": null
    },
    "project": {
      "requiredWidth": 20,
      "requiredLength": 48,
      "requiredUnit": "inches",
      "projectAreaSqm": "0.6194"
    },
    "standard": {
      "standardWidth": 10,
      "standardLength": 144,
      "standardUnit": "inches",
      "standardAreaSqm": "0.9290"
    },
    "calculation": {
      "mode": "area_based",
      "minimumUnits": 1,
      "quantity": 1,
      "billableUnits": 1,
      "wasteThreshold": 0.75,
      "rawRemainder": "0.6194",
      "wasteThresholdArea": "0.6968",
      "extraUnitAdded": true
    },
    "pricing": {
      "pricePerSqm": "12916.69",
      "computedPricePerFullUnit": "12000.00",
      "pricePerFullUnit": "12000.00",
      "totalMaterialCost": "12000.00"
    },
    "waste": {
      "totalAreaUsed": "0.9290",
      "wasteArea": "0.3097",
      "wastePercentage": "33.33"
    }
  }
}
```

### POST /api/product/material/:materialId/calculate-cost

Name: Calculate unpriced nail quantity cost

Purpose: Calculates quantity cost for unpriced Nail and returns needsPricing.

Auth: User token + active company

API call:

```http
POST /api/product/material/:materialId/calculate-cost HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `quantity` | `number` | Sent in smoke run |

Request JSON example:

```json
{
  "quantity": 1
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { material: object, calculation: object, pricing: object } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "material": {
      "id": "69fc3d9d065936b6a83f6a95",
      "name": "Nail_ Hammer_0.5\"_ bag",
      "category": "Nail",
      "subCategory": "Hammer",
      "unit": "bag"
    },
    "calculation": {
      "mode": "unit_based",
      "quantity": 1,
      "needsPricing": true
    },
    "pricing": {
      "pricePerUnit": "0.00",
      "totalMaterialCost": "0.00"
    }
  }
}
```

### POST /api/product/material/:materialId/calculate-cost

Name: Calculate priced gum quantity cost

Purpose: Calculates quantity cost for priced Adhesive/Gum.

Auth: User token + active company

API call:

```http
POST /api/product/material/:materialId/calculate-cost HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `quantity` | `number` | Sent in smoke run |

Request JSON example:

```json
{
  "quantity": 1
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { material: object, calculation: object, pricing: object } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "material": {
      "id": "69fc3d9d065936b6a83f6bcf",
      "name": "Adhensive_Gum_15kg_Piece",
      "category": "Adhensive",
      "subCategory": "Gum",
      "unit": "Piece"
    },
    "calculation": {
      "mode": "unit_based",
      "quantity": 1,
      "needsPricing": false
    },
    "pricing": {
      "pricePerUnit": "52000.00",
      "totalMaterialCost": "52000.00"
    }
  }
}
```

### POST /api/product/material/:materialId/calculate-cost

Name: Calculate unpriced paint quantity cost

Purpose: Calculates quantity cost for unpriced Paint and returns needsPricing.

Auth: User token + active company

API call:

```http
POST /api/product/material/:materialId/calculate-cost HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `quantity` | `number` | Sent in smoke run |

Request JSON example:

```json
{
  "quantity": 2
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { material: object, calculation: object, pricing: object } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "material": {
      "id": "69fc3d9d065936b6a83f6c3f",
      "name": "Paint_Auto base_Piece",
      "category": "Paint",
      "subCategory": "Auto base",
      "unit": "Piece"
    },
    "calculation": {
      "mode": "unit_based",
      "quantity": 2,
      "needsPricing": true
    },
    "pricing": {
      "pricePerUnit": "0.00",
      "totalMaterialCost": "0.00"
    }
  }
}
```

## Products APIs

### POST /api/product

Name: Create product

Purpose: Creates a company product submitted for platform approval.

Auth: User token + active company

API call:

```http
POST /api/product HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `name` | `string` | Sent in smoke run |
| `category` | `string` | Sent in smoke run |
| `subCategory` | `string` | Sent in smoke run |
| `description` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "name": "Sitting Chair 1778138512071",
  "category": "Furniture",
  "subCategory": "Chair",
  "description": "V2 smoke test chair"
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, message: string, data: { userId: string, companyName: string, name: string, productId: string, category: string, subCategory: string, description: string, image: null, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Product submitted for approval",
  "data": {
    "userId": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "name": "Sitting Chair 1778138512071",
    "productId": "PRD-SE7MZU",
    "category": "Furniture",
    "subCategory": "Chair",
    "description": "V2 smoke test chair",
    "image": null,
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "timestamp": "2026-05-07T07:22:55.491Z",
        "_id": "69fc3dcf065936b6a83f7039"
      }
    ],
    "_id": "69fc3dcf065936b6a83f7038",
    "submittedAt": "2026-05-07T07:22:55.492Z",
    "createdAt": "2026-05-07T07:22:55.492Z",
    "updatedAt": "2026-05-07T07:22:55.492Z",
    "__v": 0
  }
}
```

### GET /api/product

Name: Get products

Purpose: Lists products visible to the company.

Auth: User token + active company

API call:

```http
GET /api/product HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: array<object>, pagination: { page: number, limit: number, total: number, pages: number } }`.

Response JSON example:

```json
{
  "success": true,
  "data": [
    {
      "_id": "69fc3dcf065936b6a83f7038",
      "userId": "69fc3da0065936b6a83f6ccf",
      "companyName": "V2 Material Test Co 1778138512071",
      "name": "Sitting Chair 1778138512071",
      "productId": "PRD-SE7MZU",
      "category": "Furniture",
      "subCategory": "Chair",
      "description": "V2 smoke test chair",
      "image": null,
      "isGlobal": false,
      "status": "pending",
      "approvedBy": null,
      "approvedAt": null,
      "rejectionReason": null,
      "submittedBy": {
        "_id": "69fc3da0065936b6a83f6ccf",
        "fullname": "V2 Material Owner",
        "email": "v2.owner.1778138512071@example.com"
      },
      "resubmissionCount": 0,
      "approvalHistory": [
        {
          "action": "submitted",
          "performedBy": "69fc3da0065936b6a83f6ccf",
          "performedByName": "V2 Material Owner",
          "timestamp": "2026-05-07T07:22:55.491Z",
          "_id": "69fc3dcf065936b6a83f7039"
        }
      ],
      "submittedAt": "2026-05-07T07:22:55.492Z",
      "createdAt": "2026-05-07T07:22:55.492Z",
      "updatedAt": "2026-05-07T07:22:55.492Z",
      "__v": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

### GET /api/product/:id

Name: Get product by id

Purpose: Fetches one product.

Auth: User token + active company

API call:

```http
GET /api/product/:id HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { _id: string, userId: string, companyName: string, name: string, productId: string, category: string, subCategory: string, description: string, image: null, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "_id": "69fc3dcf065936b6a83f7038",
    "userId": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "name": "Sitting Chair 1778138512071",
    "productId": "PRD-SE7MZU",
    "category": "Furniture",
    "subCategory": "Chair",
    "description": "V2 smoke test chair",
    "image": null,
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "timestamp": "2026-05-07T07:22:55.491Z",
        "_id": "69fc3dcf065936b6a83f7039"
      }
    ],
    "submittedAt": "2026-05-07T07:22:55.492Z",
    "createdAt": "2026-05-07T07:22:55.492Z",
    "updatedAt": "2026-05-07T07:22:55.492Z",
    "__v": 0
  }
}
```

## BOM APIs

### POST /api/bom

Name: Create BOM

Purpose: Creates a Bill of Materials from calculated material lines and additional costs.

Auth: User token + active company

API call:

```http
POST /api/bom HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `name` | `string` | Sent in smoke run |
| `description` | `string` | Sent in smoke run |
| `product` | `object` | Sent in smoke run |
| `materials` | `array` | Sent in smoke run |
| `additionalCosts` | `array` | Sent in smoke run |
| `pricing` | `object` | Sent in smoke run |

Request JSON example:

```json
{
  "name": "Sitting Chair BOM 1778138512071",
  "description": "Wood, nail, gum and spray based on material DB",
  "product": {
    "productId": "PRD-SE7MZU",
    "name": "Sitting Chair 1778138512071",
    "description": "V2 smoke test chair"
  },
  "materials": [
    {
      "materialId": "69fc3d9d065936b6a83f6cc5",
      "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
      "category": "Wood",
      "subCategory": "Iroko",
      "unit": "Piece",
      "quantity": 1,
      "price": 12000,
      "squareMeter": 0.6194,
      "description": "Chair frame wood",
      "calculation": {
        "mode": "area_based",
        "minimumUnits": 1,
        "billableUnits": 1,
        "pricePerSqm": 12916.69,
        "pricePerFullUnit": 12000,
        "totalMaterialCost": 12000
      }
    },
    {
      "materialId": "69fc3d9d065936b6a83f6a95",
      "name": "Nail_ Hammer_0.5\"_ bag",
      "category": "Nail",
      "subCategory": "Hammer",
      "unit": "bag",
      "quantity": 1,
      "price": 2500,
      "squareMeter": 0,
      "description": "Nails manually priced because DB has no price",
      "calculation": {
        "mode": "unit_based",
        "billableUnits": 1,
        "totalMaterialCost": 2500
      }
    },
    "... 2 more item(s)"
  ],
  "additionalCosts": [
    {
      "name": "Workmanship",
      "amount": 15000
    }
  ],
  "pricing": {
    "markupPercentage": 30,
    "materialsTotal": 70100,
    "additionalTotal": 15000,
    "costPrice": 85100,
    "sellingPrice": 110630
  }
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, message: string, data: { userId: string, companyName: string, productId: null, product: object, name: string, description: string, materials: array<object>, additionalCosts: array<object>, materialsCost: number, additionalCostsTotal: number, totalCost: number, pricing: object, expectedDuration: null, quotationId: null, dueDate: null, _id: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "BOM created successfully",
  "data": {
    "userId": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "productId": null,
    "product": {
      "productId": "PRD-SE7MZU",
      "name": "Sitting Chair 1778138512071",
      "description": "V2 smoke test chair",
      "image": null
    },
    "name": "Sitting Chair BOM 1778138512071",
    "description": "Wood, nail, gum and spray based on material DB",
    "materials": [
      {
        "materialId": "69fc3d9d065936b6a83f6cc5",
        "name": "Sitting Chair 1778138512071",
        "category": "Wood",
        "subCategory": "Iroko",
        "unit": "Piece",
        "squareMeter": 0.6194,
        "price": 12000,
        "quantity": 1,
        "description": "Chair frame wood",
        "subtotal": 12000,
        "_more": "2 more field(s)"
      },
      {
        "materialId": "69fc3d9d065936b6a83f6a95",
        "name": "Sitting Chair 1778138512071",
        "category": "Nail",
        "subCategory": "Hammer",
        "unit": "bag",
        "squareMeter": 0,
        "price": 2500,
        "quantity": 1,
        "description": "Nails manually priced because DB has no price",
        "subtotal": 2500,
        "_more": "2 more field(s)"
      },
      "... 2 more item(s)"
    ],
    "additionalCosts": [
      {
        "name": "Workmanship",
        "amount": 15000,
        "_id": "69fc3dd2065936b6a83f7058"
      }
    ],
    "materialsCost": 70100,
    "additionalCostsTotal": 15000,
    "totalCost": 85100,
    "pricing": {
      "pricingMethod": null,
      "markupPercentage": 30,
      "materialsTotal": 70100,
      "additionalTotal": 15000,
      "overheadCost": 0,
      "costPrice": 85100,
      "sellingPrice": 110630
    },
    "expectedDuration": null,
    "quotationId": null,
    "dueDate": null,
    "_id": "69fc3dd2065936b6a83f7053",
    "createdAt": "2026-05-07T07:22:58.664Z",
    "updatedAt": "2026-05-07T07:22:58.892Z",
    "bomNumber": "BOM-0050",
    "__v": 0
  }
}
```

### GET /api/bom

Name: Get BOMs

Purpose: Lists company BOMs.

Auth: User token + active company

API call:

```http
GET /api/bom HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: array<object>, pagination: { page: number, limit: number, total: number, pages: number } }`.

Response JSON example:

```json
{
  "success": true,
  "data": [
    {
      "_id": "69fc3dd2065936b6a83f7053",
      "userId": "69fc3da0065936b6a83f6ccf",
      "product": {
        "productId": "PRD-SE7MZU",
        "name": "Sitting Chair 1778138512071",
        "description": "V2 smoke test chair",
        "image": null
      },
      "name": "Sitting Chair BOM 1778138512071",
      "description": "Wood, nail, gum and spray based on material DB",
      "materials": [
        {
          "calculation": {
            "mode": "area_based",
            "minimumUnits": 1,
            "billableUnits": 1,
            "pricePerSqm": 12916.69,
            "pricePerFullUnit": 12000,
            "totalMaterialCost": 12000
          },
          "materialId": "69fc3d9d065936b6a83f6cc5",
          "name": "Sitting Chair 1778138512071",
          "category": "Wood",
          "subCategory": "Iroko",
          "unit": "Piece",
          "squareMeter": 0.6194,
          "price": 12000,
          "quantity": 1,
          "description": "Chair frame wood",
          "_more": "2 more field(s)"
        },
        {
          "calculation": {
            "mode": "unit_based",
            "billableUnits": 1,
            "totalMaterialCost": 2500
          },
          "materialId": "69fc3d9d065936b6a83f6a95",
          "name": "Sitting Chair 1778138512071",
          "category": "Nail",
          "subCategory": "Hammer",
          "unit": "bag",
          "squareMeter": 0,
          "price": 2500,
          "quantity": 1,
          "description": "Nails manually priced because DB has no price",
          "_more": "2 more field(s)"
        },
        "... 2 more item(s)"
      ],
      "additionalCosts": [
        {
          "name": "Workmanship",
          "amount": 15000,
          "_id": "69fc3dd2065936b6a83f7058"
        }
      ],
      "materialsCost": 70100,
      "additionalCostsTotal": 15000,
      "totalCost": 85100,
      "pricing": {
        "pricingMethod": null,
        "markupPercentage": 30,
        "materialsTotal": 70100,
        "additionalTotal": 15000,
        "overheadCost": 0,
        "costPrice": 85100,
        "sellingPrice": 110630
      },
      "expectedDuration": null,
      "quotationId": null,
      "bomNumber": "BOM-0050",
      "dueDate": null,
      "createdAt": "2026-05-07T07:22:58.664Z",
      "updatedAt": "2026-05-07T07:22:58.892Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

### GET /api/bom/:id

Name: Get BOM by id

Purpose: Fetches one BOM.

Auth: User token + active company

API call:

```http
GET /api/bom/:id HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { product: object, pricing: object, expectedDuration: null, _id: string, userId: string, companyName: string, productId: null, name: string, description: string, materials: array<object>, additionalCosts: array<object>, materialsCost: number, additionalCostsTotal: number, totalCost: number, quotationId: null, dueDate: null, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "product": {
      "productId": "PRD-SE7MZU",
      "name": "Sitting Chair 1778138512071",
      "description": "V2 smoke test chair",
      "image": null
    },
    "pricing": {
      "pricingMethod": null,
      "markupPercentage": 30,
      "materialsTotal": 70100,
      "additionalTotal": 15000,
      "overheadCost": 0,
      "costPrice": 85100,
      "sellingPrice": 110630
    },
    "expectedDuration": null,
    "_id": "69fc3dd2065936b6a83f7053",
    "userId": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "productId": null,
    "name": "Sitting Chair BOM 1778138512071",
    "description": "Wood, nail, gum and spray based on material DB",
    "materials": [
      {
        "calculation": {
          "mode": "area_based",
          "minimumUnits": 1,
          "billableUnits": 1,
          "pricePerSqm": 12916.69,
          "pricePerFullUnit": 12000,
          "totalMaterialCost": 12000
        },
        "materialId": "69fc3d9d065936b6a83f6cc5",
        "name": "Sitting Chair 1778138512071",
        "category": "Wood",
        "subCategory": "Iroko",
        "unit": "Piece",
        "squareMeter": 0.6194,
        "price": 12000,
        "quantity": 1,
        "description": "Chair frame wood",
        "_more": "2 more field(s)"
      },
      {
        "calculation": {
          "mode": "unit_based",
          "billableUnits": 1,
          "totalMaterialCost": 2500
        },
        "materialId": "69fc3d9d065936b6a83f6a95",
        "name": "Sitting Chair 1778138512071",
        "category": "Nail",
        "subCategory": "Hammer",
        "unit": "bag",
        "squareMeter": 0,
        "price": 2500,
        "quantity": 1,
        "description": "Nails manually priced because DB has no price",
        "_more": "2 more field(s)"
      },
      "... 2 more item(s)"
    ],
    "additionalCosts": [
      {
        "name": "Workmanship",
        "amount": 15000,
        "_id": "69fc3dd2065936b6a83f7058"
      }
    ],
    "materialsCost": 70100,
    "additionalCostsTotal": 15000,
    "totalCost": 85100,
    "quotationId": null,
    "dueDate": null,
    "createdAt": "2026-05-07T07:22:58.664Z",
    "updatedAt": "2026-05-07T07:22:58.892Z",
    "bomNumber": "BOM-0050",
    "__v": 0
  }
}
```

## Quotations APIs

### POST /api/quotation

Name: Create quotation

Purpose: Creates a quotation and associated BOM snapshots.

Auth: User token + active company

API call:

```http
POST /api/quotation HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `clientName` | `string` | Sent in smoke run |
| `phoneNumber` | `string` | Sent in smoke run |
| `description` | `string` | Sent in smoke run |
| `items` | `array` | Sent in smoke run |
| `costPrice` | `number` | Sent in smoke run |
| `overheadCost` | `number` | Sent in smoke run |
| `discount` | `number` | Sent in smoke run |
| `boms` | `array` | Sent in smoke run |

Request JSON example:

```json
{
  "clientName": "V2 Customer",
  "phoneNumber": "+2348011111111",
  "description": "Quotation for sitting chair",
  "items": [
    {
      "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
      "width": 20,
      "length": 48,
      "unit": "inch",
      "squareMeter": 0.6194,
      "quantity": 1,
      "costPrice": 85100,
      "sellingPrice": 110630,
      "description": "Sitting chair complete material/workmanship package"
    }
  ],
  "costPrice": 85100,
  "overheadCost": 0,
  "discount": 0,
  "boms": [
    {
      "name": "Sitting Chair Quote BOM 1778138512071",
      "materials": [
        {
          "materialId": "69fc3d9d065936b6a83f6cc5",
          "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
          "category": "Wood",
          "subCategory": "Iroko",
          "unit": "Piece",
          "quantity": 1,
          "price": 12000,
          "squareMeter": 0.6194,
          "description": "Chair frame wood",
          "calculation": {
            "mode": "area_based",
            "minimumUnits": 1,
            "billableUnits": 1,
            "pricePerSqm": 12916.69,
            "pricePerFullUnit": 12000,
            "totalMaterialCost": 12000
          }
        },
        {
          "materialId": "69fc3d9d065936b6a83f6a95",
          "name": "Nail_ Hammer_0.5\"_ bag",
          "category": "Nail",
          "subCategory": "Hammer",
          "unit": "bag",
          "quantity": 1,
          "price": 2500,
          "squareMeter": 0,
          "description": "Nails manually priced because DB has no price",
          "calculation": {
            "mode": "unit_based",
            "billableUnits": 1,
            "totalMaterialCost": 2500
          }
        },
        "... 2 more item(s)"
      ],
      "additionalCosts": [
        {
          "name": "Workmanship",
          "amount": 15000
        }
      ],
      "pricing": {
        "markupPercentage": 30,
        "materialsTotal": 70100,
        "additionalTotal": 15000,
        "costPrice": 85100,
        "sellingPrice": 110630
      }
    }
  ]
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, message: string, data: { userId: string, companyName: string, clientName: string, phoneNumber: string, description: string, items: array<object>, expectedDuration: null, dueDate: null, costPrice: number, overheadCost: number, discount: number, totalCost: number, totalSellingPrice: number, discountAmount: number, finalTotal: number, status: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Quotation created successfully",
  "data": {
    "userId": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "clientName": "V2 Customer",
    "phoneNumber": "+2348011111111",
    "description": "Quotation for sitting chair",
    "items": [
      {
        "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
        "width": 20,
        "length": 48,
        "unit": "inch",
        "squareMeter": 0.6194,
        "quantity": 1,
        "costPrice": 85100,
        "sellingPrice": 110630,
        "description": "Sitting chair complete material/workmanship package",
        "_id": "69fc3dd5065936b6a83f7079"
      }
    ],
    "expectedDuration": null,
    "dueDate": null,
    "costPrice": 85100,
    "overheadCost": 0,
    "discount": 0,
    "totalCost": 85100,
    "totalSellingPrice": 85100,
    "discountAmount": 0,
    "finalTotal": 85100,
    "status": "sent",
    "_id": "69fc3dd5065936b6a83f7078",
    "createdAt": "2026-05-07T07:23:01.542Z",
    "updatedAt": "2026-05-07T07:23:01.542Z",
    "quotationNumber": "QT-00049",
    "__v": 0,
    "boms": [
      {
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "productId": null,
        "product": null,
        "name": "Quotation for sitting chair",
        "description": "Auto BOM for QT-00049",
        "materials": [
          {
            "name": "Sitting chair complete material/workmanship package",
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "foamType": null,
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "price": 85100,
            "quantity": 1,
            "description": "Sitting chair complete material/workmanship package",
            "_more": "2 more field(s)"
          }
        ],
        "additionalCosts": [],
        "materialsCost": 85100,
        "additionalCostsTotal": 0,
        "_more": "10 more field(s)"
      },
      {
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "productId": null,
        "product": null,
        "name": "Sitting Chair Quote BOM 1778138512071",
        "materials": [
          {
            "materialId": "69fc3d9d065936b6a83f6cc5",
            "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "category": "Wood",
            "subCategory": "Iroko",
            "unit": "Piece",
            "squareMeter": 0.6194,
            "price": 12000,
            "quantity": 1,
            "description": "Chair frame wood",
            "subtotal": 12000,
            "_more": "2 more field(s)"
          },
          {
            "materialId": "69fc3d9d065936b6a83f6a95",
            "name": "Nail_ Hammer_0.5\"_ bag",
            "category": "Nail",
            "subCategory": "Hammer",
            "unit": "bag",
            "squareMeter": 0,
            "price": 2500,
            "quantity": 1,
            "description": "Nails manually priced because DB has no price",
            "subtotal": 2500,
            "_more": "2 more field(s)"
          },
          "... 2 more item(s)"
        ],
        "additionalCosts": [
          {
            "name": "Workmanship",
            "amount": 15000,
            "_id": "69fc3dd6065936b6a83f7085"
          }
        ],
        "materialsCost": 70100,
        "additionalCostsTotal": 15000,
        "totalCost": 85100,
        "_more": "9 more field(s)"
      }
    ]
  }
}
```

### GET /api/quotation

Name: Get quotations

Purpose: Lists quotations for the active company.

Auth: User token + active company

API call:

```http
GET /api/quotation HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: array<object>, pagination: { page: number, limit: number, total: number, pages: number } }`.

Response JSON example:

```json
{
  "success": true,
  "data": [
    {
      "_id": "69fc3dd5065936b6a83f7078",
      "userId": "69fc3da0065936b6a83f6ccf",
      "companyName": "V2 Material Test Co 1778138512071",
      "clientName": "V2 Customer",
      "phoneNumber": "+2348011111111",
      "description": "Quotation for sitting chair",
      "items": [
        {
          "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
          "width": 20,
          "length": 48,
          "unit": "inch",
          "squareMeter": 0.6194,
          "quantity": 1,
          "costPrice": 85100,
          "sellingPrice": 110630,
          "description": "Sitting chair complete material/workmanship package",
          "_id": "69fc3dd5065936b6a83f7079"
        }
      ],
      "expectedDuration": null,
      "dueDate": null,
      "costPrice": 85100,
      "overheadCost": 0,
      "discount": 0,
      "totalCost": 85100,
      "totalSellingPrice": 85100,
      "discountAmount": 0,
      "finalTotal": 85100,
      "status": "sent",
      "createdAt": "2026-05-07T07:23:01.542Z",
      "updatedAt": "2026-05-07T07:23:01.542Z",
      "quotationNumber": "QT-00049",
      "__v": 0,
      "boms": [
        {
          "_id": "69fc3dd5065936b6a83f707c",
          "userId": "69fc3da0065936b6a83f6ccf",
          "companyName": "V2 Material Test Co 1778138512071",
          "productId": null,
          "product": null,
          "name": "Quotation for sitting chair",
          "description": "Auto BOM for QT-00049",
          "materials": [
            {
              "name": "Sitting chair complete material/workmanship package",
              "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
              "foamType": null,
              "width": 20,
              "length": 48,
              "unit": "inch",
              "squareMeter": 0.6194,
              "price": 85100,
              "quantity": 1,
              "description": "Sitting chair complete material/workmanship package",
              "_more": "2 more field(s)"
            }
          ],
          "additionalCosts": [],
          "materialsCost": 85100,
          "_more": "10 more field(s)"
        },
        {
          "_id": "69fc3dd6065936b6a83f7080",
          "userId": "69fc3da0065936b6a83f6ccf",
          "companyName": "V2 Material Test Co 1778138512071",
          "productId": null,
          "product": null,
          "name": "Sitting Chair Quote BOM 1778138512071",
          "materials": [
            {
              "materialId": "69fc3d9d065936b6a83f6cc5",
              "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
              "category": "Wood",
              "subCategory": "Iroko",
              "unit": "Piece",
              "squareMeter": 0.6194,
              "price": 12000,
              "quantity": 1,
              "description": "Chair frame wood",
              "subtotal": 12000,
              "_more": "2 more field(s)"
            },
            {
              "materialId": "69fc3d9d065936b6a83f6a95",
              "name": "Nail_ Hammer_0.5\"_ bag",
              "category": "Nail",
              "subCategory": "Hammer",
              "unit": "bag",
              "squareMeter": 0,
              "price": 2500,
              "quantity": 1,
              "description": "Nails manually priced because DB has no price",
              "subtotal": 2500,
              "_more": "2 more field(s)"
            },
            "... 2 more item(s)"
          ],
          "additionalCosts": [
            {
              "name": "Workmanship",
              "amount": 15000,
              "_id": "69fc3dd6065936b6a83f7085"
            }
          ],
          "materialsCost": 70100,
          "additionalCostsTotal": 15000,
          "_more": "9 more field(s)"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

### GET /api/quotation/:id

Name: Get quotation by id

Purpose: Fetches one quotation with BOMs.

Auth: User token + active company

API call:

```http
GET /api/quotation/:id HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { _id: string, userId: string, companyName: string, clientName: string, phoneNumber: string, description: string, items: array<object>, expectedDuration: null, dueDate: null, costPrice: number, overheadCost: number, discount: number, totalCost: number, totalSellingPrice: number, discountAmount: number, finalTotal: number, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "_id": "69fc3dd5065936b6a83f7078",
    "userId": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "clientName": "V2 Customer",
    "phoneNumber": "+2348011111111",
    "description": "Quotation for sitting chair",
    "items": [
      {
        "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
        "width": 20,
        "length": 48,
        "unit": "inch",
        "squareMeter": 0.6194,
        "quantity": 1,
        "costPrice": 85100,
        "sellingPrice": 110630,
        "description": "Sitting chair complete material/workmanship package",
        "_id": "69fc3dd5065936b6a83f7079"
      }
    ],
    "expectedDuration": null,
    "dueDate": null,
    "costPrice": 85100,
    "overheadCost": 0,
    "discount": 0,
    "totalCost": 85100,
    "totalSellingPrice": 85100,
    "discountAmount": 0,
    "finalTotal": 85100,
    "status": "sent",
    "createdAt": "2026-05-07T07:23:01.542Z",
    "updatedAt": "2026-05-07T07:23:01.542Z",
    "quotationNumber": "QT-00049",
    "__v": 0,
    "boms": [
      {
        "_id": "69fc3dd5065936b6a83f707c",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "productId": null,
        "product": null,
        "name": "Quotation for sitting chair",
        "description": "Auto BOM for QT-00049",
        "materials": [
          {
            "name": "Sitting chair complete material/workmanship package",
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "foamType": null,
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "price": 85100,
            "quantity": 1,
            "description": "Sitting chair complete material/workmanship package",
            "_more": "2 more field(s)"
          }
        ],
        "additionalCosts": [],
        "materialsCost": 85100,
        "_more": "10 more field(s)"
      },
      {
        "_id": "69fc3dd6065936b6a83f7080",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "productId": null,
        "product": null,
        "name": "Sitting Chair Quote BOM 1778138512071",
        "materials": [
          {
            "materialId": "69fc3d9d065936b6a83f6cc5",
            "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "category": "Wood",
            "subCategory": "Iroko",
            "unit": "Piece",
            "squareMeter": 0.6194,
            "price": 12000,
            "quantity": 1,
            "description": "Chair frame wood",
            "subtotal": 12000,
            "_more": "2 more field(s)"
          },
          {
            "materialId": "69fc3d9d065936b6a83f6a95",
            "name": "Nail_ Hammer_0.5\"_ bag",
            "category": "Nail",
            "subCategory": "Hammer",
            "unit": "bag",
            "squareMeter": 0,
            "price": 2500,
            "quantity": 1,
            "description": "Nails manually priced because DB has no price",
            "subtotal": 2500,
            "_more": "2 more field(s)"
          },
          "... 2 more item(s)"
        ],
        "additionalCosts": [
          {
            "name": "Workmanship",
            "amount": 15000,
            "_id": "69fc3dd6065936b6a83f7085"
          }
        ],
        "materialsCost": 70100,
        "additionalCostsTotal": 15000,
        "_more": "9 more field(s)"
      }
    ]
  }
}
```

## Invoices APIs

### POST /api/invoices/create

Name: Create invoice from quotation

Purpose: Converts a quotation to an invoice. Can generate/send a PDF invoice.

Auth: User token + active company

API call:

```http
POST /api/invoices/create HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `quotationId` | `string` | Sent in smoke run |
| `amountPaid` | `number` | Sent in smoke run |
| `notes` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "quotationId": "69fc3dd5065936b6a83f7078",
  "amountPaid": 0,
  "notes": "V2 invoice smoke test"
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, message: string, data: { userId: string, companyName: string, quotationId: string, quotationNumber: string, clientName: string, phoneNumber: string, description: string, items: array<object>, discount: number, totalCost: number, totalSellingPrice: number, discountAmount: number, finalTotal: number, amountPaid: number, balance: number, paymentStatus: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Invoice created successfully and sent via email",
  "data": {
    "userId": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "quotationId": "69fc3dd5065936b6a83f7078",
    "quotationNumber": "QT-00049",
    "clientName": "V2 Customer",
    "phoneNumber": "+2348011111111",
    "description": "Quotation for sitting chair",
    "items": [
      {
        "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
        "width": 20,
        "length": 48,
        "unit": "inch",
        "squareMeter": 0.6194,
        "quantity": 1,
        "costPrice": 85100,
        "sellingPrice": 110630,
        "description": "Sitting chair complete material/workmanship package",
        "_id": "69fc3dd5065936b6a83f7079"
      }
    ],
    "discount": 0,
    "totalCost": 85100,
    "totalSellingPrice": 85100,
    "discountAmount": 0,
    "finalTotal": 85100,
    "amountPaid": 0,
    "balance": 85100,
    "paymentStatus": "unpaid",
    "status": "pending",
    "dueDate": "2026-06-06T07:23:06.033Z",
    "notes": "V2 invoice smoke test",
    "_id": "69fc3dda065936b6a83f70a1",
    "createdAt": "2026-05-07T07:23:06.034Z",
    "updatedAt": "2026-05-07T07:23:06.034Z",
    "invoiceNumber": "INV-00021",
    "__v": 0
  }
}
```

### GET /api/invoices/invoices

Name: Get invoices

Purpose: Lists invoices.

Auth: User token + active company

API call:

```http
GET /api/invoices/invoices HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { invoices: array<object>, pagination: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Invoices fetched successfully",
  "data": {
    "invoices": [
      {
        "_id": "69fc3dda065936b6a83f70a1",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "quotationId": {
          "_id": "69fc3dd5065936b6a83f7078",
          "status": "sent",
          "quotationNumber": "QT-00049"
        },
        "quotationNumber": "QT-00049",
        "clientName": "V2 Customer",
        "phoneNumber": "+2348011111111",
        "description": "Quotation for sitting chair",
        "items": [
          {
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "quantity": 1,
            "costPrice": 85100,
            "sellingPrice": 110630,
            "description": "Sitting chair complete material/workmanship package",
            "_id": "69fc3dd5065936b6a83f7079"
          }
        ],
        "discount": 0,
        "_more": "14 more field(s)"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalInvoices": 1,
      "limit": 10
    }
  }
}
```

### GET /api/invoices/invoices/stats

Name: Get invoice stats

Purpose: Returns invoice totals and status counts.

Auth: User token + active company

API call:

```http
GET /api/invoices/invoices/stats HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { _id: null, totalInvoices: number, totalAmount: number, totalPaid: number, totalBalance: number, paidCount: number, unpaidCount: number, partialCount: number, pendingCount: number, overdueCount: number } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Invoice statistics fetched successfully",
  "data": {
    "_id": null,
    "totalInvoices": 1,
    "totalAmount": 85100,
    "totalPaid": 0,
    "totalBalance": 85100,
    "paidCount": 0,
    "unpaidCount": 1,
    "partialCount": 0,
    "pendingCount": 1,
    "overdueCount": 0
  }
}
```

## Orders APIs

### POST /api/orders/create

Name: Create order from quotation

Purpose: Converts a quotation with BOMs to an order.

Auth: User token + active company

API call:

```http
POST /api/orders/create HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `quotationId` | `string` | Sent in smoke run |
| `amountPaid` | `number` | Sent in smoke run |
| `notes` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "quotationId": "69fc3dd5065936b6a83f7078",
  "amountPaid": 10000,
  "notes": "V2 order smoke test"
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, message: string, data: { userId: string, companyName: string, quotationId: string, quotationNumber: string, clientName: string, phoneNumber: string, items: array<object>, boms: array<object>, bomIds: array<string>, discount: number, totalCost: number, totalSellingPrice: number, discountAmount: number, totalAmount: number, amountPaid: number, balance: number, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "userId": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "quotationId": "69fc3dd5065936b6a83f7078",
    "quotationNumber": "QT-00049",
    "clientName": "V2 Customer",
    "phoneNumber": "+2348011111111",
    "items": [
      {
        "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
        "width": 20,
        "length": 48,
        "unit": "inch",
        "squareMeter": 0.6194,
        "quantity": 1,
        "costPrice": 85100,
        "sellingPrice": 110630,
        "description": "Sitting chair complete material/workmanship package",
        "_id": "69fc3dd5065936b6a83f7079"
      }
    ],
    "boms": [
      {
        "bomId": "69fc3dd5065936b6a83f707c",
        "bomNumber": "BOM-0051",
        "name": "Quotation for sitting chair",
        "description": "Auto BOM for QT-00049",
        "materials": [
          {
            "name": "Sitting chair complete material/workmanship package",
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "foamType": null,
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "price": 85100,
            "quantity": 1,
            "description": "Sitting chair complete material/workmanship package",
            "_more": "2 more field(s)"
          }
        ],
        "additionalCosts": [],
        "materialsCost": 85100,
        "additionalCostsTotal": 0,
        "totalCost": 85100,
        "pricing": {
          "pricingMethod": null,
          "markupPercentage": 0,
          "materialsTotal": 85100,
          "additionalTotal": 0,
          "overheadCost": 0,
          "costPrice": 85100,
          "sellingPrice": 85100
        },
        "_more": "3 more field(s)"
      },
      {
        "bomId": "69fc3dd6065936b6a83f7080",
        "bomNumber": "BOM-0052",
        "name": "Sitting Chair Quote BOM 1778138512071",
        "materials": [
          {
            "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "unit": "Piece",
            "squareMeter": 0.6194,
            "price": 12000,
            "quantity": 1,
            "description": "Chair frame wood",
            "subtotal": 12000,
            "_id": "69fc3dd6065936b6a83f7081"
          },
          {
            "name": "Nail_ Hammer_0.5\"_ bag",
            "unit": "bag",
            "squareMeter": 0,
            "price": 2500,
            "quantity": 1,
            "description": "Nails manually priced because DB has no price",
            "subtotal": 2500,
            "_id": "69fc3dd6065936b6a83f7082"
          },
          "... 2 more item(s)"
        ],
        "additionalCosts": [
          {
            "name": "Workmanship",
            "amount": 15000,
            "_id": "69fc3dd6065936b6a83f7085"
          }
        ],
        "materialsCost": 70100,
        "additionalCostsTotal": 15000,
        "totalCost": 85100,
        "pricing": {
          "pricingMethod": null,
          "markupPercentage": 30,
          "materialsTotal": 70100,
          "additionalTotal": 15000,
          "overheadCost": 0,
          "costPrice": 85100,
          "sellingPrice": 110630
        },
        "expectedDuration": {
          "unit": "Day"
        },
        "_more": "2 more field(s)"
      }
    ],
    "bomIds": [
      "69fc3dd5065936b6a83f707c",
      "69fc3dd6065936b6a83f7080"
    ],
    "discount": 0,
    "totalCost": 85100,
    "totalSellingPrice": 85100,
    "discountAmount": 0,
    "totalAmount": 85100,
    "amountPaid": 10000,
    "balance": 75100,
    "currency": "NGN",
    "paymentStatus": "partial",
    "status": "pending",
    "notes": "V2 order smoke test",
    "description": "Quotation for sitting chair",
    "assignedTo": null,
    "assignedBy": null,
    "assignedAt": null,
    "_more": "8 more field(s)"
  }
}
```

### GET /api/orders/get-orders

Name: Get orders

Purpose: Lists orders.

Auth: Order permission + active company

API call:

```http
GET /api/orders/get-orders HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { orders: array<object>, pagination: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Orders fetched successfully",
  "data": {
    "orders": [
      {
        "_id": "69fc3dde065936b6a83f70ca",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "quotationId": {
          "_id": "69fc3dd5065936b6a83f7078",
          "status": "completed",
          "quotationNumber": "QT-00049"
        },
        "quotationNumber": "QT-00049",
        "clientName": "V2 Customer",
        "phoneNumber": "+2348011111111",
        "items": [
          {
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "quantity": 1,
            "costPrice": 85100,
            "sellingPrice": 110630,
            "description": "Sitting chair complete material/workmanship package",
            "_id": "69fc3dd5065936b6a83f7079"
          }
        ],
        "boms": [
          {
            "bomId": "69fc3dd5065936b6a83f707c",
            "bomNumber": "BOM-0051",
            "name": "Quotation for sitting chair",
            "description": "Auto BOM for QT-00049",
            "materials": [
              {
                "name": "Sitting chair complete material/workmanship package",
                "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
                "foamType": null,
                "width": 20,
                "length": 48,
                "unit": "inch",
                "squareMeter": 0.6194,
                "price": 85100,
                "quantity": 1,
                "description": "Sitting chair complete material/workmanship package",
                "_more": "2 more field(s)"
              }
            ],
            "additionalCosts": [],
            "materialsCost": 85100,
            "additionalCostsTotal": 0,
            "totalCost": 85100,
            "pricing": {
              "pricingMethod": null,
              "markupPercentage": 0,
              "materialsTotal": 85100,
              "additionalTotal": 0,
              "overheadCost": 0,
              "costPrice": 85100,
              "sellingPrice": 85100
            },
            "_more": "3 more field(s)"
          },
          {
            "bomId": "69fc3dd6065936b6a83f7080",
            "bomNumber": "BOM-0052",
            "name": "Sitting Chair Quote BOM 1778138512071",
            "materials": [
              {
                "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
                "unit": "Piece",
                "squareMeter": 0.6194,
                "price": 12000,
                "quantity": 1,
                "description": "Chair frame wood",
                "subtotal": 12000,
                "_id": "69fc3dd6065936b6a83f7081"
              },
              {
                "name": "Nail_ Hammer_0.5\"_ bag",
                "unit": "bag",
                "squareMeter": 0,
                "price": 2500,
                "quantity": 1,
                "description": "Nails manually priced because DB has no price",
                "subtotal": 2500,
                "_id": "69fc3dd6065936b6a83f7082"
              },
              "... 2 more item(s)"
            ],
            "additionalCosts": [
              {
                "name": "Workmanship",
                "amount": 15000,
                "_id": "69fc3dd6065936b6a83f7085"
              }
            ],
            "materialsCost": 70100,
            "additionalCostsTotal": 15000,
            "totalCost": 85100,
            "pricing": {
              "pricingMethod": null,
              "markupPercentage": 30,
              "materialsTotal": 70100,
              "additionalTotal": 15000,
              "overheadCost": 0,
              "costPrice": 85100,
              "sellingPrice": 110630
            },
            "expectedDuration": {
              "unit": "Day"
            },
            "_more": "2 more field(s)"
          }
        ],
        "bomIds": [
          "69fc3dd5065936b6a83f707c",
          "69fc3dd6065936b6a83f7080"
        ],
        "_more": "22 more field(s)"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalOrders": 1,
      "limit": 10
    }
  }
}
```

### GET /api/orders/stats

Name: Get order stats

Purpose: Returns order totals and status counts.

Auth: User token + active company

API call:

```http
GET /api/orders/stats HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { _id: null, totalOrders: number, totalRevenue: number, totalPaid: number, totalBalance: number, pendingCount: number, inProgressCount: number, completedCount: number, cancelledCount: number, unpaidCount: number, partialCount: number, paidCount: number } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Order statistics fetched successfully",
  "data": {
    "_id": null,
    "totalOrders": 1,
    "totalRevenue": 85100,
    "totalPaid": 10000,
    "totalBalance": 75100,
    "pendingCount": 1,
    "inProgressCount": 0,
    "completedCount": 0,
    "cancelledCount": 0,
    "unpaidCount": 0,
    "partialCount": 1,
    "paidCount": 0
  }
}
```

### GET /api/orders/get-orders/:id

Name: Get order by id

Purpose: Fetches one order.

Auth: User token + active company

API call:

```http
GET /api/orders/get-orders/:id HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { _id: string, userId: string, companyName: string, quotationId: object, quotationNumber: string, clientName: string, phoneNumber: string, items: array<object>, boms: array<object>, bomIds: array<string>, discount: number, totalCost: number, totalSellingPrice: number, discountAmount: number, totalAmount: number, amountPaid: number, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Order fetched successfully",
  "data": {
    "_id": "69fc3dde065936b6a83f70ca",
    "userId": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "quotationId": {
      "_id": "69fc3dd5065936b6a83f7078",
      "description": "Quotation for sitting chair",
      "status": "completed",
      "quotationNumber": "QT-00049"
    },
    "quotationNumber": "QT-00049",
    "clientName": "V2 Customer",
    "phoneNumber": "+2348011111111",
    "items": [
      {
        "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
        "width": 20,
        "length": 48,
        "unit": "inch",
        "squareMeter": 0.6194,
        "quantity": 1,
        "costPrice": 85100,
        "sellingPrice": 110630,
        "description": "Sitting chair complete material/workmanship package",
        "_id": "69fc3dd5065936b6a83f7079"
      }
    ],
    "boms": [
      {
        "pricing": {
          "pricingMethod": null,
          "markupPercentage": 0,
          "materialsTotal": 85100,
          "additionalTotal": 0,
          "overheadCost": 0,
          "costPrice": 85100,
          "sellingPrice": 85100
        },
        "expectedDuration": {
          "unit": "Day"
        },
        "bomId": "69fc3dd5065936b6a83f707c",
        "bomNumber": "BOM-0051",
        "name": "Quotation for sitting chair",
        "description": "Auto BOM for QT-00049",
        "materials": [
          {
            "name": "Sitting chair complete material/workmanship package",
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "foamType": null,
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "price": 85100,
            "quantity": 1,
            "description": "Sitting chair complete material/workmanship package",
            "_more": "2 more field(s)"
          }
        ],
        "additionalCosts": [],
        "materialsCost": 85100,
        "additionalCostsTotal": 0,
        "_more": "3 more field(s)"
      },
      {
        "pricing": {
          "pricingMethod": null,
          "markupPercentage": 30,
          "materialsTotal": 70100,
          "additionalTotal": 15000,
          "overheadCost": 0,
          "costPrice": 85100,
          "sellingPrice": 110630
        },
        "expectedDuration": {
          "unit": "Day"
        },
        "bomId": "69fc3dd6065936b6a83f7080",
        "bomNumber": "BOM-0052",
        "name": "Sitting Chair Quote BOM 1778138512071",
        "materials": [
          {
            "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "unit": "Piece",
            "squareMeter": 0.6194,
            "price": 12000,
            "quantity": 1,
            "description": "Chair frame wood",
            "subtotal": 12000,
            "_id": "69fc3dd6065936b6a83f7081"
          },
          {
            "name": "Nail_ Hammer_0.5\"_ bag",
            "unit": "bag",
            "squareMeter": 0,
            "price": 2500,
            "quantity": 1,
            "description": "Nails manually priced because DB has no price",
            "subtotal": 2500,
            "_id": "69fc3dd6065936b6a83f7082"
          },
          "... 2 more item(s)"
        ],
        "additionalCosts": [
          {
            "name": "Workmanship",
            "amount": 15000,
            "_id": "69fc3dd6065936b6a83f7085"
          }
        ],
        "materialsCost": 70100,
        "additionalCostsTotal": 15000,
        "totalCost": 85100,
        "_more": "2 more field(s)"
      }
    ],
    "bomIds": [
      "69fc3dd5065936b6a83f707c",
      "69fc3dd6065936b6a83f7080"
    ],
    "discount": 0,
    "totalCost": 85100,
    "totalSellingPrice": 85100,
    "discountAmount": 0,
    "totalAmount": 85100,
    "amountPaid": 10000,
    "balance": 75100,
    "currency": "NGN",
    "paymentStatus": "partial",
    "status": "pending",
    "notes": "V2 order smoke test",
    "description": "Quotation for sitting chair",
    "assignedTo": null,
    "assignedBy": null,
    "_more": "8 more field(s)"
  }
}
```

### GET /api/orders/get-orders/:id/receipt

Name: Get order receipt

Purpose: Returns receipt-ready data for an order.

Auth: User token + active company

API call:

```http
GET /api/orders/get-orders/:id/receipt HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { orderNumber: string, orderDate: string, quotationNumber: string, client: object, business: object, items: array<object>, boms: array<object>, service: object, discount: number, discountAmount: number, totalCost: number, totalSellingPrice: number, totalAmount: number, amountPaid: number, balance: number, currency: string, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Order receipt data fetched successfully",
  "data": {
    "orderNumber": "0019",
    "orderDate": "2026-05-07T07:23:10.551Z",
    "quotationNumber": "QT-00049",
    "client": {
      "name": "V2 Customer",
      "phone": "+2348011111111"
    },
    "business": {
      "name": "Woodworker",
      "phone": "+2348038512071",
      "email": "v2.owner.1778138512071@example.com"
    },
    "items": [
      {
        "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
        "width": 20,
        "length": 48,
        "unit": "inch",
        "squareMeter": 0.6194,
        "quantity": 1,
        "costPrice": 85100,
        "sellingPrice": 110630,
        "description": "Sitting chair complete material/workmanship package",
        "_id": "69fc3dd5065936b6a83f7079"
      }
    ],
    "boms": [
      {
        "pricing": {
          "pricingMethod": null,
          "markupPercentage": 0,
          "materialsTotal": 85100,
          "additionalTotal": 0,
          "overheadCost": 0,
          "costPrice": 85100,
          "sellingPrice": 85100
        },
        "expectedDuration": {
          "unit": "Day"
        },
        "bomId": "69fc3dd5065936b6a83f707c",
        "bomNumber": "BOM-0051",
        "name": "Quotation for sitting chair",
        "description": "Auto BOM for QT-00049",
        "materials": [
          {
            "name": "Sitting chair complete material/workmanship package",
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "foamType": null,
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "price": 85100,
            "quantity": 1,
            "description": "Sitting chair complete material/workmanship package",
            "_more": "2 more field(s)"
          }
        ],
        "additionalCosts": [],
        "materialsCost": 85100,
        "additionalCostsTotal": 0,
        "_more": "3 more field(s)"
      },
      {
        "pricing": {
          "pricingMethod": null,
          "markupPercentage": 30,
          "materialsTotal": 70100,
          "additionalTotal": 15000,
          "overheadCost": 0,
          "costPrice": 85100,
          "sellingPrice": 110630
        },
        "expectedDuration": {
          "unit": "Day"
        },
        "bomId": "69fc3dd6065936b6a83f7080",
        "bomNumber": "BOM-0052",
        "name": "Sitting Chair Quote BOM 1778138512071",
        "materials": [
          {
            "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "unit": "Piece",
            "squareMeter": 0.6194,
            "price": 12000,
            "quantity": 1,
            "description": "Chair frame wood",
            "subtotal": 12000,
            "_id": "69fc3dd6065936b6a83f7081"
          },
          {
            "name": "Nail_ Hammer_0.5\"_ bag",
            "unit": "bag",
            "squareMeter": 0,
            "price": 2500,
            "quantity": 1,
            "description": "Nails manually priced because DB has no price",
            "subtotal": 2500,
            "_id": "69fc3dd6065936b6a83f7082"
          },
          "... 2 more item(s)"
        ],
        "additionalCosts": [
          {
            "name": "Workmanship",
            "amount": 15000,
            "_id": "69fc3dd6065936b6a83f7085"
          }
        ],
        "materialsCost": 70100,
        "additionalCostsTotal": 15000,
        "totalCost": 85100,
        "_more": "2 more field(s)"
      }
    ],
    "service": {},
    "discount": 0,
    "discountAmount": 0,
    "totalCost": 85100,
    "totalSellingPrice": 85100,
    "totalAmount": 85100,
    "amountPaid": 10000,
    "balance": 75100,
    "currency": "NGN",
    "paymentStatus": "partial",
    "status": "pending",
    "notes": "V2 order smoke test",
    "payments": []
  }
}
```

## Sales APIs

### GET /api/sales/get-clients

Name: Get sales clients

Purpose: Returns clients derived from sales/quotation records.

Auth: Sales permission + active company

API call:

```http
GET /api/sales/get-clients HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: array<object> }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Clients fetched successfully",
  "data": [
    {
      "clientName": "V2 Customer",
      "phoneNumber": "+2348011111111",
      "email": null,
      "clientAddress": null,
      "nearestBusStop": null
    }
  ]
}
```

### GET /api/sales/get-sales

Name: Get sales analytics

Purpose: Returns sales metrics and charts.

Auth: Sales permission + active company

API call:

```http
GET /api/sales/get-sales HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { period: string, metrics: object, salesPerformance: array<object>, projectTypes: array<object>, performanceSummary: object, paymentDistribution: array<object>, topCustomers: array<object> } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Sales analytics fetched successfully",
  "data": {
    "period": "daily",
    "metrics": {
      "revenue": {
        "total": 85100,
        "change": 0
      },
      "projects": {
        "total": 1,
        "change": 0
      },
      "customers": {
        "total": 1,
        "avgRevenuePerCustomer": 85100
      },
      "profit": {
        "total": 0,
        "margin": 0
      }
    },
    "salesPerformance": [
      {
        "revenue": 85100,
        "orders": 1,
        "period": "2026-05-07"
      }
    ],
    "projectTypes": [
      {
        "count": 1,
        "revenue": 110630,
        "type": "Wood_Iroko_1\"x10\"x144\"_Piece",
        "percentage": 100
      }
    ],
    "performanceSummary": {
      "averageProjectValue": 85100,
      "projectsPerCustomer": 1,
      "revenuePerCustomer": 85100
    },
    "paymentDistribution": [
      {
        "count": 1,
        "totalAmount": 85100,
        "paidAmount": 10000,
        "status": "partial"
      }
    ],
    "topCustomers": [
      {
        "totalRevenue": 85100,
        "totalOrders": 1,
        "email": null,
        "phone": "+2348011111111",
        "name": "V2 Customer"
      }
    ]
  }
}
```

### GET /api/sales/get-inventory

Name: Get inventory status

Purpose: Returns product/order inventory status.

Auth: Sales or order permission + active company

API call:

```http
GET /api/sales/get-inventory HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: array<object> }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Inventory status fetched successfully",
  "data": [
    {
      "material": "Wood_Iroko_1\"x10\"x144\"_Piece",
      "used": 1
    }
  ]
}
```

## Overhead Costs APIs

### POST /api/oc/create-oc

Name: Create overhead cost

Purpose: Creates an overhead cost item.

Auth: User token + active company

API call:

```http
POST /api/oc/create-oc HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `category` | `string` | Sent in smoke run |
| `description` | `string` | Sent in smoke run |
| `period` | `string` | Sent in smoke run |
| `cost` | `number` | Sent in smoke run |

Request JSON example:

```json
{
  "category": "Others",
  "description": "V2 smoke overhead",
  "period": "Daily",
  "cost": 1000
}
```

Tested response: `201` (success).

Response shape: `{ success: boolean, message: string, data: { user: string, companyName: string, category: string, description: string, period: string, cost: number, createdBy: string, _id: string, createdAt: string, updatedAt: string, __v: number } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Overhead cost created successfully",
  "data": {
    "user": "69fc3da0065936b6a83f6ccf",
    "companyName": "V2 Material Test Co 1778138512071",
    "category": "Others",
    "description": "V2 smoke overhead",
    "period": "Daily",
    "cost": 1000,
    "createdBy": "69fc3da0065936b6a83f6ccf",
    "_id": "69fc3de7065936b6a83f712a",
    "createdAt": "2026-05-07T07:23:19.863Z",
    "updatedAt": "2026-05-07T07:23:19.863Z",
    "__v": 0
  }
}
```

### GET /api/oc/get-oc

Name: Get overhead costs

Purpose: Lists overhead costs for the active company.

Auth: User token + active company

API call:

```http
GET /api/oc/get-oc HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, count: number, data: array<object> }`.

Response JSON example:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "69fc3de7065936b6a83f712a",
      "user": "69fc3da0065936b6a83f6ccf",
      "companyName": "V2 Material Test Co 1778138512071",
      "category": "Others",
      "description": "V2 smoke overhead",
      "period": "Daily",
      "cost": 1000,
      "createdBy": "69fc3da0065936b6a83f6ccf",
      "createdAt": "2026-05-07T07:23:19.863Z",
      "updatedAt": "2026-05-07T07:23:19.863Z",
      "__v": 0
    }
  ]
}
```

## Notifications APIs

### GET /api/notifications

Name: Get notifications

Purpose: Lists notifications for current user and active company.

Auth: User token + active company

API call:

```http
GET /api/notifications HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { notifications: array<object>, pagination: object, unreadCount: number } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Notifications fetched successfully",
  "data": {
    "notifications": [
      {
        "_id": "69fc3dc6065936b6a83f6fec",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "type": "material_rejected",
        "title": "Material Rejected",
        "message": "Your material \"V2 Reject Material 1778138512071\" was rejected: Rejected by v2 smoke test",
        "performedBy": {
          "_id": "6964b6078c3ced74787860b5",
          "fullname": "Platform Admin",
          "email": "admin@woodworker.com"
        },
        "performedByName": "Platform Admin",
        "isRead": false,
        "metadata": {
          "materialId": "69fc3db2065936b6a83f6f95",
          "materialName": "V2 Reject Material 1778138512071",
          "reason": "Rejected by v2 smoke test"
        },
        "_more": "3 more field(s)"
      },
      {
        "_id": "69fc3dbf065936b6a83f6fdf",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "type": "material_approved",
        "title": "Material Approved",
        "message": "Your material \"V2 Approval Material 1778138512071\" has been approved",
        "performedBy": {
          "_id": "6964b6078c3ced74787860b5",
          "fullname": "Platform Admin",
          "email": "admin@woodworker.com"
        },
        "performedByName": "Platform Admin",
        "isRead": false,
        "metadata": {
          "materialId": "69fc3db0065936b6a83f6f88",
          "materialName": "V2 Approval Material 1778138512071"
        },
        "_more": "3 more field(s)"
      },
      "... 1 more item(s)"
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "pages": 1
    },
    "unreadCount": 3
  }
}
```

### GET /api/notifications/unread-count

Name: Get notification unread count

Purpose: Returns unread notification count.

Auth: User token + active company

API call:

```http
GET /api/notifications/unread-count HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { count: number } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Unread count fetched",
  "data": {
    "count": 3
  }
}
```

## Database Management APIs

### PUT /api/database/materials/pricing/type

Name: Database update material type pricing

Purpose: Bulk-updates pricing for a category/subcategory/unit scope.

Auth: Owner/admin token + active company

API call:

```http
PUT /api/database/materials/pricing/type HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `category` | `string` | Sent in smoke run |
| `subCategory` | `string` | Sent in smoke run |
| `unit` | `string` | Sent in smoke run |
| `pricePerUnit` | `number` | Sent in smoke run |
| `pricingUnit` | `string` | Sent in smoke run |
| `onlyUnpriced` | `boolean` | Sent in smoke run |

Request JSON example:

```json
{
  "category": "Paint",
  "subCategory": "Auto base",
  "unit": "Piece",
  "pricePerUnit": 1300,
  "pricingUnit": "piece",
  "onlyUnpriced": false
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { matched: number, modified: number, scope: object, update: object, examples: array<object> } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Material type pricing updated successfully",
  "data": {
    "matched": 1,
    "modified": 1,
    "scope": {
      "companyName": "V2 Material Test Co 1778138512071",
      "category": "Paint",
      "subCategory": "Auto base",
      "unit": "Piece",
      "onlyUnpriced": false,
      "resolvedFromMaterialId": null
    },
    "update": {
      "pricePerUnit": 1300,
      "pricingUnit": "piece"
    },
    "examples": [
      {
        "_id": "69fc3db3065936b6a83f6fa2",
        "companyName": "V2 Material Test Co 1778138512071",
        "name": "V2 Mutable Material 1778138512071",
        "category": "Paint",
        "subCategory": "Auto base",
        "catalogPrice": 1250,
        "pricePerSqm": null,
        "pricePerUnit": 1300,
        "pricingUnit": "piece",
        "unit": "Piece"
      }
    ]
  }
}
```

### PUT /api/database/materials/:id

Name: Database update single material

Purpose: Updates one material record.

Auth: User token + active company

API call:

```http
PUT /api/database/materials/:id HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `notes` | `string` | Sent in smoke run |
| `pricePerUnit` | `number` | Sent in smoke run |
| `pricingUnit` | `string` | Sent in smoke run |
| `isActive` | `boolean` | Sent in smoke run |

Request JSON example:

```json
{
  "notes": "Updated by database material smoke test",
  "pricePerUnit": 1400,
  "pricingUnit": "piece",
  "isActive": true
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { _id: string, companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: null, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Material updated successfully",
  "data": {
    "_id": "69fc3db3065936b6a83f6fa2",
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:27.450Z",
        "_id": "69fc3db3065936b6a83f6fa3"
      }
    ],
    "name": "V2 Mutable Material 1778138512071",
    "category": "Paint",
    "subCategory": "Auto base",
    "size": "",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": 1250,
    "isCatalogMaterial": false,
    "isCatalogPriced": true,
    "image": null,
    "standardUnit": "inches",
    "pricePerSqm": null,
    "_more": "17 more field(s)"
  }
}
```

### DELETE /api/database/materials/:id

Name: Database delete test material

Purpose: Deletes one test material.

Auth: User token + active company

API call:

```http
DELETE /api/database/materials/:id HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: object }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Material deleted successfully",
  "data": {}
}
```

### DELETE /api/database/materials/:id

Name: Database delete uploaded material

Purpose: Deletes the multipart uploaded test material.

Auth: User token + active company

API call:

```http
DELETE /api/database/materials/:id HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: object }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Material deleted successfully",
  "data": {}
}
```

### DELETE /api/database/materials/:id

Name: Database delete custom wood material

Purpose: Deletes the custom Wood test material.

Auth: User token + active company

API call:

```http
DELETE /api/database/materials/:id HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: object }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Material deleted successfully",
  "data": {}
}
```

### DELETE /api/database/materials/:id

Name: Database delete custom board material

Purpose: Deletes the custom Board test material.

Auth: User token + active company

API call:

```http
DELETE /api/database/materials/:id HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: object }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Material deleted successfully",
  "data": {}
}
```

### GET /api/database/quotations

Name: Database quotations

Purpose: Database view of quotations.

Auth: User token + active company

API call:

```http
GET /api/database/quotations HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { data: array<object>, pagination: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Quotations fetched successfully",
  "data": {
    "data": [
      {
        "expectedDuration": null,
        "_id": "69fc3dd5065936b6a83f7078",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "clientName": "V2 Customer",
        "phoneNumber": "+2348011111111",
        "description": "Quotation for sitting chair",
        "items": [
          {
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "quantity": 1,
            "costPrice": 85100,
            "sellingPrice": 110630,
            "description": "Sitting chair complete material/workmanship package",
            "_id": "69fc3dd5065936b6a83f7079"
          }
        ],
        "dueDate": null,
        "costPrice": 85100,
        "_more": "11 more field(s)"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "pages": 1
    }
  }
}
```

### GET /api/database/boms

Name: Database BOMs

Purpose: Database view of BOMs.

Auth: User token + active company

API call:

```http
GET /api/database/boms HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { data: array<object>, pagination: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "BOMs fetched successfully",
  "data": {
    "data": [
      {
        "product": null,
        "pricing": {
          "pricingMethod": null,
          "markupPercentage": 30,
          "materialsTotal": 70100,
          "additionalTotal": 15000,
          "overheadCost": 0,
          "costPrice": 85100,
          "sellingPrice": 110630
        },
        "expectedDuration": {
          "unit": "Day"
        },
        "_id": "69fc3dd6065936b6a83f7080",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "productId": null,
        "name": "Sitting Chair Quote BOM 1778138512071",
        "materials": [
          {
            "calculation": {
              "mode": "area_based",
              "minimumUnits": 1,
              "billableUnits": 1,
              "pricePerSqm": 12916.69,
              "pricePerFullUnit": 12000,
              "totalMaterialCost": 12000
            },
            "materialId": "69fc3d9d065936b6a83f6cc5",
            "name": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "category": "Wood",
            "subCategory": "Iroko",
            "unit": "Piece",
            "squareMeter": 0.6194,
            "price": 12000,
            "quantity": 1,
            "description": "Chair frame wood",
            "_more": "2 more field(s)"
          },
          {
            "calculation": {
              "mode": "unit_based",
              "billableUnits": 1,
              "totalMaterialCost": 2500
            },
            "materialId": "69fc3d9d065936b6a83f6a95",
            "name": "Nail_ Hammer_0.5\"_ bag",
            "category": "Nail",
            "subCategory": "Hammer",
            "unit": "bag",
            "squareMeter": 0,
            "price": 2500,
            "quantity": 1,
            "description": "Nails manually priced because DB has no price",
            "_more": "2 more field(s)"
          },
          "... 2 more item(s)"
        ],
        "additionalCosts": [
          {
            "name": "Workmanship",
            "amount": 15000,
            "_id": "69fc3dd6065936b6a83f7085"
          }
        ],
        "_more": "9 more field(s)"
      },
      {
        "product": null,
        "pricing": {
          "pricingMethod": null,
          "markupPercentage": 0,
          "materialsTotal": 85100,
          "additionalTotal": 0,
          "overheadCost": 0,
          "costPrice": 85100,
          "sellingPrice": 85100
        },
        "expectedDuration": {
          "unit": "Day"
        },
        "_id": "69fc3dd5065936b6a83f707c",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "productId": null,
        "name": "Quotation for sitting chair",
        "description": "Auto BOM for QT-00049",
        "materials": [
          {
            "name": "Sitting chair complete material/workmanship package",
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "foamType": null,
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "price": 85100,
            "quantity": 1,
            "description": "Sitting chair complete material/workmanship package",
            "_more": "2 more field(s)"
          }
        ],
        "_more": "10 more field(s)"
      },
      "... 1 more item(s)"
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 3,
      "pages": 1
    }
  }
}
```

### GET /api/database/clients

Name: Database clients

Purpose: Database view of clients.

Auth: User token + active company

API call:

```http
GET /api/database/clients HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: array<object> }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Clients fetched successfully",
  "data": [
    {
      "companyName": "V2 Material Test Co 1778138512071",
      "clientName": "V2 Customer",
      "phoneNumber": "+2348011111111",
      "email": null,
      "clientAddress": null,
      "nearestBusStop": null
    }
  ]
}
```

### GET /api/database/staff

Name: Database staff

Purpose: Database view of staff.

Auth: User token + active company

API call:

```http
GET /api/database/staff HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: array<object> }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Staff fetched successfully",
  "data": [
    {
      "id": "69fc3da0065936b6a83f6ccf",
      "fullname": "V2 Material Owner",
      "email": "v2.owner.1778138512071@example.com",
      "phoneNumber": "+2348038512071",
      "role": "owner",
      "position": "Owner",
      "accessGranted": true,
      "permissions": {
        "quotation": true,
        "sales": true,
        "order": true,
        "database": true,
        "receipts": true,
        "backupAlerts": true,
        "invoice": true,
        "products": true,
        "boms": true
      },
      "joinedAt": "2026-05-07T07:22:08.594Z"
    }
  ]
}
```

### GET /api/database/products

Name: Database products

Purpose: Database view of products.

Auth: User token + active company

API call:

```http
GET /api/database/products HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { data: array<object>, pagination: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": {
    "data": [
      {
        "_id": "69fc3dcf065936b6a83f7038",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "name": "Sitting Chair 1778138512071",
        "productId": "PRD-SE7MZU",
        "category": "Furniture",
        "subCategory": "Chair",
        "description": "V2 smoke test chair",
        "image": null,
        "isGlobal": false,
        "_more": "11 more field(s)"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "pages": 1
    }
  }
}
```

### GET /api/database/materials

Name: Database materials

Purpose: Database view of materials.

Auth: User token + active company

API call:

```http
GET /api/database/materials HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { data: array<object>, pagination: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Materials fetched successfully",
  "data": {
    "data": [
      {
        "_id": "69fc3db2065936b6a83f6f95",
        "companyName": "V2 Material Test Co 1778138512071",
        "isGlobal": false,
        "status": "rejected",
        "approvedBy": null,
        "approvedAt": null,
        "rejectionReason": "Rejected by v2 smoke test",
        "submittedBy": "69fc3da0065936b6a83f6ccf",
        "resubmissionCount": 0,
        "approvalHistory": [
          {
            "action": "submitted",
            "performedBy": "69fc3da0065936b6a83f6ccf",
            "performedByName": "V2 Material Owner",
            "reason": "Initial submission",
            "timestamp": "2026-05-07T07:22:26.078Z",
            "_id": "69fc3db2065936b6a83f6f96"
          },
          {
            "action": "rejected",
            "performedBy": "6964b6078c3ced74787860b5",
            "performedByName": "Platform Admin",
            "reason": "Rejected by v2 smoke test",
            "timestamp": "2026-05-07T07:22:40.739Z",
            "_id": "69fc3dc0065936b6a83f6fe8"
          }
        ],
        "_more": "31 more field(s)"
      },
      {
        "_id": "69fc3db0065936b6a83f6f88",
        "companyName": "V2 Material Test Co 1778138512071",
        "isGlobal": false,
        "status": "approved",
        "approvedBy": "6964b6078c3ced74787860b5",
        "approvedAt": "2026-05-07T07:22:33.988Z",
        "rejectionReason": null,
        "submittedBy": "69fc3da0065936b6a83f6ccf",
        "resubmissionCount": 0,
        "approvalHistory": [
          {
            "action": "submitted",
            "performedBy": "69fc3da0065936b6a83f6ccf",
            "performedByName": "V2 Material Owner",
            "reason": "Initial submission",
            "timestamp": "2026-05-07T07:22:24.801Z",
            "_id": "69fc3db0065936b6a83f6f89"
          },
          {
            "action": "approved",
            "performedBy": "6964b6078c3ced74787860b5",
            "performedByName": "Platform Admin",
            "reason": "Approved by v2 smoke test",
            "timestamp": "2026-05-07T07:22:33.988Z",
            "_id": "69fc3db9065936b6a83f6fdb"
          }
        ],
        "_more": "31 more field(s)"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2,
      "pages": 1
    }
  }
}
```

### GET /api/database/invoices

Name: Database invoices

Purpose: Database view of invoices.

Auth: User token + active company

API call:

```http
GET /api/database/invoices HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { data: array<object>, pagination: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Invoices fetched successfully",
  "data": {
    "data": [
      {
        "_id": "69fc3dda065936b6a83f70a1",
        "userId": "69fc3da0065936b6a83f6ccf",
        "companyName": "V2 Material Test Co 1778138512071",
        "quotationId": "69fc3dd5065936b6a83f7078",
        "quotationNumber": "QT-00049",
        "clientName": "V2 Customer",
        "phoneNumber": "+2348011111111",
        "description": "Quotation for sitting chair",
        "items": [
          {
            "woodType": "Wood_Iroko_1\"x10\"x144\"_Piece",
            "width": 20,
            "length": 48,
            "unit": "inch",
            "squareMeter": 0.6194,
            "quantity": 1,
            "costPrice": 85100,
            "sellingPrice": 110630,
            "description": "Sitting chair complete material/workmanship package",
            "_id": "69fc3dd5065936b6a83f7079"
          }
        ],
        "discount": 0,
        "_more": "14 more field(s)"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "pages": 1
    }
  }
}
```

### GET /api/database/receipts

Name: Database receipts

Purpose: Database view of receipts.

Auth: User token + active company

API call:

```http
GET /api/database/receipts HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { data: array, pagination: object } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Receipts fetched successfully",
  "data": {
    "data": [],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 0,
      "pages": 0
    }
  }
}
```

## Platform Owner APIs

### GET /api/platform/dashboard/stats

Name: Platform dashboard stats

Purpose: Loads high-level platform dashboard counts and recent pending activity.

Auth: Platform owner token

API call:

```http
GET /api/platform/dashboard/stats HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { stats: object, recentActivity: object } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "stats": {
      "companies": {
        "total": 5,
        "active": 5,
        "inactive": 0
      },
      "products": {
        "total": 32,
        "pending": 24,
        "global": 0,
        "companyProducts": 32
      },
      "orders": 18,
      "quotations": 48,
      "users": 22
    },
    "recentActivity": {
      "pendingProducts": [
        {
          "_id": "69fa068c4c2b49b464e493f6",
          "userId": "69fa06624c2b49b464e4908d",
          "companyName": "V2 Material Test Co 1777993308603",
          "name": "Sitting Chair 1777993308603",
          "productId": "PRD-J8HZ6O",
          "category": "Furniture",
          "subCategory": "Chair",
          "description": "V2 smoke test chair",
          "image": null,
          "isGlobal": false,
          "_more": "11 more field(s)"
        },
        {
          "_id": "69fa06144c2b49b464e48c81",
          "userId": "69fa05ee4c2b49b464e4894c",
          "companyName": "V2 Material Test Co 1777993185236",
          "name": "Sitting Chair 1777993185236",
          "productId": "PRD-VCXJTU",
          "category": "Furniture",
          "subCategory": "Chair",
          "description": "V2 smoke test chair",
          "image": null,
          "isGlobal": false,
          "_more": "11 more field(s)"
        },
        "... 3 more item(s)"
      ],
      "recentCompanies": [
        {
          "_id": "69763e439e6c1215573aec16",
          "name": "TestCo",
          "email": "testco@example.com",
          "owner": {
            "_id": "69763e399e6c1215573aec13",
            "fullname": "Test User",
            "email": "testuser_local@example.com"
          },
          "isActive": true,
          "createdAt": "2026-01-25T16:01:07.358Z",
          "updatedAt": "2026-01-25T16:01:07.358Z",
          "__v": 0
        },
        {
          "_id": "69657871257e4747714afab0",
          "name": "Zillow",
          "email": "macsonline500@gmail.com",
          "phoneNumber": "08110947817",
          "address": "No 22 Heritage estate Ibadan.",
          "owner": {
            "_id": "6964b6078c3ced74787860b5",
            "fullname": "Platform Admin",
            "email": "admin@woodworker.com"
          },
          "isActive": true,
          "createdAt": "2026-01-12T22:40:49.031Z",
          "updatedAt": "2026-01-12T22:40:49.031Z",
          "__v": 0
        },
        "... 3 more item(s)"
      ]
    }
  }
}
```

### POST /api/platform/materials/reseed-from-catalog

Name: Reseed materials from material DB catalog

Purpose: Deletes current global material rows and recreates them from the material database CSV export.

Auth: Platform owner token

Warning: Destructive operation. Only call from admin tooling after explicit confirmation.

API call:

```http
POST /api/platform/materials/reseed-from-catalog HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `confirm` | `boolean` | Sent in smoke run |

Request JSON example:

```json
{
  "confirm": true
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { deletedMaterials: number, insertedMaterials: number, pricedMaterials: number, unpricedMaterials: number } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Materials reseeded successfully from catalog",
  "data": {
    "deletedMaterials": 306,
    "insertedMaterials": 304,
    "pricedMaterials": 85,
    "unpricedMaterials": 219
  }
}
```

### PATCH /api/platform/materials/:materialId/price

Name: Platform update company material price

Purpose: Updates material pricing from platform-owner tooling.

Auth: Platform owner token

API call:

```http
PATCH /api/platform/materials/:materialId/price HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `pricePerUnit` | `number` | Sent in smoke run |
| `catalogPrice` | `number` | Sent in smoke run |
| `pricingUnit` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "pricePerUnit": 1250,
  "catalogPrice": 1250,
  "pricingUnit": "piece"
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { _id: string, companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: null, submittedBy: string, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: null, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Material price updated successfully",
  "data": {
    "_id": "69fc3db3065936b6a83f6fa2",
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "submittedBy": "69fc3da0065936b6a83f6ccf",
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:27.450Z",
        "_id": "69fc3db3065936b6a83f6fa3"
      }
    ],
    "name": "V2 Mutable Material 1778138512071",
    "category": "Paint",
    "subCategory": "Auto base",
    "size": "",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": 1250,
    "isCatalogMaterial": false,
    "isCatalogPriced": true,
    "image": null,
    "standardUnit": "inches",
    "pricePerSqm": null,
    "_more": "17 more field(s)"
  }
}
```

### PATCH /api/platform/materials/:materialId/approve

Name: Platform approve pending material

Purpose: Approves a pending material.

Auth: Platform owner token

API call:

```http
PATCH /api/platform/materials/:materialId/approve HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `notes` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "notes": "Approved by v2 smoke test"
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { _id: string, companyName: string, isGlobal: boolean, status: string, approvedBy: string, approvedAt: string, rejectionReason: null, submittedBy: object, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: null, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Material approved successfully",
  "data": {
    "_id": "69fc3db0065936b6a83f6f88",
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "approved",
    "approvedBy": "6964b6078c3ced74787860b5",
    "approvedAt": "2026-05-07T07:22:33.988Z",
    "rejectionReason": null,
    "submittedBy": {
      "_id": "69fc3da0065936b6a83f6ccf",
      "fullname": "V2 Material Owner",
      "email": "v2.owner.1778138512071@example.com"
    },
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:24.801Z",
        "_id": "69fc3db0065936b6a83f6f89"
      },
      {
        "action": "approved",
        "performedBy": "6964b6078c3ced74787860b5",
        "performedByName": "Platform Admin",
        "reason": "Approved by v2 smoke test",
        "timestamp": "2026-05-07T07:22:33.988Z",
        "_id": "69fc3db9065936b6a83f6fdb"
      }
    ],
    "name": "V2 Approval Material 1778138512071",
    "category": "Paint",
    "subCategory": "Primer",
    "size": "",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": null,
    "isCatalogMaterial": false,
    "isCatalogPriced": false,
    "image": null,
    "standardUnit": "inches",
    "pricePerSqm": null,
    "_more": "17 more field(s)"
  }
}
```

### PATCH /api/platform/materials/:materialId/reject

Name: Platform reject pending material

Purpose: Rejects a pending material with a reason.

Auth: Platform owner token

API call:

```http
PATCH /api/platform/materials/:materialId/reject HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields used in smoke run:

| Field | Type | Requirement |
|---|---|---|
| `reason` | `string` | Sent in smoke run |

Request JSON example:

```json
{
  "reason": "Rejected by v2 smoke test"
}
```

Tested response: `200` (success).

Response shape: `{ success: boolean, message: string, data: { _id: string, companyName: string, isGlobal: boolean, status: string, approvedBy: null, approvedAt: null, rejectionReason: string, submittedBy: object, resubmissionCount: number, approvalHistory: array<object>, name: string, category: string, subCategory: string, size: string, color: string, thickness: null, ... } }`.

Response JSON example:

```json
{
  "success": true,
  "message": "Material rejected successfully",
  "data": {
    "_id": "69fc3db2065936b6a83f6f95",
    "companyName": "V2 Material Test Co 1778138512071",
    "isGlobal": false,
    "status": "rejected",
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": "Rejected by v2 smoke test",
    "submittedBy": {
      "_id": "69fc3da0065936b6a83f6ccf",
      "fullname": "V2 Material Owner",
      "email": "v2.owner.1778138512071@example.com"
    },
    "resubmissionCount": 0,
    "approvalHistory": [
      {
        "action": "submitted",
        "performedBy": "69fc3da0065936b6a83f6ccf",
        "performedByName": "V2 Material Owner",
        "reason": "Initial submission",
        "timestamp": "2026-05-07T07:22:26.078Z",
        "_id": "69fc3db2065936b6a83f6f96"
      },
      {
        "action": "rejected",
        "performedBy": "6964b6078c3ced74787860b5",
        "performedByName": "Platform Admin",
        "reason": "Rejected by v2 smoke test",
        "timestamp": "2026-05-07T07:22:40.739Z",
        "_id": "69fc3dc0065936b6a83f6fe8"
      }
    ],
    "name": "V2 Reject Material 1778138512071",
    "category": "Paint",
    "subCategory": "Hardner",
    "size": "",
    "color": "",
    "thickness": null,
    "thicknessUnit": "inches",
    "catalogKey": "",
    "catalogPrice": null,
    "isCatalogMaterial": false,
    "isCatalogPriced": false,
    "image": null,
    "standardUnit": "inches",
    "pricePerSqm": null,
    "_more": "17 more field(s)"
  }
}
```

### GET /api/platform/stats/overview

Name: Platform overview

Purpose: Returns platform overview totals.

Auth: Platform owner token

API call:

```http
GET /api/platform/stats/overview HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: { products: object, orders: object, users: object, companies: object, quotations: object } }`.

Response JSON example:

```json
{
  "success": true,
  "data": {
    "products": {
      "byStatus": [
        {
          "_id": null,
          "count": 7
        },
        {
          "_id": "pending",
          "count": 25
        },
        "... 1 more item(s)"
      ],
      "byCompany": [
        {
          "_id": "showroom",
          "total": 6,
          "pending": 6,
          "approved": 0,
          "rejected": 0
        },
        {
          "_id": "Summit Novatrust Limited",
          "total": 3,
          "pending": 3,
          "approved": 0,
          "rejected": 0
        },
        "... 8 more item(s)"
      ],
      "global": 0
    },
    "orders": {
      "byStatus": [
        {
          "_id": "pending",
          "count": 17,
          "totalAmount": 3072300.86
        },
        {
          "_id": "completed",
          "count": 1,
          "totalAmount": 3260.87
        },
        "... 1 more item(s)"
      ],
      "byCompany": [
        {
          "_id": "MacsWooder",
          "totalOrders": 6,
          "totalRevenue": 1739369.79,
          "totalPaid": 1678322
        },
        {
          "_id": "showroom",
          "totalOrders": 3,
          "totalRevenue": 911150,
          "totalPaid": 576450
        },
        "... 8 more item(s)"
      ]
    },
    "users": {
      "total": 23,
      "platformOwners": 1,
      "companyOwners": 20
    },
    "companies": {
      "total": 5,
      "active": 5
    },
    "quotations": {
      "total": 49
    }
  }
}
```

### GET /api/platform/companies?limit=5

Name: Platform companies

Purpose: Lists companies for platform owner.

Auth: Platform owner token

API call:

```http
GET /api/platform/companies?limit=5 HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Query parameters used in smoke run:

```json
{
  "limit": "5"
}
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: array<object>, pagination: { page: number, limit: number, total: number, pages: number } }`.

Response JSON example:

```json
{
  "success": true,
  "data": [
    {
      "_id": "69763e439e6c1215573aec16",
      "name": "TestCo",
      "email": "testco@example.com",
      "owner": {
        "_id": "69763e399e6c1215573aec13",
        "fullname": "Test User",
        "email": "testuser_local@example.com",
        "phoneNumber": "08000000000"
      },
      "isActive": true,
      "createdAt": "2026-01-25T16:01:07.358Z",
      "updatedAt": "2026-01-25T16:01:07.358Z",
      "__v": 0,
      "stats": {
        "products": 0,
        "orders": 0,
        "quotations": 0,
        "users": 0
      }
    },
    {
      "_id": "69657871257e4747714afab0",
      "name": "Zillow",
      "email": "macsonline500@gmail.com",
      "phoneNumber": "08110947817",
      "address": "No 22 Heritage estate Ibadan.",
      "owner": {
        "_id": "6964b6078c3ced74787860b5",
        "fullname": "Platform Admin",
        "email": "admin@woodworker.com",
        "phoneNumber": "+1234567890"
      },
      "isActive": true,
      "createdAt": "2026-01-12T22:40:49.031Z",
      "updatedAt": "2026-01-12T22:40:49.031Z",
      "__v": 0,
      "stats": {
        "products": 0,
        "orders": 0,
        "quotations": 0,
        "users": 2
      }
    },
    "... 3 more item(s)"
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 5,
    "pages": 1
  }
}
```

### GET /api/platform/products/all?limit=5

Name: Platform products all

Purpose: Lists all products across companies.

Auth: Platform owner token

API call:

```http
GET /api/platform/products/all?limit=5 HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Query parameters used in smoke run:

```json
{
  "limit": "5"
}
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: array<object>, stats: { pending: number, approved: number, rejected: number, null: number }, pagination: { page: number, limit: number, total: number, pages: number } }`.

Response JSON example:

```json
{
  "success": true,
  "data": [
    {
      "_id": "69fc3dcf065936b6a83f7038",
      "userId": {
        "_id": "69fc3da0065936b6a83f6ccf",
        "fullname": "V2 Material Owner",
        "email": "v2.owner.1778138512071@example.com"
      },
      "companyName": "V2 Material Test Co 1778138512071",
      "name": "Sitting Chair 1778138512071",
      "productId": "PRD-SE7MZU",
      "category": "Furniture",
      "subCategory": "Chair",
      "description": "V2 smoke test chair",
      "image": null,
      "isGlobal": false,
      "status": "pending",
      "approvedBy": null,
      "approvedAt": null,
      "rejectionReason": null,
      "submittedBy": {
        "_id": "69fc3da0065936b6a83f6ccf",
        "fullname": "V2 Material Owner",
        "email": "v2.owner.1778138512071@example.com"
      },
      "resubmissionCount": 0,
      "approvalHistory": [
        {
          "action": "submitted",
          "performedBy": "69fc3da0065936b6a83f6ccf",
          "performedByName": "V2 Material Owner",
          "timestamp": "2026-05-07T07:22:55.491Z",
          "_id": "69fc3dcf065936b6a83f7039"
        }
      ],
      "submittedAt": "2026-05-07T07:22:55.492Z",
      "createdAt": "2026-05-07T07:22:55.492Z",
      "updatedAt": "2026-05-07T07:22:55.492Z",
      "__v": 0
    },
    {
      "_id": "69fa068c4c2b49b464e493f6",
      "userId": {
        "_id": "69fa06624c2b49b464e4908d",
        "fullname": "V2 Material Owner",
        "email": "v2.owner.1777993308603@example.com"
      },
      "companyName": "V2 Material Test Co 1777993308603",
      "name": "Sitting Chair 1777993308603",
      "productId": "PRD-J8HZ6O",
      "category": "Furniture",
      "subCategory": "Chair",
      "description": "V2 smoke test chair",
      "image": null,
      "isGlobal": false,
      "status": "pending",
      "approvedBy": null,
      "approvedAt": null,
      "rejectionReason": null,
      "submittedBy": {
        "_id": "69fa06624c2b49b464e4908d",
        "fullname": "V2 Material Owner",
        "email": "v2.owner.1777993308603@example.com"
      },
      "resubmissionCount": 0,
      "approvalHistory": [
        {
          "action": "submitted",
          "performedBy": "69fa06624c2b49b464e4908d",
          "performedByName": "V2 Material Owner",
          "timestamp": "2026-05-05T15:02:36.875Z",
          "_id": "69fa068c4c2b49b464e493f7"
        }
      ],
      "submittedAt": "2026-05-05T15:02:36.876Z",
      "createdAt": "2026-05-05T15:02:36.876Z",
      "updatedAt": "2026-05-05T15:02:36.876Z",
      "__v": 0
    },
    "... 3 more item(s)"
  ],
  "stats": {
    "pending": 25,
    "approved": 1,
    "rejected": 0,
    "null": 7
  },
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 33,
    "pages": 7
  }
}
```

### GET /api/platform/materials/pending?limit=5

Name: Platform materials pending

Purpose: Lists pending materials awaiting platform decision.

Auth: Platform owner token

API call:

```http
GET /api/platform/materials/pending?limit=5 HTTP/1.1
Host: <base-url-host>
Authorization: Bearer <token>
```

Query parameters used in smoke run:

```json
{
  "limit": "5"
}
```

Request body: none.

Tested response: `200` (success).

Response shape: `{ success: boolean, data: array, pagination: { page: number, limit: number, total: number, pages: number } }`.

Response JSON example:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 0,
    "pages": 0
  }
}
```

## Untested Route Catalog

These routes exist in the backend route files but were not covered by `Scripts/v2ApiSmoke.js`. Use the request notes below plus controller validation before wiring production UI around them.

### auth

| Method | Endpoint | Auth | Request requirements |
|---|---|---|---|
| POST | `/api/auth/forgot-password` | Public | Body: method=email with email, or method=phone with phoneNumber. |
| POST | `/api/auth/verify-otp` | Public | Body: userId, otp. |
| POST | `/api/auth/reset-password` | Public | Body: resetToken, password. Password minimum is 8 characters. |
| POST | `/api/auth/companies` | User token | Body: name; optional email, phoneNumber, address. |
| POST | `/api/auth/company` | User token | Body: companyName; optional companyEmail, companyPhone, companyAddress. |
| PATCH | `/api/auth/company/:companyIndex` | Owner token | Body: companyName; optional companyEmail, companyPhone, companyAddress. |
| POST | `/api/auth/invite-staff` | Owner/admin token | Body: fullname, email, phoneNumber, role, position. |
| GET | `/api/auth/staff` | User token | Optional query: companyName, search. |
| PATCH | `/api/auth/staff/:userId/revoke` | Owner/admin token | No body. |
| PATCH | `/api/auth/staff/:userId/restore` | Owner/admin token | No body. |
| DELETE | `/api/auth/staff/:userId` | Owner/admin token | No body. |

### products

| Method | Endpoint | Auth | Request requirements |
|---|---|---|---|
| GET | `/api/product/categories` | User token + active company | No body. |
| PUT | `/api/product/:id` | User token + active company | JSON or multipart product update fields. |
| PATCH | `/api/product/:id/resubmit` | User token + active company | JSON or multipart product update fields after rejection. |
| DELETE | `/api/product/:id` | User token + active company | No body. |

### bom

| Method | Endpoint | Auth | Request requirements |
|---|---|---|---|
| PUT | `/api/bom/:id` | User token + active company | Body can update name, description, materials, additionalCosts, dueDate, product, pricing, expectedDuration. |
| DELETE | `/api/bom/:id` | User token + active company | No body. |
| POST | `/api/bom/:id/materials` | User token + active company | Body: material object. |
| DELETE | `/api/bom/:id/materials/:materialId` | User token + active company | No body. |
| POST | `/api/bom/:id/additional-costs` | User token + active company | Body: name, amount; optional description. |
| DELETE | `/api/bom/:id/additional-costs/:costId` | User token + active company | No body. |

### quotation

| Method | Endpoint | Auth | Request requirements |
|---|---|---|---|
| PUT | `/api/quotation/:id` | User token + active company | Body can update client fields, items, service, discount, status, dueDate. |
| DELETE | `/api/quotation/:id` | User token + active company | No body. |
| POST | `/api/quotation/:id/items` | User token + active company | Body: item object. |
| DELETE | `/api/quotation/:id/items/:itemId` | User token + active company | No body. |
| GET | `/api/quotation/:id/pdf` | User token + active company | Returns generated PDF. |

### invoices

| Method | Endpoint | Auth | Request requirements |
|---|---|---|---|
| GET | `/api/invoices/invoices/:id` | User token + active company | No body. |
| PATCH | `/api/invoices/:id/payment` | User token + active company | Body: amountPaid, notes. Amount cannot exceed invoice total. |
| PATCH | `/api/invoices/invoices/:id/status` | User token + active company | Body: status in pending, paid, overdue, cancelled. |
| DELETE | `/api/invoices/invoices/:id` | User token + active company | No body. |

### orders

| Method | Endpoint | Auth | Request requirements |
|---|---|---|---|
| PUT | `/api/orders/orders/:id` | User token + active company | Mutable order fields. |
| POST | `/api/orders/orders/:id/payment` | Order permission | Body: amount; optional paymentMethod, reference, notes, paymentDate. |
| PATCH | `/api/orders/update-orders/:id/status` | User token + active company | Body: status in pending, in_progress, completed, cancelled, on_hold. |
| DELETE | `/api/orders/delete-orders/:id` | User token + active company | No body. |
| POST | `/api/orders/:id/assign` | Owner/admin token | Body should identify staff to assign. |
| POST | `/api/orders/:id/unassign` | Owner/admin token | No body. |
| GET | `/api/orders/staff/available` | User token + active company | No body. |

### notifications

| Method | Endpoint | Auth | Request requirements |
|---|---|---|---|
| PATCH | `/api/notifications/read-all` | User token + active company | No body. |
| PATCH | `/api/notifications/:id/read` | User token + active company | No body. |
| DELETE | `/api/notifications/:id` | User token + active company | No body. |

### permissions

| Method | Endpoint | Auth | Request requirements |
|---|---|---|---|
| GET | `/api/permission/:staffId` | Owner/admin token | No body. |
| PUT | `/api/permission/:staffId` | Owner/admin token | Body: permissions object with quotation, sales, order, database, receipts, backupAlerts, invoice, products, boms. |
| POST | `/api/permission/:staffId/grant` | Owner/admin token | Body: permission. |
| POST | `/api/permission/:staffId/revoke` | Owner/admin token | Body: permission. |

### platform

| Method | Endpoint | Auth | Request requirements |
|---|---|---|---|
| GET | `/api/platform/companies/:companyId/usage` | Platform owner token | No body. |
| GET | `/api/platform/companies/:companyId/profile` | Platform owner token | No body. |
| GET | `/api/platform/products/pending` | Platform owner token | Optional query: page, limit, search. |
| GET | `/api/platform/products/:productId` | Platform owner token | No body. |
| PATCH | `/api/platform/products/:productId/approve` | Platform owner token | Optional body: notes. |
| PATCH | `/api/platform/products/:productId/reject` | Platform owner token | Body: reason. |
| POST | `/api/platform/products/global` | Platform owner token | Multipart optional image plus product fields. |

## Integration Notes

- `POST /api/platform/materials/reseed-from-catalog` deletes and recreates the material collection. Keep it out of normal mobile owner flows.
- SMTP can time out locally. The smoke run still returned success for invoice/material approval flows because email errors are caught.
- `GET /api/auth/companies` reads the separate `UserCompany` collection, while `GET /api/auth/me` includes embedded `user.companies`. For the mobile app current-company state, prefer `GET /api/auth/me`.
- Some order APIs are duplicated under `/api/orders` and `/api/sales/orders`. The smoke-tested mobile path used `/api/orders`.
- Full raw responses remain in `tmp/v2-smoke-result.json` for debugging exact IDs and complete arrays.
