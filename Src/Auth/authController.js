
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../../Models/user');
const OTP = require('../../Models/otp');
const { sendEmail } = require('../../Utils/emailUtil');
const { sendSMS } = require('../../Utils/smsUtil');
const ApiResponse = require("../../Utils/apiResponse");
const generateOTP = require('../../Utils/genOtp');
const generateToken = require('../../Utils/genToken');

// const Company = require('../../Models/companyModel');
// const UserCompany = require('../../Models/userCompanyModel');




exports.signup = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, password, companyName, companyEmail } = req.body;

    if (!fullname || !email || !password) {
      return ApiResponse.error(res, 'Please provide all required fields', 400);
    }

    if (password.length < 8) {
      return ApiResponse.error(res, 'Password must be at least 8 characters', 400);
    }

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existingUser) {
      return ApiResponse.error(res, 'User already exists with this email or phone number', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userData = {
      fullname,
      email,
      phoneNumber,
      password: hashedPassword,
      isVerified: false,
      companies: [],
      activeCompanyIndex: 0,
    };

    // Add company if provided
    if (companyName) {
      userData.companies.push({
        name: companyName,
        email: companyEmail || email,
        phoneNumber: phoneNumber,
        role: 'owner',
        position: 'Owner',
        accessGranted: true,
        joinedAt: new Date(),
      });
    }

    const user = await User.create(userData);

    console.log('✅ User created:', user._id);

    // Generate token
    const token = generateToken(user._id);

    return ApiResponse.success(
      res,
      'Account created successfully',
      {
        token,
        user: {
          id: user._id,
          fullname: user.fullname,
          email: user.email,
          phoneNumber: user.phoneNumber,
          isVerified: user.isVerified,
          companies: user.companies,
          activeCompany: user.getActiveCompany(),
        },
      },
      201
    );
  } catch (error) {
    console.error('Signup error:', error);
    return ApiResponse.error(res, 'Server error during signup', 500);
  }
};

/**
 * @desc    Signin
 * @route   POST /api/auth/signin
 * @access  Public
 */
exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return ApiResponse.error(res, 'Please provide email and password', 400);
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return ApiResponse.error(res, 'Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return ApiResponse.error(res, 'Invalid email or password', 401);
    }

    const token = generateToken(user._id);

    return ApiResponse.success(res, 'Signed in successfully', {
      token,
      user: {
        id: user._id,
        fullname: user.fullname,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
        companies: user.companies,
        activeCompanyIndex: user.activeCompanyIndex,
        activeCompany: user.getActiveCompany(),
      },
    });
  } catch (error) {
    console.error('Signin error:', error);
    return ApiResponse.error(res, 'Server error during signin', 500);
  }
};



exports.createCompany = async (req, res) => {
  try {
    const { companyName, companyEmail, companyPhone, companyAddress } = req.body;

    if (!companyName) {
      return ApiResponse.error(res, 'Company name is required', 400);
    }

    const user = await User.findById(req.user._id);

    // Check if company already exists
    const companyExists = user.companies.some(c => c.name === companyName);
    if (companyExists) {
      return ApiResponse.error(res, 'You already have a company with this name', 400);
    }

    // Add new company
    user.companies.push({
      name: companyName,
      email: companyEmail || user.email,
      phoneNumber: companyPhone || user.phoneNumber,
      address: companyAddress,
      role: 'owner',
      position: 'Owner',
      accessGranted: true,
      joinedAt: new Date(),
    });

    // Set as active company
    user.activeCompanyIndex = user.companies.length - 1;

    await user.save();

    return ApiResponse.success(res, 'Company created successfully', {
      company: user.companies[user.activeCompanyIndex],
      activeCompanyIndex: user.activeCompanyIndex,
    });
  } catch (error) {
    console.error('Create company error:', error);
    return ApiResponse.error(res, 'Server error creating company', 500);
  }
};

/**
 * @desc    Update Company Info
 * @route   PATCH /api/auth/company/:companyIndex
 * @access  Private
 */
exports.updateCompany = async (req, res) => {
  try {
    const { companyIndex } = req.params;
    const { companyName, companyEmail, companyPhone, companyAddress } = req.body;

    if (!companyName) {
      return ApiResponse.error(res, 'Company name is required', 400);
    }

    const user = await User.findById(req.user._id);

    const index = parseInt(companyIndex) || user.activeCompanyIndex;

    if (!user.companies[index]) {
      return ApiResponse.error(res, 'Company not found', 404);
    }

    // Only owner can update company info
    if (user.companies[index].role !== 'owner') {
      return ApiResponse.error(res, 'Only company owner can update company info', 403);
    }

    user.companies[index].name = companyName;
    user.companies[index].email = companyEmail || user.email;
    user.companies[index].phoneNumber = companyPhone || user.phoneNumber;
    user.companies[index].address = companyAddress;

    await user.save();

    return ApiResponse.success(res, 'Company updated successfully', {
      company: user.companies[index],
    });
  } catch (error) {
    console.error('Update company error:', error);
    return ApiResponse.error(res, 'Server error updating company', 500);
  }
};

