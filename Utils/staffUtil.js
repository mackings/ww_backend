const Staff = require('../models/Staff');
const ApiResponse = require('../Utils/apiResponse');

/**
 * Middleware to check if staff has specific permission
 */
exports.checkPermission = (module, action) => {
  return async (req, res, next) => {
    try {
      // If user is the main account owner, allow all actions
      if (req.user.isMainUser) {
        return next();
      }

      const staff = await Staff.findById(req.user.id);

      if (!staff) {
        return ApiResponse.error(res, 'Staff not found', 404);
      }

      if (!staff.isActive) {
        return ApiResponse.error(res, 'Your access has been revoked', 403);
      }

      if (!staff.hasPermission(module, action)) {
        return ApiResponse.error(
          res,
          `You don't have permission to ${action} ${module}`,
          403
        );
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return ApiResponse.error(res, 'Error checking permissions', 500);
    }
  };
};

/**
 * Middleware to check if user is staff or main user
 */
exports.isStaffOrUser = async (req, res, next) => {
  try {
    // Check if it's a staff member
    const staff = await Staff.findById(req.user.id);
    
    if (staff) {
      if (!staff.isActive) {
        return ApiResponse.error(res, 'Your access has been revoked', 403);
      }
      req.user.isStaff = true;
      req.user.permissions = staff.permissions;
      req.user.role = staff.role;
      req.user.createdBy = staff.createdBy;
      return next();
    }

    // If not staff, it should be main user
    req.user.isMainUser = true;
    next();
  } catch (error) {
    console.error('Auth check error:', error);
    return ApiResponse.error(res, 'Authentication error', 500);
  }
};

/**
 * Middleware to ensure only main user can access
 */
exports.mainUserOnly = (req, res, next) => {
  if (!req.user.isMainUser) {
    return ApiResponse.error(res, 'Only account owner can perform this action', 403);
  }
  next();
};

/**
 * Check multiple permissions (OR logic - at least one must match)
 */
exports.checkAnyPermission = (permissionChecks) => {
  return async (req, res, next) => {
    try {
      if (req.user.isMainUser) {
        return next();
      }

      const staff = await Staff.findById(req.user.id);

      if (!staff || !staff.isActive) {
        return ApiResponse.error(res, 'Access denied', 403);
      }

      const hasAnyPermission = permissionChecks.some(({ module, action }) =>
        staff.hasPermission(module, action)
      );

      if (!hasAnyPermission) {
        return ApiResponse.error(res, 'Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return ApiResponse.error(res, 'Error checking permissions', 500);
    }
  };
};

/**
 * Check multiple permissions (AND logic - all must match)
 */
exports.checkAllPermissions = (permissionChecks) => {
  return async (req, res, next) => {
    try {
      if (req.user.isMainUser) {
        return next();
      }

      const staff = await Staff.findById(req.user.id);

      if (!staff || !staff.isActive) {
        return ApiResponse.error(res, 'Access denied', 403);
      }

      const hasAllPermissions = permissionChecks.every(({ module, action }) =>
        staff.hasPermission(module, action)
      );

      if (!hasAllPermissions) {
        return ApiResponse.error(res, 'Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return ApiResponse.error(res, 'Error checking permissions', 500);
    }
  };
};