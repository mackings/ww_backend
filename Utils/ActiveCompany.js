
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

    next();
  } catch (error) {
    console.error('Company context error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting company context'
    });
  }
};

