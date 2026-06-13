const { error } = require('../Utils/apiResponse');

/**
 * Check if user has required permission for the resource
 * @param {string} permission - Required permission (e.g., 'quotation', 'sales', 'invoice')
 */

exports.checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return error(res, 'User not authenticated', 401);
      }

      // Get active company
      const activeCompany = user.companies[user.activeCompanyIndex || 0];
      
      if (!activeCompany) {
        return error(res, 'No active company found', 403);
      }

      // All active company members share the operational workspace.
      // Role checks still protect owner/admin-only management endpoints.
      if (activeCompany.accessGranted === false) {
        return error(res, 'Access denied: Company access has been revoked', 403);
      }

      return next();
    } catch (err) {
      console.error('Permission check error:', err);
      return error(res, 'Server error in permission check', 500);
    }
  };
};

/**
 * Check if user has any of the required permissions
 * @param {string[]} permissions - Array of permissions (e.g., ['quotation', 'sales'])
 */
exports.checkAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return error(res, 'User not authenticated', 401);
      }

      const activeCompany = user.companies[user.activeCompanyIndex || 0];
      
      if (!activeCompany) {
        return error(res, 'No active company found', 403);
      }

      if (activeCompany.accessGranted === false) {
        return error(res, 'Access denied: Company access has been revoked', 403);
      }

      return next();
    } catch (err) {
      console.error('Permission check error:', err);
      return error(res, 'Server error in permission check', 500);
    }
  };
};

/**
 * Check if user is owner or admin
 */
exports.requireOwnerOrAdmin = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return error(res, 'User not authenticated', 401);
    }

    // Platform owners can manage any company
    if (user.isPlatformOwner) {
      return next();
    }

    const activeCompany = user.companies[user.activeCompanyIndex || 0];
    
    if (!activeCompany) {
      return error(res, 'No active company found', 403);
    }

    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return error(res, 'Access denied: Owner or Admin role required', 403);
    }

    next();
  } catch (err) {
    console.error('Role check error:', err);
    return error(res, 'Server error in role check', 500);
  }
};
