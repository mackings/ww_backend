
const Company = require('../../Models/companyModel');
const UserCompany = require('../../Models/userCompanyModel');
const User = require('../../Models/user');
const ApiResponse = require('../../Utils/apiResponse');
const { notifyCompany, notifyUser } = require('../../Utils/NotHelper');



exports.createCompany = async (req, res) => {
  try {
    const { name, email, phoneNumber, address } = req.body;

    if (!name) {
      return ApiResponse.error(res, 'Company name is required', 400);
    }

    // Create company
    const company = await Company.create({
      name,
      email: email || req.user.email,
      phoneNumber,
      address,
      owner: req.user._id,
    });

    // Link user to company as owner
    await UserCompany.create({
      user: req.user._id,
      company: company._id,
      role: 'owner',
      position: 'Owner',
      accessGranted: true,
    });

    // Set as last active company
    await User.findByIdAndUpdate(req.user._id, {
      lastActiveCompany: company._id,
    });

    // ✅ Notify user about company creation
    await notifyUser({
      userId: req.user._id,
      companyName: company.name,
      type: 'company_created',
      title: 'Company Created',
      message: `You successfully created ${company.name}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: { companyId: company._id }
    });

    return ApiResponse.success(
      res,
      'Company created successfully',
      {
        id: company._id,
        name: company.name,
        email: company.email,
      },
      201
    );
  } catch (error) {
    console.error('Create company error:', error);
    return ApiResponse.error(res, 'Server error creating company', 500);
  }
};

exports.getMyCompanies = async (req, res) => {
  try {
    const userCompanies = await UserCompany.find({
      user: req.user._id,
      accessGranted: true,
    }).populate('company');

    const companies = userCompanies.map(uc => ({
      id: uc.company._id,
      name: uc.company.name,
      email: uc.company.email,
      phoneNumber: uc.company.phoneNumber,
      role: uc.role,
      position: uc.position,
      isOwner: uc.role === 'owner',
      joinedAt: uc.joinedAt,
    }));

    return ApiResponse.success(res, 'Companies fetched successfully', companies);
  } catch (error) {
    console.error('Get companies error:', error);
    return ApiResponse.error(res, 'Server error fetching companies', 500);
  }
};

exports.inviteStaff = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { email, role, position } = req.body;

    if (!email || !role || !position) {
      return ApiResponse.error(res, 'Please provide email, role, and position', 400);
    }

    // Verify user is owner or admin of this company
    const userCompany = await UserCompany.findOne({
      user: req.user._id,
      company: companyId,
      role: { $in: ['owner', 'admin'] },
    });

    if (!userCompany) {
      return ApiResponse.error(res, 'You do not have permission to invite staff', 403);
    }

    // Get company details
    const company = await Company.findById(companyId);
    if (!company) {
      return ApiResponse.error(res, 'Company not found', 404);
    }

    // Find the staff user by email
    const staffUser = await User.findOne({ email });

    if (!staffUser) {
      return ApiResponse.error(res, 'User not found. They need to sign up first.', 404);
    }

    // Check if user is already in this company
    const existingLink = await UserCompany.findOne({
      user: staffUser._id,
      company: companyId,
    });

    if (existingLink) {
      return ApiResponse.error(res, 'User is already part of this company', 400);
    }

    // Create user-company link
    await UserCompany.create({
      user: staffUser._id,
      company: companyId,
      role,
      position,
      accessGranted: true,
      invitedBy: req.user._id,
    });

    // ✅ Notify the invited staff
    await notifyUser({
      userId: staffUser._id,
      companyName: company.name,
      type: 'staff_added',
      title: 'Added to Company',
      message: `You have been added to ${company.name} as ${position} by ${req.user.fullname}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: { 
        companyId: company._id,
        role,
        position 
      }
    });

    // ✅ Notify all existing company members
    await notifyCompany({
      companyName: company.name,
      type: 'staff_added',
      title: 'New Staff Member',
      message: `${req.user.fullname} added ${staffUser.fullname} as ${position}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: {
        staffName: staffUser.fullname,
        staffEmail: staffUser.email,
        role,
        position
      },
      excludeUserId: req.user._id // Don't notify the person who did the action
    });

    return ApiResponse.success(res, 'Staff invited successfully', {
      email: staffUser.email,
      role,
      position,
    });
  } catch (error) {
    console.error('Invite staff error:', error);
    return ApiResponse.error(res, 'Server error inviting staff', 500);
  }
};

exports.getCompanyStaff = async (req, res) => {
  try {
    const { companyId } = req.params;

    // Verify user has access to this company
    const userCompany = await UserCompany.findOne({
      user: req.user._id,
      company: companyId,
    });

    if (!userCompany) {
      return ApiResponse.error(res, 'You do not have access to this company', 403);
    }

    // Get all staff for this company
    const staff = await UserCompany.find({
      company: companyId,
      accessGranted: true,
    }).populate('user', 'fullname email phoneNumber');

    const staffList = staff.map(s => ({
      id: s.user._id,
      fullname: s.user.fullname,
      email: s.user.email,
      phoneNumber: s.user.phoneNumber,
      role: s.role,
      position: s.position,
      joinedAt: s.joinedAt,
    }));

    return ApiResponse.success(res, 'Staff fetched successfully', staffList);
  } catch (error) {
    console.error('Get staff error:', error);
    return ApiResponse.error(res, 'Server error fetching staff', 500);
  }
};

exports.revokeStaffAccess = async (req, res) => {
  try {
    const { companyId, userId } = req.params;

    // Verify user is owner or admin of this company
    const userCompany = await UserCompany.findOne({
      user: req.user._id,
      company: companyId,
      role: { $in: ['owner', 'admin'] },
    });

    if (!userCompany) {
      return ApiResponse.error(res, 'You do not have permission to revoke access', 403);
    }

    // Get company details
    const company = await Company.findById(companyId);
    if (!company) {
      return ApiResponse.error(res, 'Company not found', 404);
    }

    // Cannot revoke owner access
    const targetUserCompany = await UserCompany.findOne({
      user: userId,
      company: companyId,
    }).populate('user', 'fullname email');

    if (!targetUserCompany) {
      return ApiResponse.error(res, 'Staff not found in this company', 404);
    }

    if (targetUserCompany.role === 'owner') {
      return ApiResponse.error(res, 'Cannot revoke company owner access', 400);
    }

    // Revoke access (soft delete)
    targetUserCompany.accessGranted = false;
    await targetUserCompany.save();

    // ✅ Notify the affected staff
    await notifyUser({
      userId: targetUserCompany.user._id,
      companyName: company.name,
      type: 'access_revoked',
      title: 'Access Revoked',
      message: `Your access to ${company.name} has been revoked by ${req.user.fullname}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: { companyId: company._id }
    });

    // ✅ Notify company members
    await notifyCompany({
      companyName: company.name,
      type: 'access_revoked',
      title: 'Staff Access Revoked',
      message: `${req.user.fullname} revoked access for ${targetUserCompany.user.fullname}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: {
        staffName: targetUserCompany.user.fullname,
        staffEmail: targetUserCompany.user.email
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Staff access revoked successfully');
  } catch (error) {
    console.error('Revoke access error:', error);
    return ApiResponse.error(res, 'Server error revoking access', 500);
  }
};

exports.restoreStaffAccess = async (req, res) => {
  try {
    const { companyId, userId } = req.params;

    // Verify user is owner or admin of this company
    const userCompany = await UserCompany.findOne({
      user: req.user._id,
      company: companyId,
      role: { $in: ['owner', 'admin'] },
    });

    if (!userCompany) {
      return ApiResponse.error(res, 'You do not have permission to restore access', 403);
    }

    // Get company details
    const company = await Company.findById(companyId);
    if (!company) {
      return ApiResponse.error(res, 'Company not found', 404);
    }

    // Find staff
    const targetUserCompany = await UserCompany.findOne({
      user: userId,
      company: companyId,
    }).populate('user', 'fullname email');

    if (!targetUserCompany) {
      return ApiResponse.error(res, 'Staff not found in this company', 404);
    }

    // Restore access
    targetUserCompany.accessGranted = true;
    await targetUserCompany.save();

    // ✅ Notify the staff
    await notifyUser({
      userId: targetUserCompany.user._id,
      companyName: company.name,
      type: 'access_granted',
      title: 'Access Granted',
      message: `Your access to ${company.name} has been restored by ${req.user.fullname}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: { companyId: company._id }
    });

    // ✅ Notify company members
    await notifyCompany({
      companyName: company.name,
      type: 'access_granted',
      title: 'Staff Access Restored',
      message: `${req.user.fullname} restored access for ${targetUserCompany.user.fullname}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: {
        staffName: targetUserCompany.user.fullname,
        staffEmail: targetUserCompany.user.email
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Staff access restored successfully');
  } catch (error) {
    console.error('Restore access error:', error);
    return ApiResponse.error(res, 'Server error restoring access', 500);
  }
};

exports.removeStaff = async (req, res) => {
  try {
    const { companyId, userId } = req.params;

    // Verify user is owner or admin of this company
    const userCompany = await UserCompany.findOne({
      user: req.user._id,
      company: companyId,
      role: { $in: ['owner', 'admin'] },
    });

    if (!userCompany) {
      return ApiResponse.error(res, 'You do not have permission to remove staff', 403);
    }

    // Get company details
    const company = await Company.findById(companyId);
    if (!company) {
      return ApiResponse.error(res, 'Company not found', 404);
    }

    // Cannot remove owner
    const targetUserCompany = await UserCompany.findOne({
      user: userId,
      company: companyId,
    }).populate('user', 'fullname email');

    if (!targetUserCompany) {
      return ApiResponse.error(res, 'Staff not found in this company', 404);
    }

    if (targetUserCompany.role === 'owner') {
      return ApiResponse.error(res, 'Cannot remove company owner', 400);
    }

    // Store staff info before deletion
    const staffName = targetUserCompany.user.fullname;
    const staffEmail = targetUserCompany.user.email;

    // Remove staff
    await UserCompany.deleteOne({ _id: targetUserCompany._id });

    // ✅ Notify the removed staff
    await notifyUser({
      userId: targetUserCompany.user._id,
      companyName: company.name,
      type: 'staff_removed',
      title: 'Removed from Company',
      message: `You have been removed from ${company.name} by ${req.user.fullname}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: { companyId: company._id }
    });

    // ✅ Notify remaining company members
    await notifyCompany({
      companyName: company.name,
      type: 'staff_removed',
      title: 'Staff Removed',
      message: `${req.user.fullname} removed ${staffName} from the company`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: {
        staffName,
        staffEmail
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Staff removed successfully');
  } catch (error) {
    console.error('Remove staff error:', error);
    return ApiResponse.error(res, 'Server error removing staff', 500);
  }
};