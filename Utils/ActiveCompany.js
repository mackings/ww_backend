
const User = require("../Models/user");

exports.getActiveCompany = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Platform owners don't need a company
    if (user.isPlatformOwner) {
      req.activeCompany = null;
      req.companyName = null;
      req.isPlatformOwner = true;
      return next();
    }

    const activeCompany = user.companies && user.companies.length > 0
      ? user.companies[user.activeCompanyIndex || 0]
      : null;

    if (!activeCompany || !activeCompany.name) {
      return res.status(400).json({
        success: false,
        message: 'No active company found. Please create or select a company.'
      });
    }

    // Attach to requests
    req.activeCompany = activeCompany;
    req.companyName = activeCompany.name;
    req.isPlatformOwner = false;

    next();
  } catch (error) {
    console.error('Company context error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting company context'
    });
  }
};

/**
 * Optional company middleware - doesn't error if no company found
 * Used for platform owner routes
 */
exports.getActiveCompanyOptional = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isPlatformOwner) {
      req.activeCompany = null;
      req.companyName = null;
      req.isPlatformOwner = true;
      return next();
    }

    const activeCompany = user.companies && user.companies.length > 0
      ? user.companies[user.activeCompanyIndex || 0]
      : null;

    req.activeCompany = activeCompany;
    req.companyName = activeCompany ? activeCompany.name : null;
    req.isPlatformOwner = false;

    next();
  } catch (error) {
    console.error('Company context error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting company context'
    });
  }
};

