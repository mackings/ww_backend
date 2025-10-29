

const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');
const { generateToken } = require('../utils/jwt');
const ApiResponse = require('../utils/apiResponse');
const { sendEmail } = require('../utils/email');



/**
 * @desc    Create a new staff member
 * @route   POST /api/staff
 * @access  Private (User only)
 */
exports.createStaff = async (req, res) => {
  try {
    const { email, phoneNumber, firstName, lastName, password, role, permissions } = req.body;

    // Validation
    if (!email || !firstName || !lastName || !password) {
      return ApiResponse.error(res, 'Please provide all required fields', 400);
    }

    if (password.length < 8) {
      return ApiResponse.error(res, 'Password must be at least 8 characters', 400);
    }

    // Check if staff already exists
    const existingStaff = await Staff.findOne({ 
      email,
      createdBy: req.user.id 
    });

    if (existingStaff) {
      return ApiResponse.error(res, 'Staff with this email already exists', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create staff
    const staff = await Staff.create({
      email,
      phoneNumber,
      firstName,
      lastName,
      password: hashedPassword,
      role: role || 'staff',
      permissions: permissions || [],
      createdBy: req.user.id,
      isVerified: false,
    });

    // Send welcome email with credentials
    await sendEmail({
      to: email,
      subject: 'Welcome - Staff Account Created',
      text: `Hello ${firstName},\n\nYour staff account has been created.\n\nEmail: ${email}\nTemporary Password: ${password}\n\nPlease login and change your password immediately.`,
    });

    return ApiResponse.success(
      res,
      'Staff created successfully',
      {
        id: staff._id,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        permissions: staff.permissions,
        isActive: staff.isActive,
      },
      201
    );
  } catch (error) {
    console.error('Create staff error:', error);
    return ApiResponse.error(res, 'Server error creating staff', 500);
  }
};

/**
 * @desc    Staff signin
 * @route   POST /api/staff/signin
 * @access  Public
 */
exports.staffSignin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return ApiResponse.error(res, 'Please provide email and password', 400);
    }

    const staff = await Staff.findOne({ email }).select('+password');
    
    if (!staff) {
      return ApiResponse.error(res, 'Invalid email or password', 401);
    }

    if (!staff.isActive) {
      return ApiResponse.error(res, 'Your access has been revoked. Please contact your administrator.', 403);
    }

    const isPasswordValid = await bcrypt.compare(password, staff.password);
    if (!isPasswordValid) {
      return ApiResponse.error(res, 'Invalid email or password', 401);
    }

    // Update last login
    staff.lastLogin = new Date();
    await staff.save();

    const token = generateToken(staff._id);

    return ApiResponse.success(res, 'Signed in successfully', {
      token,
      staff: {
        id: staff._id,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        permissions: staff.permissions,
        createdBy: staff.createdBy,
      },
    });
  } catch (error) {
    console.error('Staff signin error:', error);
    return ApiResponse.error(res, 'Server error during signin', 500);
  }
};

/**
 * @desc    Get all staff members created by user
 * @route   GET /api/staff
 * @access  Private (User only)
 */
exports.getAllStaff = async (req, res) => {
  try {
    const { isActive, role, page = 1, limit = 10 } = req.query;

    const query = { createdBy: req.user.id };
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (role) {
      query.role = role;
    }

    const skip = (page - 1) * limit;

    const staff = await Staff.find(query)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Staff.countDocuments(query);

    return ApiResponse.success(res, 'Staff fetched successfully', {
      staff,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get staff error:', error);
    return ApiResponse.error(res, 'Server error fetching staff', 500);
  }
};

/**
 * @desc    Get single staff member
 * @route   GET /api/staff/:id
 * @access  Private (User only)
 */
exports.getStaff = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    }).select('-password');

    if (!staff) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    return ApiResponse.success(res, 'Staff fetched successfully', staff);
  } catch (error) {
    console.error('Get staff error:', error);
    return ApiResponse.error(res, 'Server error fetching staff', 500);
  }
};

/**
 * @desc    Update staff permissions
 * @route   PATCH /api/staff/:id/permissions
 * @access  Private (User only)
 */
exports.updatePermissions = async (req, res) => {
  try {
    const { permissions, role } = req.body;

    const staff = await Staff.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!staff) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    if (!staff.isActive) {
      return ApiResponse.error(res, 'Cannot update permissions for inactive staff', 400);
    }

    if (permissions) {
      staff.permissions = permissions;
    }
    
    if (role) {
      staff.role = role;
    }

    await staff.save();

    return ApiResponse.success(res, 'Permissions updated successfully', {
      id: staff._id,
      role: staff.role,
      permissions: staff.permissions,
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    return ApiResponse.error(res, 'Server error updating permissions', 500);
  }
};

/**
 * @desc    Revoke staff access
 * @route   POST /api/staff/:id/revoke
 * @access  Private (User only)
 */
exports.revokeAccess = async (req, res) => {
  try {
    const { reason } = req.body;

    const staff = await Staff.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!staff) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    if (!staff.isActive) {
      return ApiResponse.error(res, 'Staff access is already revoked', 400);
    }

    await staff.revokeAccess(req.user.id, reason);

    // Send email notification
    await sendEmail({
      to: staff.email,
      subject: 'Access Revoked',
      text: `Your access has been revoked.\n\n${reason ? `Reason: ${reason}` : ''}`,
    });

    return ApiResponse.success(res, 'Staff access revoked successfully', {
      id: staff._id,
      isActive: staff.isActive,
      revokedAt: staff.revokedAt,
    });
  } catch (error) {
    console.error('Revoke access error:', error);
    return ApiResponse.error(res, 'Server error revoking access', 500);
  }
};

/**
 * @desc    Restore staff access
 * @route   POST /api/staff/:id/restore
 * @access  Private (User only)
 */
exports.restoreAccess = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!staff) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    if (staff.isActive) {
      return ApiResponse.error(res, 'Staff access is already active', 400);
    }

    await staff.restoreAccess();

    // Send email notification
    await sendEmail({
      to: staff.email,
      subject: 'Access Restored',
      text: `Your access has been restored. You can now login to your account.`,
    });

    return ApiResponse.success(res, 'Staff access restored successfully', {
      id: staff._id,
      isActive: staff.isActive,
    });
  } catch (error) {
    console.error('Restore access error:', error);
    return ApiResponse.error(res, 'Server error restoring access', 500);
  }
};

/**
 * @desc    Delete staff member
 * @route   DELETE /api/staff/:id
 * @access  Private (User only)
 */
exports.deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!staff) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    return ApiResponse.success(res, 'Staff deleted successfully');
  } catch (error) {
    console.error('Delete staff error:', error);
    return ApiResponse.error(res, 'Server error deleting staff', 500);
  }
};

/**
 * @desc    Get current staff profile
 * @route   GET /api/staff/me
 * @access  Private (Staff only)
 */
exports.getStaffProfile = async (req, res) => {
  try {
    const staff = await Staff.findById(req.user.id).select('-password');

    if (!staff || !staff.isActive) {
      return ApiResponse.error(res, 'Access denied', 403);
    }

    return ApiResponse.success(res, 'Profile fetched successfully', staff);
  } catch (error) {
    console.error('Get profile error:', error);
    return ApiResponse.error(res, 'Server error fetching profile', 500);
  }
};