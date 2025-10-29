const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const purchaseController = require('../controllers/purchaseController');
const { protect } = require('../middleware/auth');
const { isStaffOrUser } = require('../middleware/permissions');
const { checkPermission, checkAnyPermission } = require('../middleware/permissions');





const express = require('express');
const staffController = require('../controllers/staffController');
const { protect } = require('../middleware/auth');
const { mainUserOnly } = require('../middleware/permissions');

// Public routes
router.post('/signin', staffController.staffSignin);

// Protected routes - Main user only
router.use(protect);
router.use(mainUserOnly);

router.post('/', staffController.createStaff);
router.get('/', staffController.getAllStaff);
router.get('/:id', staffController.getStaff);
router.patch('/:id/permissions', staffController.updatePermissions);
router.post('/:id/revoke', staffController.revokeAccess);
router.post('/:id/restore', staffController.restoreAccess);
router.delete('/:id', staffController.deleteStaff);

module.exports = router;
// ============================================
// PRODUCT ROUTES WITH PERMISSIONS
// ============================================

router.use(protect); // All routes require authentication
router.use(isStaffOrUser); // Check if user is staff or main user

// Get all products - requires 'read' permission on 'products'
router.get(
  '/products',
  checkPermission('products', 'read'),
  productController.getAllProducts
);

// Get single product - requires 'read' permission
router.get(
  '/products/:id',
  checkPermission('products', 'read'),
  productController.getProduct
);

// Create product - requires 'create' permission on 'products'
router.post(
  '/products',
  checkPermission('products', 'create'),
  productController.createProduct
);

// Update product - requires 'update' permission
router.patch(
  '/products/:id',
  checkPermission('products', 'update'),
  productController.updateProduct
);

// Delete product - requires 'delete' permission
router.delete(
  '/products/:id',
  checkPermission('products', 'delete'),
  productController.deleteProduct
);

// ============================================
// PURCHASE ROUTES WITH PERMISSIONS
// ============================================

// Get all purchases - requires 'read' permission on 'purchases'
router.get(
  '/purchases',
  checkPermission('purchases', 'read'),
  purchaseController.getAllPurchases
);

// Get single purchase
router.get(
  '/purchases/:id',
  checkPermission('purchases', 'read'),
  purchaseController.getPurchase
);

// Create purchase
router.post(
  '/purchases',
  checkPermission('purchases', 'create'),
  purchaseController.createPurchase
);

// Update purchase
router.patch(
  '/purchases/:id',
  checkPermission('purchases', 'update'),
  purchaseController.updatePurchase
);

// Approve purchase - requires 'approve' permission
router.post(
  '/purchases/:id/approve',
  checkPermission('purchases', 'approve'),
  purchaseController.approvePurchase
);

// ============================================
// WALLET ROUTES WITH PERMISSIONS
// ============================================

// View wallet - requires read on wallet
router.get(
  '/wallet',
  checkPermission('wallet', 'read'),
  walletController.getWallet
);

// Top up wallet - requires create on wallet
router.post(
  '/wallet/topup',
  checkPermission('wallet', 'create'),
  walletController.topUpWallet
);

// ============================================
// DELIVERY ROUTES WITH PERMISSIONS
// ============================================

// View deliveries - requires read on delivery
router.get(
  '/deliveries',
  checkPermission('delivery', 'read'),
  deliveryController.getAllDeliveries
);

// Update delivery status - requires update OR approve
router.patch(
  '/deliveries/:id/status',
  checkAnyPermission([
    { module: 'delivery', action: 'update' },
    { module: 'delivery', action: 'approve' }
  ]),
  deliveryController.updateDeliveryStatus
);

// ============================================
// REPORTS ROUTES (Main User Only Example)
// ============================================
const { mainUserOnly } = require('../middleware/permissions');

// Only main user can access sensitive reports
router.get(
  '/reports/financial',
  mainUserOnly,
  reportController.getFinancialReport
);

module.exports = router;


// ============================================
// EXAMPLE: How to create staff with permissions
// ============================================

/*
POST /api/staff
{
  "email": "staff@example.com",
  "phoneNumber": "+234123456789",
  "firstName": "John",
  "lastName": "Doe",
  "password": "securePassword123",
  "role": "manager",
  "permissions": [
    {
      "module": "products",
      "actions": ["read", "create", "update"]
    },
    {
      "module": "purchases",
      "actions": ["read", "create"]
    },
    {
      "module": "delivery",
      "actions": ["read", "update"]
    }
  ]
}
*/

// ============================================
// EXAMPLE: Update staff permissions
// ============================================

/*
PATCH /api/staff/:staffId/permissions
{
  "role": "admin",
  "permissions": [
    {
      "module": "products",
      "actions": ["read", "create", "update", "delete"]
    },
    {
      "module": "purchases",
      "actions": ["read", "create", "update", "approve"]
    },
    {
      "module": "users",
      "actions": ["read", "update"]
    }
  ]
}
*/

// ============================================
// EXAMPLE: Revoke access
// ============================================

/*
POST /api/staff/:staffId/revoke
{
  "reason": "Contract ended"
}
*/

// ============================================
// EXAMPLE: Restore access
// ============================================

/*
POST /api/staff/:staffId/restore
*/