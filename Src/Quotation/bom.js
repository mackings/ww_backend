const BOM = require('../..//Models/bomModel');
const Product = require('../../Models/productModel');

// @desc    Create new BOM
// @route   POST /api/boms
// @access  Private


exports.createBOM = async (req, res) => {
  try {
    const { name, description, materials, additionalCosts, productId } = req.body;

    if (!name || !materials || materials.length === 0 || !productId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide productId, BOM name, and at least one material'
      });
    }

    // ✅ Find product using productId (custom ID like PRD-XXXX)
    const product = await Product.findOne({
      productId: productId,
      userId: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found for this user'
      });
    }

    // ✅ Auto-assign product name as material name
    const updatedMaterials = materials.map(mat => ({
      ...mat,
      name: product.name // 🪵 automatically use product name
    }));

    // ✅ Calculate material and cost totals
    let materialsCost = 0;
    updatedMaterials.forEach(material => {
      const squareMeter = material.squareMeter || 0;
      const price = material.price || 0;
      const quantity = material.quantity || 1;
      materialsCost += price * squareMeter * quantity;
    });

    let additionalCostsTotal = 0;
    if (additionalCosts && additionalCosts.length > 0) {
      additionalCosts.forEach(cost => {
        additionalCostsTotal += cost.amount || 0;
      });
    }

    const totalCost = materialsCost + additionalCostsTotal;

    // ✅ Create BOM linked to the Product
    const bom = await BOM.create({
      userId: req.user.id,
      productId: product._id,
      productDetails: {
        name: product.name,
        category: product.category,
        subCategory: product.subCategory,
        description: product.description,
        image: product.image
      },
      name,
      description,
      materials: updatedMaterials,
      additionalCosts: additionalCosts || [],
      materialsCost: Number(materialsCost.toFixed(2)),
      additionalCostsTotal: Number(additionalCostsTotal.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2))
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





// @desc    Add additional cost to BOM
// @route   POST /api/boms/:id/additional-costs
// @access  Private
exports.addAdditionalCost = async (req, res) => {
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

    const { name, amount, description } = req.body;

    if (!name || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide cost name and amount'
      });
    }

    bom.additionalCosts.push({ name, amount, description });

    // Recalculate additional costs total
    let additionalCostsTotal = 0;
    bom.additionalCosts.forEach(cost => {
      additionalCostsTotal += cost.amount || 0;
    });

    bom.additionalCostsTotal = Number(additionalCostsTotal.toFixed(2));
    bom.totalCost = Number((bom.materialsCost + bom.additionalCostsTotal).toFixed(2));

    await bom.save();

    res.status(200).json({
      success: true,
      message: 'Additional cost added successfully',
      data: bom
    });
  } catch (error) {
    console.error('Add additional cost error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding additional cost'
    });
  }
};

// @desc    Delete additional cost from BOM
// @route   DELETE /api/boms/:id/additional-costs/:costId
// @access  Private