/**
 * @desc    Switch Active Company
 * @route   POST /api/auth/switch-company
 * @access  Private
 */
exports.switchCompany = async (req, res) => {
  try {
    const { companyIndex } = req.body;

    if (companyIndex === undefined || companyIndex === null) {
      return ApiResponse.error(res, 'Company index is required', 400);
    }

    const user = await User.findById(req.user._id);

    if (!user.companies[companyIndex]) {
      return ApiResponse.error(res, 'Company not found', 404);
    }

    user.activeCompanyIndex = companyIndex;
    await user.save();

    return ApiResponse.success(res, 'Company switched successfully', {
      activeCompanyIndex: user.activeCompanyIndex,
      activeCompany: user.companies[companyIndex],
    });
  } catch (error) {
    console.error('Switch company error:', error);
    return ApiResponse.error(res, 'Server error switching company', 500);
  }
};

/**
 * @desc    Invite Staff to Active Company
 * @route   POST /api/auth/invite-staff
 * @access  Private
 */
exports.inviteStaff = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, role, position } = req.body;

    if (!fullname || !email || !phoneNumber || !role || !position) {
      return ApiResponse.error(res, 'Please provide all required fields', 400);
    }

    const inviter = await User.findById(req.user._id);
    
    // Get active company using helper method or direct access
    const activeCompany = inviter.companies && inviter.companies.length > 0
      ? inviter.companies[inviter.activeCompanyIndex || 0]
      : null;

    // Check if inviter has company
    if (!activeCompany || !activeCompany.name) {
      return ApiResponse.error(res, 'You need to create a company first', 400);
    }

    // Check if inviter can manage staff
    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return ApiResponse.error(res, 'You do not have permission to invite staff', 403);
    }

    // Find or create user
    let staffUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });

    if (staffUser) {
      // User exists - check if already in this company
      const alreadyInCompany = staffUser.companies.some(
        c => c.name === activeCompany.name
      );

      if (alreadyInCompany) {
        return ApiResponse.error(res, 'User is already part of this company', 400);
      }

      // Add company to existing user
      staffUser.companies.push({
        name: activeCompany.name,
        email: activeCompany.email,
        phoneNumber: activeCompany.phoneNumber,
        address: activeCompany.address,
        role,
        position,
        invitedBy: inviter._id,
        accessGranted: true,
        joinedAt: new Date(),
      });

      await staffUser.save();

      console.log('✅ Added company to existing user:', staffUser._id);

      // Send notification email
      try {
        await sendEmail({
          to: email,
          subject: `You've been invited to join ${activeCompany.name}`,
          html: `
            <p>Hello ${fullname},</p>
            <p>You have been invited to join <strong>${activeCompany.name}</strong> as a <strong>${position}</strong>.</p>
            <p>Log in to your account to access the company.</p>
            <p>Best regards,<br>${activeCompany.name} Team</p>
          `,
        });
      } catch (emailError) {
        console.error('❌ Failed to send notification email:', emailError);
      }

      return ApiResponse.success(res, 'Staff invited successfully', {
        id: staffUser._id,
        email: staffUser.email,
        role,
        position,
        isExistingUser: true,
      });
    } else {
      // Create new user
      const tempPassword = crypto.randomBytes(4).toString('hex');
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      staffUser = await User.create({
        fullname,
        email,
        phoneNumber,
        password: hashedPassword,
        companies: [{
          name: activeCompany.name,
          email: activeCompany.email,
          phoneNumber: activeCompany.phoneNumber,
          address: activeCompany.address,
          role,
          position,
          invitedBy: inviter._id,
          accessGranted: true,
          joinedAt: new Date(),
        }],
        activeCompanyIndex: 0,
        isVerified: false,
      });

      console.log('✅ New user created:', staffUser._id);

      // Send welcome email with temp password
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #8B4513; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
              .credentials { background-color: #fff; border: 2px solid #8B4513; padding: 20px; margin: 20px 0; border-radius: 5px; }
              .credential-item { margin: 10px 0; padding: 10px; background-color: #f5f5f5; border-left: 3px solid #8B4513; }
              .credential-label { font-weight: bold; color: #8B4513; }
              .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; color: #856404; }
              .button { display: inline-block; padding: 12px 30px; background-color: #8B4513; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to ${activeCompany.name}!</h1>
              </div>
              <div class="content">
                <p>Hello ${fullname},</p>
                <p>You have been invited to join <strong>${activeCompany.name}</strong> as a <strong>${position}</strong> by ${inviter.fullname}.</p>
                <p>Your account has been created with the following credentials:</p>
                <div class="credentials">
                  <div class="credential-item"><span class="credential-label">Email:</span> ${email}</div>
                  <div class="credential-item"><span class="credential-label">Temporary Password:</span> ${tempPassword}</div>
                  <div class="credential-item"><span class="credential-label">Role:</span> ${role}</div>
                  <div class="credential-item"><span class="credential-label">Position:</span> ${position}</div>
                </div>
                <div class="warning">⚠️ <strong>Important:</strong> Please change your password immediately after your first login.</div>
                <center>
                  <a href="${process.env.FRONTEND_URL || 'https://yourapp.com'}/signin" class="button">Login Now</a>
                </center>
                <p>Best regards,<br>${activeCompany.name} Team</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await sendEmail({
          to: email,
          subject: `Welcome to ${activeCompany.name} - Your Account Details`,
          html: emailHtml,
        });

        console.log('✅ Welcome email sent to:', email);
      } catch (emailError) {
        console.error('❌ Failed to send welcome email:', emailError);
      }

      return ApiResponse.success(res, 'Staff invited successfully', {
        id: staffUser._id,
        fullname: staffUser.fullname,
        email: staffUser.email,
        role,
        position,
        tempPassword: tempPassword,
        isExistingUser: false,
      });
    }
  } catch (error) {
    console.error('Invite staff error:', error);
    return ApiResponse.error(res, 'Server error inviting staff', 500);
  }
};

/**
 * @desc    Get Company Staff (Active Company)
 * @route   GET /api/auth/staff
 * @access  Private
 */
exports.getCompanyStaff = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    // Get active company
    const activeCompany = user.companies && user.companies.length > 0 
      ? user.companies[user.activeCompanyIndex || 0] 
      : null;

    if (!activeCompany || !activeCompany.name) {
      return ApiResponse.error(res, 'No active company found', 404);
    }

    // Find all users who have this company in their companies array
    const allUsers = await User.find({
      'companies.name': activeCompany.name,
    }).select('-password');

    const staffList = [];

    allUsers.forEach(u => {
      const companyData = u.companies.find(c => c.name === activeCompany.name);
      if (companyData) {
        staffList.push({
          id: u._id,
          fullname: u.fullname,
          email: u.email,
          phoneNumber: u.phoneNumber,
          role: companyData.role,
          position: companyData.position,
          accessGranted: companyData.accessGranted,
          joinedAt: companyData.joinedAt,
        });
      }
    });

    return ApiResponse.success(res, 'Staff fetched successfully', staffList);
  } catch (error) {
    console.error('Get staff error:', error);
    return ApiResponse.error(res, 'Server error fetching staff', 500);
  }
};

