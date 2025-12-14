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

      // Owners and admins have all permissions
      if (['owner', 'admin'].includes(activeCompany.role)) {
        return next();
      }

      // Check if staff has the required permission
      if (activeCompany.role === 'staff') {
        const hasPermission = activeCompany.permissions && activeCompany.permissions[permission];
        
        if (!hasPermission) {
          return error(res, `Access denied: You don't have permission to access ${permission}`, 403);
        }
      }

      next();
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

      // Owners and admins have all permissions
      if (['owner', 'admin'].includes(activeCompany.role)) {
        return next();
      }

      // Check if staff has at least one of the required permissions
      if (activeCompany.role === 'staff') {
        const hasAnyPermission = permissions.some(
          perm => activeCompany.permissions && activeCompany.permissions[perm]
        );
        
        if (!hasAnyPermission) {
          return error(res, `Access denied: You don't have permission to access this resource`, 403);
        }
      }

      next();
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