

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../../Models/user');
const OTP = require('../../Models/otp');
const { sendEmail } = require('../../Utils/emailUtil');
const { sendSMS } = require('../../Utils/smsUtil');
const ApiResponse = require("../../Utils/apiResponse");
const generateOTP = require('../../Utils/genOtp');
const generateToken = require('../../Utils/genToken');



exports.signup = async (req, res) => {
  try {
    const { email, phoneNumber, password } = req.body;

    if (!email || !password) {
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
    const user = await User.create({
      email,
      phoneNumber,
      password: hashedPassword,
      isVerified: false,
    });

    // Generate token
    const token = generateToken(user._id);

    return ApiResponse.success(
      res,
      'Account created successfully',
      {
        token,
        user: {
          id: user._id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          isVerified: user.isVerified,
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
        email: user.email,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Signin error:', error);
    return ApiResponse.error(res, 'Server error during signin', 500);
  }
};

/**
 * @desc    Forgot Password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email, phoneNumber, method } = req.body;

    if (!method || (method === 'email' && !email) || (method === 'phone' && !phoneNumber)) {
      return ApiResponse.error(res, 'Please provide valid recovery method', 400);
    }

    const query = method === 'email' ? { email } : { phoneNumber };
    const user = await User.findOne(query);
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
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

    return ApiResponse.success(res, `OTP sent to your ${method}`, { userId: user._id });
  } catch (error) {
    console.error('Forgot password error:', error);
    return ApiResponse.error(res, 'Server error during password reset request', 500);
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
    const { resetToken, password, confirmPassword } = req.body;

    if (!resetToken || !password || !confirmPassword) {
      return ApiResponse.error(res, 'Please provide all required fields', 400);
    }

    if (password !== confirmPassword) {
      return ApiResponse.error(res, 'Passwords do not match', 400);
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
    const user = await User.findById(req.user.id);

    return ApiResponse.success(res, 'User fetched successfully', {
      id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isVerified: user.isVerified,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return ApiResponse.error(res, 'Server error fetching user', 500);
  }
};