/**
 * @desc    Revoke Staff Access
 * @route   PATCH /api/auth/staff/:userId/revoke
 * @access  Private
 */
exports.revokeStaffAccess = async (req, res) => {
  try {
    const { userId } = req.params;

    const currentUser = await User.findById(req.user._id);
    const activeCompany = currentUser.companies && currentUser.companies.length > 0
      ? currentUser.companies[currentUser.activeCompanyIndex || 0]
      : null;
    
    if (!activeCompany || !['owner', 'admin'].includes(activeCompany.role)) {
      return ApiResponse.error(res, 'You do not have permission to revoke access', 403);
    }

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    const companyIndex = targetUser.companies.findIndex(c => c.name === activeCompany.name);
    if (companyIndex === -1) {
      return ApiResponse.error(res, 'User is not part of this company', 404);
    }

    if (targetUser.companies[companyIndex].role === 'owner') {
      return ApiResponse.error(res, 'Cannot revoke owner access', 400);
    }

    targetUser.companies[companyIndex].accessGranted = false;
    await targetUser.save();

    return ApiResponse.success(res, 'Staff access revoked successfully');
  } catch (error) {
    console.error('Revoke access error:', error);
    return ApiResponse.error(res, 'Server error revoking access', 500);
  }
};

/**
 * @desc    Restore Staff Access
 * @route   PATCH /api/auth/staff/:userId/restore
 * @access  Private
 */