exports.deleteAdditionalCost = async (req, res) => {
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

    bom.additionalCosts = bom.additionalCosts.filter(
      cost => cost._id.toString() !== req.params.costId
    );

    // Recalculate additional costs total
    let additionalCostsTotal = 0;
    bom.additionalCosts.forEach(cost => {
      additionalCostsTotal += cost.amount || 0;
    });

    bom.additionalCostsTotal = Number(additionalCostsTotal.toFixed(2));
    bom.totalCost = Number((bom.materialsCost + bom.additionalCostsTotal).toFixed(2));

    await bom.save();

    res.status(200).json({
      success: true,
      message: 'Additional cost deleted successfully',
      data: bom
    });
  } catch (error) {
    console.error('Delete additional cost error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting additional cost'
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

    // 🔍 Optional search filter by name or BOM number
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { bomNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // 🔹 Fetch BOMs with product populated
    const boms = await BOM.find(query)
      .populate({
        path: "productId",
        select: "name productId category subCategory description image"
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await BOM.countDocuments(query);

    // 🔹 Structure each BOM properly for uniform response
    const formattedBOMs = boms.map(bom => ({
      _id: bom._id,
      userId: bom.userId,
      productId: bom.productId ? {
        _id: bom.productId._id,
        name: bom.productId.name,
        productId: bom.productId.productId,
        category: bom.productId.category,
        subCategory: bom.productId.subCategory,
        description: bom.productId.description,
        image: bom.productId.image
      } : null,
      name: bom.name,
      description: bom.description,
      materials: bom.materials.map(m => ({
        _id: m._id,
        name: m.name,
        woodType: m.woodType,
        foamType: m.foamType,
        type: m.type,
        width: m.width,
        height: m.height,
        length: m.length,
        thickness: m.thickness,
        unit: m.unit,
        squareMeter: m.squareMeter,
        price: m.price,
        quantity: m.quantity,
        description: m.description,
        subtotal: m.subtotal
      })),
      additionalCosts: bom.additionalCosts.map(a => ({
        _id: a._id,
        name: a.name,
        amount: a.amount,
        description: a.description
      })),
      materialsCost: bom.materialsCost,
      additionalCostsTotal: bom.additionalCostsTotal,
      totalCost: bom.totalCost,
      quotationId: bom.quotationId,
      bomNumber: bom.bomNumber,
      createdAt: bom.createdAt,
      updatedAt: bom.updatedAt,
      __v: bom.__v
    }));

    // ✅ Send uniform structured data
    res.status(200).json({
      success: true,
      data: formattedBOMs,
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

    const { name, description, materials, additionalCosts } = req.body;

    // Recalculate costs if materials or additional costs changed
    let shouldRecalculate = false;
    
    if (materials) {
      bom.materials = materials;
      shouldRecalculate = true;
    }
    
    if (additionalCosts !== undefined) {
      bom.additionalCosts = additionalCosts;
      shouldRecalculate = true;
    }

    if (shouldRecalculate) {
      // Calculate materials cost
      let materialsCost = 0;
      bom.materials.forEach(material => {
        const squareMeter = material.squareMeter || 0;
        const price = material.price || 0;
        const quantity = material.quantity || 1;
        const materialCost = price * squareMeter * quantity;
        materialsCost += materialCost;
      });

      // Calculate additional costs total
      let additionalCostsTotal = 0;
      if (bom.additionalCosts && bom.additionalCosts.length > 0) {
        bom.additionalCosts.forEach(cost => {
          additionalCostsTotal += cost.amount || 0;
        });
      }

      // Update costs
      bom.materialsCost = Number(materialsCost.toFixed(2));
      bom.additionalCostsTotal = Number(additionalCostsTotal.toFixed(2));
      bom.totalCost = Number((materialsCost + additionalCostsTotal).toFixed(2));
    }

    if (name) bom.name = name;
    if (description) bom.description = description;

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

    // Recalculate materials cost
    let materialsCost = 0;
    bom.materials.forEach(mat => {
      const squareMeter = mat.squareMeter || 0;
      const price = mat.price || 0;
      const quantity = mat.quantity || 1;
      const materialCost = price * squareMeter * quantity;
      materialsCost += materialCost;
    });

    bom.materialsCost = Number(materialsCost.toFixed(2));
    bom.totalCost = Number((bom.materialsCost + bom.additionalCostsTotal).toFixed(2));

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

    // Recalculate materials cost
    let materialsCost = 0;
    bom.materials.forEach(material => {
      const squareMeter = material.squareMeter || 0;
      const price = material.price || 0;
      const quantity = material.quantity || 1;
      const materialCost = price * squareMeter * quantity;
      materialsCost += materialCost;
    });

    bom.materialsCost = Number(materialsCost.toFixed(2));
    bom.totalCost = Number((bom.materialsCost + bom.additionalCostsTotal).toFixed(2));

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