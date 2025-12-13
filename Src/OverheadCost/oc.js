const OverheadCost = require("../../Models/OCmodel")
const { notifyCompany } = require('../../Utils/NotHelper');
const User = require("../../Models/user");


/**
 * @desc    Create overhead cost
 * @route   POST /api/overhead-costs
 * @access  Private
 */
exports.createOverheadCost = async (req, res) => {
  try {
    const { category, description, period, cost } = req.body;

    // Basic validation
    if (!category || !description || !period || !cost) {
      return res.status(400).json({
        success: false,
        message: "Category, description, period, and cost are required",
      });
    }

    // Get current user details
    const currentUser = await User.findById(req.user.id);

    // Create cost item
    const overhead = await OverheadCost.create({
      companyName: req.companyName,
      category,
      description,
      period,
      cost,
      user: req.user.id,
      createdBy: req.user.id,
    });

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'overhead_cost_created',
      title: 'New Overhead Cost Added',
      message: `${currentUser.fullname} added a new ${category} overhead cost: ${description} (${period})`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        overheadId: overhead._id,
        category,
        description,
        period,
        cost
      },
      excludeUserId: req.user.id
    });

    res.status(201).json({
      success: true,
      message: "Overhead cost created successfully",
      data: overhead,
    });
  } catch (error) {
    console.error("Create Overhead Cost Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating overhead cost",
    });
  }
};

/**
 * @desc    Fetch all overhead costs for company
 * @route   GET /api/overhead-costs
 * @access  Private
 */
exports.getOverheadCosts = async (req, res) => {
  try {
    // Filter by company
    const overheads = await OverheadCost.find({ companyName: req.companyName })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: overheads.length,
      data: overheads,
    });
  } catch (error) {
    console.error("Fetch Overhead Costs Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching overhead costs",
    });
  }
};

/**
 * @desc    Update overhead cost
 * @route   PUT /api/overhead-costs/:id
 * @access  Private
 */
exports.updateOverheadCost = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, description, period, cost } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Overhead cost ID is required",
      });
    }

    // Find and update
    const overhead = await OverheadCost.findOne({
      _id: id,
      companyName: req.companyName, // ✅ Ensure it belongs to company
    });

    if (!overhead) {
      return res.status(404).json({
        success: false,
        message: "Overhead cost not found",
      });
    }

    // Store old values for notification
    const oldCategory = overhead.category;
    const oldDescription = overhead.description;

    // Update fields
    if (category) overhead.category = category;
    if (description) overhead.description = description;
    if (period) overhead.period = period;
    if (cost) overhead.cost = cost;

    await overhead.save();

    // Get current user details
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'overhead_cost_updated',
      title: 'Overhead Cost Updated',
      message: `${currentUser.fullname} updated ${oldCategory} overhead cost: ${oldDescription}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        overheadId: overhead._id,
        oldCategory,
        oldDescription,
        newCategory: overhead.category,
        newDescription: overhead.description,
        cost: overhead.cost
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: "Overhead cost updated successfully",
      data: overhead,
    });
  } catch (error) {
    console.error("Update Overhead Cost Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating overhead cost",
    });
  }
};

/**
 * @desc    Delete overhead cost
 * @route   DELETE /api/overhead-costs/:id
 * @access  Private
 */
exports.deleteOverheadCost = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if ID was provided
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Overhead cost ID is required",
      });
    }

    // Find item
    const overhead = await OverheadCost.findOne({
      _id: id,
      companyName: req.companyName, // ✅ Ensure it belongs to company
    });

    if (!overhead) {
      return res.status(404).json({
        success: false,
        message: "Overhead cost not found",
      });
    }

    // Store info before deletion
    const category = overhead.category;
    const description = overhead.description;
    const cost = overhead.cost;

    // Delete
    await overhead.deleteOne();

    // Get current user details
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'overhead_cost_deleted',
      title: 'Overhead Cost Deleted',
      message: `${currentUser.fullname} deleted ${category} overhead cost: ${description}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        category,
        description,
        cost
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: "Overhead cost deleted successfully",
    });
  } catch (error) {
    console.error("Delete Overhead Cost Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting overhead cost",
    });
  }
};
