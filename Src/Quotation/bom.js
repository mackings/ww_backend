const BOM = require('../..//Models/bomModel');

// @desc    Create new BOM
// @route   POST /api/boms
// @access  Private



exports.createBOM = async (req, res) => {

  try {
    const { name, description, materials } = req.body;

    if (!name || !materials || materials.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide BOM name and at least one material'
      });
    }

    let totalCost = 0;
    materials.forEach(material => {
      const squareMeter = material.squareMeter || 0;
      const price = material.price || 0;
      const quantity = material.quantity || 1;

      const materialCost = price * squareMeter * quantity;
      totalCost += materialCost;
    });

    // Round to 2 decimal places
    totalCost = Number(totalCost.toFixed(2));


    const bom = await BOM.create({
      userId: req.user.id,
      name,
      description,
      materials,
      totalCost
    });

    res.status(201).json({
      success: true,
      message: 'BOM created successfully',
      data: bom
    });
  } catch (error) {
    console.error('Create BOM error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating BOM',
      error: error.message
    });
  }
};




// @desc    Get all BOMs
// @route   GET /api/boms
// @access  Private
exports.getAllBOMs = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    const query = { userId: req.user.id };

    // Search by name or BOM number
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { bomNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const boms = await BOM.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await BOM.countDocuments(query);

    res.status(200).json({
      success: true,
      data: boms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get BOMs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching BOMs'
    });
  }
};

// @desc    Get single BOM
// @route   GET /api/boms/:id
// @access  Private
exports.getBOM = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: 'BOM not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bom
    });
  } catch (error) {
    console.error('Get BOM error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching BOM'
    });
  }
};

// @desc    Update BOM
// @route   PUT /api/boms/:id
// @access  Private
exports.updateBOM = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: 'BOM not found'
      });
    }

    const { name, description, materials } = req.body;

    // Recalculate total if materials changed
    if (materials) {
      let totalCost = 0;
      materials.forEach(material => {
        const materialCost = material.price * material.squareMeter;
        totalCost += materialCost;
      });
      bom.totalCost = totalCost;
    }

    if (name) bom.name = name;
    if (description) bom.description = description;
    if (materials) bom.materials = materials;

    await bom.save();

    res.status(200).json({
      success: true,
      message: 'BOM updated successfully',
      data: bom
    });
  } catch (error) {
    console.error('Update BOM error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating BOM'
    });
  }
};

// @desc    Delete BOM
// @route   DELETE /api/boms/:id
// @access  Private
exports.deleteBOM = async (req, res) => {
  try {
    const bom = await BOM.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: 'BOM not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'BOM deleted successfully'
    });
  } catch (error) {
    console.error('Delete BOM error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting BOM'
    });
  }
};

// @desc    Add material to BOM
// @route   POST /api/boms/:id/materials
// @access  Private

exports.addMaterialToBOM = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: 'BOM not found'
      });
    }

    const { material } = req.body;

    if (!material) {
      return res.status(400).json({
        success: false,
        message: 'Please provide material details'
      });
    }

    bom.materials.push(material);

    // Recalculate total cost
    let totalCost = 0;
    bom.materials.forEach(mat => {
      const materialCost = mat.price * mat.squareMeter;
      totalCost += materialCost;
    });
    bom.totalCost = totalCost;

    await bom.save();

    res.status(200).json({
      success: true,
      message: 'Material added successfully',
      data: bom
    });
  } catch (error) {
    console.error('Add material error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding material'
    });
  }
};

// @desc    Delete material from BOM
// @route   DELETE /api/boms/:id/materials/:materialId
// @access  Private
exports.deleteMaterialFromBOM = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: 'BOM not found'
      });
    }

    bom.materials = bom.materials.filter(
      material => material._id.toString() !== req.params.materialId
    );

    // Recalculate total cost
    let totalCost = 0;
    bom.materials.forEach(material => {
      const materialCost = material.price * material.squareMeter;
      totalCost += materialCost;
    });
    bom.totalCost = totalCost;

    await bom.save();

    res.status(200).json({
      success: true,
      message: 'Material deleted successfully',
      data: bom
    });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting material'
    });
  }
};