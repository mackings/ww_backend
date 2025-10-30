const User = require('../../Models/user');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail } = require('../../Utils/emailUtil');
const ApiResponse = require('../../Utils/apiResponse');

// @desc    Create Staff
// @route   POST /api/staff/create
// @access  Admin only
exports.createStaff = async (req, res) => {
  try {
    const adminId = req.user.id; // from auth middleware
    const { email, phoneNumber } = req.body;

    // Ensure only admin can create staff
    const admin = await User.findById(adminId);
    if (admin.role !== 'admin') {
      return ApiResponse.error(res, 'Unauthorized – only admins can create staff', 403);
    }

    // Check for existing user
    const existing = await User.findOne({ email });
    if (existing) {
      return ApiResponse.error(res, 'User already exists with this email', 400);
    }

    // Generate temp password
    const tempPassword = crypto.randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const staff = await User.create({
      email,
      phoneNumber,
      password: hashedPassword,
      role: 'staff',
      createdBy: adminId,
      isVerified: false,
    });

    // Send onboarding email
    await sendEmail({
      to: email,
      subject: 'Welcome to the team 🎉',
      text: `Hello, your staff account has been created.\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password immediately.`,
    });

    return ApiResponse.success(res, 'Staff created successfully', {
      id: staff._id,
      email: staff.email,
      role: staff.role,
    }, 201);

  } catch (error) {
    console.error('Create staff error:', error);
    return ApiResponse.error(res, 'Server error creating staff', 500);
  }
};





// @desc    Grant Staff Access
// @route   PATCH /api/staff/:id/grant
// @access  Admin only
exports.grantAccess = async (req, res) => {
  try {
    const adminId = req.user.id;
    const staffId = req.params.id;

    const admin = await User.findById(adminId);
    if (admin.role !== 'admin') {
      return ApiResponse.error(res, 'Unauthorized – only admins can grant access', 403);
    }

    const staff = await User.findByIdAndUpdate(
      staffId,
      { accessGranted: true },
      { new: true }
    );

    if (!staff) return ApiResponse.error(res, 'Staff not found', 404);

    await sendEmail({
      to: staff.email,
      subject: 'Access Restored ✅',
      text: `Your account access has been restored. You can now log in.`,
    });

    return ApiResponse.success(res, 'Access granted successfully', staff);
  } catch (error) {
    console.error('Grant access error:', error);
    return ApiResponse.error(res, 'Server error granting access', 500);
  }
};



// @desc    Revoke Staff Access
// @route   PATCH /api/staff/:id/revoke
// @access  Admin only
exports.revokeAccess = async (req, res) => {
  try {
    const adminId = req.user.id;
    const staffId = req.params.id;

    const admin = await User.findById(adminId);
    if (admin.role !== 'admin') {
      return ApiResponse.error(res, 'Unauthorized – only admins can revoke access', 403);
    }

    const staff = await User.findByIdAndUpdate(
      staffId,
      { accessGranted: false },
      { new: true }
    );

    if (!staff) return ApiResponse.error(res, 'Staff not found', 404);

    await sendEmail({
      to: staff.email,
      subject: 'Access Revoked 🚫',
      text: `Your access to the system has been temporarily revoked by the admin.`,
    });

    return ApiResponse.success(res, 'Access revoked successfully', staff);
  } catch (error) {
    console.error('Revoke access error:', error);
    return ApiResponse.error(res, 'Server error revoking access', 500);
  }
};



// @desc    Delete Staff
// @route   DELETE /api/staff/:id
// @access  Admin only
exports.deleteStaff = async (req, res) => {
  try {
    const adminId = req.user.id;
    const staffId = req.params.id;

    const admin = await User.findById(adminId);
    if (admin.role !== 'admin') {
      return ApiResponse.error(res, 'Unauthorized – only admins can delete staff', 403);
    }

    const staff = await User.findByIdAndDelete(staffId);
    if (!staff) return ApiResponse.error(res, 'Staff not found', 404);

    await sendEmail({
      to: staff.email,
      subject: 'Account Deleted ❌',
      text: `Your staff account has been deleted by the admin.`,
    });

    return ApiResponse.success(res, 'Staff deleted successfully');
  } catch (error) {
    console.error('Delete staff error:', error);
    return ApiResponse.error(res, 'Server error deleting staff', 500);
  }
};



// @desc    Get All Staff
// @route   GET /api/staff
// @access  Admin only
exports.getAllStaff = async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await User.findById(adminId);

    if (admin.role !== 'admin') {
      return ApiResponse.error(res, 'Unauthorized – only admins can view staff', 403);
    }

    const staff = await User.find({ createdBy: adminId });
    return ApiResponse.success(res, 'Staff fetched successfully', staff);
  } catch (error) {
    console.error('Get staff error:', error);
    return ApiResponse.error(res, 'Server error fetching staff', 500);
  }
};
