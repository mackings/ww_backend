

const User = require('../../Models/user');
const Notification = require('../../Models/notificationsModel');
const { success, error } = require('../../Utils/apiResponse');

/**
 * @desc    Get staff permissions
 * @route   GET /api/permissions/:staffId
 * @access  Private (Owner/Admin only)
 */
exports.getStaffPermissions = async (req, res) => {
  try {
    const { staffId } = req.params;
    
    const currentUser = await User.findById(req.user._id);
    const activeCompany = currentUser.companies[currentUser.activeCompanyIndex || 0];

    // Check if user is owner/admin
    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return error(res, 'Unauthorized: Only owners and admins can view permissions', 403);
    }

    // Get staff user
    const staffUser = await User.findById(staffId).select('fullname email companies');
    
    if (!staffUser) {
      return error(res, 'Staff not found', 404);
    }

    // Find staff's company data
    const staffCompanyData = staffUser.companies.find(
      c => c.name === activeCompany.name
    );

    if (!staffCompanyData) {
      return error(res, 'Staff is not part of this company', 404);
    }

    return success(res, 'Permissions fetched successfully', {
      staffId: staffUser._id,
      fullname: staffUser.fullname,
      email: staffUser.email,
      role: staffCompanyData.role,
      position: staffCompanyData.position,
      permissions: staffCompanyData.permissions || {}
    });

  } catch (err) {
    console.error('Get permissions error:', err);
    return error(res, 'Server error', 500);
  }
};

/**
 * @desc    Update staff permissions
 * @route   PUT /api/permissions/:staffId
 * @access  Private (Owner/Admin only)
 */
exports.updateStaffPermissions = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { permissions } = req.body;

    if (!permissions) {
      return error(res, 'Permissions data is required', 400);
    }

    const currentUser = await User.findById(req.user._id);
    const activeCompany = currentUser.companies[currentUser.activeCompanyIndex || 0];

    // Check if user is owner/admin
    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return error(res, 'Unauthorized: Only owners and admins can update permissions', 403);
    }

    // Get staff user
    const staffUser = await User.findById(staffId);
    
    if (!staffUser) {
      return error(res, 'Staff not found', 404);
    }

    // Cannot modify owner's permissions
    const staffCompanyData = staffUser.companies.find(
      c => c.name === activeCompany.name
    );

    if (!staffCompanyData) {
      return error(res, 'Staff is not part of this company', 404);
    }

    if (staffCompanyData.role === 'owner') {
      return error(res, 'Cannot modify owner permissions', 403);
    }

    // Update permissions
    staffCompanyData.permissions = {
      quotation: permissions.quotation || false,
      sales: permissions.sales || false,
      order: permissions.order || false,
      database: permissions.database || false,
      receipts: permissions.receipts || false,
      backupAlerts: permissions.backupAlerts || false,
      invoice: permissions.invoice || false,
      products: permissions.products || false,
      boms: permissions.boms || false,
    };

    await staffUser.save();

    // ✅ Create notification
    await Notification.create({
      userId: staffId,
      companyName: activeCompany.name,
      type: 'permissions_updated',
      title: 'Permissions Updated',
      message: `Your permissions were updated by ${currentUser.fullname}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
    });

    return success(res, 'Permissions updated successfully', {
      staffId: staffUser._id,
      fullname: staffUser.fullname,
      permissions: staffCompanyData.permissions
    });

  } catch (err) {
    console.error('Update permissions error:', err);
    return error(res, 'Server error', 500);
  }
};

/**
 * @desc    Grant specific permission to staff
 * @route   POST /api/permissions/:staffId/grant
 * @access  Private (Owner/Admin only)
 */
exports.grantPermission = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { permission } = req.body; // e.g., 'quotation', 'sales', etc.

    if (!permission) {
      return error(res, 'Permission type is required', 400);
    }

    const currentUser = await User.findById(req.user._id);
    const activeCompany = currentUser.companies[currentUser.activeCompanyIndex || 0];

    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return error(res, 'Unauthorized', 403);
    }

    const staffUser = await User.findById(staffId);
    
    if (!staffUser) {
      return error(res, 'Staff not found', 404);
    }

    const staffCompanyData = staffUser.companies.find(
      c => c.name === activeCompany.name
    );

    if (!staffCompanyData) {
      return error(res, 'Staff is not part of this company', 404);
    }

    if (staffCompanyData.role === 'owner') {
      return error(res, 'Cannot modify owner permissions', 403);
    }

    // Grant permission
    if (!staffCompanyData.permissions) {
      staffCompanyData.permissions = {};
    }
    staffCompanyData.permissions[permission] = true;

    await staffUser.save();

    // Create notification
    await Notification.create({
      userId: staffId,
      companyName: activeCompany.name,
      type: 'permission_granted',
      title: 'Permission Granted',
      message: `You have been granted ${permission} access by ${currentUser.fullname}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
    });

    return success(res, `${permission} permission granted successfully`);

  } catch (err) {
    console.error('Grant permission error:', err);
    return error(res, 'Server error', 500);
  }
};

/**
 * @desc    Revoke specific permission from staff
 * @route   POST /api/permissions/:staffId/revoke
 * @access  Private (Owner/Admin only)
 */
exports.revokePermission = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { permission } = req.body;

    if (!permission) {
      return error(res, 'Permission type is required', 400);
    }

    const currentUser = await User.findById(req.user._id);
    const activeCompany = currentUser.companies[currentUser.activeCompanyIndex || 0];

    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return error(res, 'Unauthorized', 403);
    }

    const staffUser = await User.findById(staffId);
    
    if (!staffUser) {
      return error(res, 'Staff not found', 404);
    }

    const staffCompanyData = staffUser.companies.find(
      c => c.name === activeCompany.name
    );

    if (!staffCompanyData) {
      return error(res, 'Staff is not part of this company', 404);
    }

    if (staffCompanyData.role === 'owner') {
      return error(res, 'Cannot modify owner permissions', 403);
    }

    // Revoke permission
    if (staffCompanyData.permissions) {
      staffCompanyData.permissions[permission] = false;
    }

    await staffUser.save();

    // Create notification
    await Notification.create({
      userId: staffId,
      companyName: activeCompany.name,
      type: 'permission_revoked',
      title: 'Permission Revoked',
      message: `Your ${permission} access was revoked by ${currentUser.fullname}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
    });

    return success(res, `${permission} permission revoked successfully`);

  } catch (err) {
    console.error('Revoke permission error:', err);
    return error(res, 'Server error', 500);
  }
};