exports.restoreStaffAccess = async (req, res) => {
  try {
    const { userId } = req.params;

    const currentUser = await User.findById(req.user._id);
    const activeCompany = currentUser.companies && currentUser.companies.length > 0
      ? currentUser.companies[currentUser.activeCompanyIndex || 0]
      : null;
    
    if (!activeCompany || !['owner', 'admin'].includes(activeCompany.role)) {
      return ApiResponse.error(res, 'You do not have permission to restore access', 403);
    }

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    const companyIndex = targetUser.companies.findIndex(c => c.name === activeCompany.name);
    if (companyIndex === -1) {
      return ApiResponse.error(res, 'User is not part of this company', 404);
    }

    targetUser.companies[companyIndex].accessGranted = true;
    await targetUser.save();

    return ApiResponse.success(res, 'Staff access restored successfully');
  } catch (error) {
    console.error('Restore access error:', error);
    return ApiResponse.error(res, 'Server error restoring access', 500);
  }
};



/**
 * @desc    Remove Staff from Company
 * @route   DELETE /api/auth/staff/:userId
 * @access  Private
 */
exports.removeStaff = async (req, res) => {
  try {
    const { userId } = req.params;

    const currentUser = await User.findById(req.user._id);
    const activeCompany = currentUser.companies && currentUser.companies.length > 0
      ? currentUser.companies[currentUser.activeCompanyIndex || 0]
      : null;
    
    if (!activeCompany || !['owner', 'admin'].includes(activeCompany.role)) {
      return ApiResponse.error(res, 'You do not have permission to remove staff', 403);
    }

    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    const companyIndex = targetUser.companies.findIndex(c => c.name === activeCompany.name);
    if (companyIndex === -1) {
      return ApiResponse.error(res, 'User is not part of this company', 404);
    }

    if (targetUser.companies[companyIndex].role === 'owner') {
      return ApiResponse.error(res, 'Cannot remove company owner', 400);
    }

    // Remove company from user's companies array
    targetUser.companies.splice(companyIndex, 1);

    // Adjust activeCompanyIndex if needed
    if (targetUser.activeCompanyIndex >= targetUser.companies.length) {
      targetUser.activeCompanyIndex = Math.max(0, targetUser.companies.length - 1);
    }

    await targetUser.save();

    return ApiResponse.success(res, 'Staff removed successfully');
  } catch (error) {
    console.error('Remove staff error:', error);
    return ApiResponse.error(res, 'Server error removing staff', 500);
  }
};



/**
 * @desc    Forgot Password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email, phoneNumber, method } = req.body;

    if (!method || (method === 'email' && !email) || (method === 'phone' && !phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid recovery method',
      });
    }

    const query = method === 'email' ? { email } : { phoneNumber };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({
      userId: user._id,
      otp,
      type: 'password_reset',
      expiresAt: otpExpires,
    });

    if (method === 'email') {
      await sendEmail({
        to: email,
        subject: 'Password Reset OTP',
        text: `Your OTP is: ${otp}. Valid for 10 minutes.`,
      });
    } else {
      await sendSMS({
        to: phoneNumber,
        message: `Your OTP is: ${otp}. Valid for 10 minutes.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `OTP sent to your ${method}`,
      userId: user._id.toString(),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during password reset request',
    });
  }
};

/**
 * @desc    Verify OTP
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return ApiResponse.error(res, 'Please provide userId and OTP', 400);
    }

    const otpRecord = await OTP.findOne({
      userId,
      otp,
      type: 'password_reset',
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return ApiResponse.error(res, 'Invalid or expired OTP', 400);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await User.findByIdAndUpdate(userId, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: Date.now() + 30 * 60 * 1000,
    });

    await OTP.deleteOne({ _id: otpRecord._id });

    return ApiResponse.success(res, 'OTP verified successfully', { resetToken });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return ApiResponse.error(res, 'Server error during OTP verification', 500);
  }
};




/**
 * @desc    Reset Password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, password } = req.body;

    if (!resetToken || !password) {
      return ApiResponse.error(res, 'Please provide all required fields', 400);
    }

    if (password.length < 8) {
      return ApiResponse.error(res, 'Password must be at least 8 characters', 400);
    }

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return ApiResponse.error(res, 'Invalid or expired reset token', 400);
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return ApiResponse.success(res, 'Password reset successfully');
  } catch (error) {
    console.error('Reset password error:', error);
    return ApiResponse.error(res, 'Server error during password reset', 500);
  }
};

/**
 * @desc    Get Current User
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    return ApiResponse.success(res, 'User fetched successfully', {
      id: user._id,
      fullname: user.fullname,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isVerified: user.isVerified,
      role: user.role,
      position: user.position,
      company: user.company,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return ApiResponse.error(res, 'Server error fetching user', 500);
  }
};