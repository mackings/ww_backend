const OverheadCost = require("../../Models/OCmodel")


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

    // Create cost item
    const overhead = await OverheadCost.create({
      companyName: req.companyName,  // ✅ NEW
      category,
      description,
      period,
      cost,
      user: req.user.id,      // from decoded JWT
      createdBy: req.user.id, // person who created it
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


// 🟡 Fetch all overhead costs for a user
exports.getOverheadCosts = async (req, res) => {
  try {
    // ✅ Filter by company
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
      user: req.user.id, // ensure user owns it
    });

    if (!overhead) {
      return res.status(404).json({
        success: false,
        message: "Overhead cost not found",
      });
    }

    // Delete
    await overhead.deleteOne();

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

