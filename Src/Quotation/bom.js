const BOM = require('../..//Models/bomModel');
const Product = require('../../Models/productModel');
const { notifyCompany } = require('../../Utils/NotHelper');
const User = require('../../Models/user');

// @desc    Create new BOM
// @route   POST /api/boms
// @access  Private

const calculateMaterialsTotal = (materials = []) => materials.reduce((sum, material) => {
  const squareMeter = material.squareMeter || 0;
  const price = material.price || 0;
  const quantity = material.quantity || 1;
  return sum + (price * squareMeter * quantity);
}, 0);

const calculateAdditionalTotal = (additionalCosts = []) => additionalCosts.reduce(
  (sum, cost) => sum + (cost.amount || 0),
  0
);

const applyPricing = (bom, pricingInput = {}) => {
  const materialsTotal = pricingInput.materialsTotal !== undefined
    ? Number(pricingInput.materialsTotal)
    : calculateMaterialsTotal(bom.materials);
  const additionalTotal = pricingInput.additionalTotal !== undefined
    ? Number(pricingInput.additionalTotal)
    : calculateAdditionalTotal(bom.additionalCosts);

  const overheadCost = pricingInput.overheadCost !== undefined
    ? Number(pricingInput.overheadCost)
    : (bom.pricing?.overheadCost || 0);

  const markupPercentage = pricingInput.markupPercentage !== undefined
    ? Number(pricingInput.markupPercentage)
    : (bom.pricing?.markupPercentage || 0);

  const costPrice = pricingInput.costPrice !== undefined
    ? Number(pricingInput.costPrice)
    : (materialsTotal + additionalTotal + overheadCost);

  const sellingPrice = pricingInput.sellingPrice !== undefined
    ? Number(pricingInput.sellingPrice)
    : (costPrice + (costPrice * markupPercentage) / 100);

  bom.pricing = {
    pricingMethod: pricingInput.pricingMethod || bom.pricing?.pricingMethod || null,
    markupPercentage,
    materialsTotal,
    additionalTotal,
    overheadCost,
    costPrice,
    sellingPrice
  };

  bom.materialsCost = Number(materialsTotal.toFixed(2));
  bom.additionalCostsTotal = Number(additionalTotal.toFixed(2));
  bom.totalCost = Number((materialsTotal + additionalTotal).toFixed(2));
};


exports.createBOM = async (req, res) => {
  try {
    const {
      name,
      description,
      materials,
      additionalCosts,
      productId,
      product,
      pricing,
      expectedDuration,
      dueDate
    } = req.body;

    if (!name || !materials || materials.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide BOM name and at least one material'
      });
    }

    let productSnapshot = null;
    let productRefId = null;

    if (productId) {
      const productRecord = await Product.findOne({
        productId: productId,
        $or: [
          { companyName: req.companyName },
          { isGlobal: true, status: 'approved' }
        ]
      });

      if (!productRecord) {
        return res.status(404).json({
          success: false,
          message: 'Product not found for this company'
        });
      }

      productSnapshot = {
        productId: productRecord.productId,
        name: productRecord.name,
        description: productRecord.description,
        image: productRecord.image
      };
      productRefId = productRecord._id;
    } else if (product && typeof product === 'object') {
      productSnapshot = {
        productId: product.productId || null,
        name: product.name || null,
        description: product.description || null,
        image: product.image || null
      };
    }

    // Auto-assign product name as material name
    const updatedMaterials = materials.map(mat => ({
      ...mat,
      name: productSnapshot?.name || mat.name
    }));

    // Create BOM linked to the Product
    const bom = new BOM({
      userId: req.user.id,
      companyName: req.companyName, // ✅ Add company name
      productId: productRefId,
      product: productSnapshot,
      name,
      description,
      materials: updatedMaterials,
      additionalCosts: additionalCosts || [],
      dueDate: dueDate || null,
      expectedDuration: expectedDuration || null
    });

    applyPricing(bom, pricing || {});
    await bom.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'bom_created',
      title: 'New BOM Created',
      message: `${currentUser.fullname} created a new BOM: ${name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        bomId: bom._id,
        bomName: name,
        productName: productSnapshot?.name || null,
        totalCost: bom.totalCost.toFixed(2),
        sellingPrice: bom.pricing?.sellingPrice?.toFixed(2)
      },
      excludeUserId: req.user.id
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

/**
 * @desc    Get all BOMs
 * @route   GET /api/boms
 * @access  Private
 */
exports.getAllBOMs = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { companyName: req.companyName }; // ✅ Filter by company

    // Optional search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { bomNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch BOMs with product populated
    const boms = await BOM.find(query)
      .populate({
        path: "productId",
        select: "name productId description image"
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await BOM.countDocuments(query);

    // Structure each BOM properly
    const formattedBOMs = boms.map(bom => ({
      _id: bom._id,
      userId: bom.userId,
      product: bom.product ? {
        productId: bom.product.productId || null,
        name: bom.product.name || null,
        description: bom.product.description || null,
        image: bom.product.image || null
      } : (bom.productId ? {
        productId: bom.productId.productId,
        name: bom.productId.name,
        description: bom.productId.description,
        image: bom.productId.image
      } : null),
      name: bom.name,
      description: bom.description,
      materials: bom.materials,
      additionalCosts: bom.additionalCosts,
      materialsCost: bom.materialsCost,
      additionalCostsTotal: bom.additionalCostsTotal,
      totalCost: bom.totalCost,
      pricing: bom.pricing || null,
      expectedDuration: bom.expectedDuration || null,
      quotationId: bom.quotationId,
      bomNumber: bom.bomNumber,
      dueDate: bom.dueDate || null,
      createdAt: bom.createdAt,
      updatedAt: bom.updatedAt
    }));

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

/**
 * @desc    Get single BOM
 * @route   GET /api/boms/:id
 * @access  Private
 */
exports.getBOM = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
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

/**
 * @desc    Update BOM
 * @route   PUT /api/boms/:id
 * @access  Private
 */
exports.updateBOM = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: 'BOM not found'
      });
    }

    const {
      name,
      description,
      materials,
      additionalCosts,
      dueDate,
      product,
      pricing,
      expectedDuration
    } = req.body;

    // Store old values
    const oldName = bom.name;
    const oldTotalCost = bom.totalCost;

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

    if (product && typeof product === 'object') {
      bom.product = {
        productId: product.productId || bom.product?.productId || null,
        name: product.name || bom.product?.name || null,
        description: product.description || bom.product?.description || null,
        image: product.image || bom.product?.image || null
      };
    }

    if (name) bom.name = name;
    if (description) bom.description = description;
    if (dueDate !== undefined) bom.dueDate = dueDate;
    if (expectedDuration !== undefined) bom.expectedDuration = expectedDuration;

    if (shouldRecalculate || pricing) {
      applyPricing(bom, pricing || {});
    }

    await bom.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'bom_updated',
      title: 'BOM Updated',
      message: `${currentUser.fullname} updated BOM: ${bom.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        bomId: bom._id,
        oldName,
        newName: bom.name,
        oldTotalCost: oldTotalCost.toFixed(2),
        newTotalCost: bom.totalCost.toFixed(2)
      },
      excludeUserId: req.user.id
    });

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

/**
 * @desc    Delete BOM
 * @route   DELETE /api/boms/:id
 * @access  Private
 */
exports.deleteBOM = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: 'BOM not found'
      });
    }

    // Store info before deletion
    const bomName = bom.name;
    const totalCost = bom.totalCost;

    await bom.deleteOne();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'bom_deleted',
      title: 'BOM Deleted',
      message: `${currentUser.fullname} deleted BOM: ${bomName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        bomName,
        totalCost: totalCost.toFixed(2)
      },
      excludeUserId: req.user.id
    });

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

/**
 * @desc    Add material to BOM
 * @route   POST /api/boms/:id/materials
 * @access  Private
 */
exports.addMaterialToBOM = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
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

    applyPricing(bom);

    await bom.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'bom_updated',
      title: 'Material Added to BOM',
      message: `${currentUser.fullname} added material to BOM: ${bom.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        bomId: bom._id,
        bomName: bom.name,
        materialName: material.name || 'New Material',
        newTotalCost: bom.totalCost.toFixed(2),
        sellingPrice: bom.pricing?.sellingPrice?.toFixed(2)
      },
      excludeUserId: req.user.id
    });

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

/**
 * @desc    Delete material from BOM
 * @route   DELETE /api/boms/:id/materials/:materialId
 * @access  Private
 */
exports.deleteMaterialFromBOM = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: 'BOM not found'
      });
    }

    // Find material before deletion
    const materialToDelete = bom.materials.find(
      material => material._id.toString() === req.params.materialId
    );

    bom.materials = bom.materials.filter(
      material => material._id.toString() !== req.params.materialId
    );

    applyPricing(bom);

    await bom.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'bom_updated',
      title: 'Material Removed from BOM',
      message: `${currentUser.fullname} removed material from BOM: ${bom.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        bomId: bom._id,
        bomName: bom.name,
        materialName: materialToDelete?.name || 'Material',
        newTotalCost: bom.totalCost.toFixed(2),
        sellingPrice: bom.pricing?.sellingPrice?.toFixed(2)
      },
      excludeUserId: req.user.id
    });

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

/**
 * @desc    Add additional cost to BOM
 * @route   POST /api/boms/:id/additional-costs
 * @access  Private
 */
exports.addAdditionalCost = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
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

    applyPricing(bom);

    await bom.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'bom_updated',
      title: 'Additional Cost Added to BOM',
      message: `${currentUser.fullname} added ${name} cost to BOM: ${bom.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        bomId: bom._id,
        bomName: bom.name,
        costName: name,
        costAmount: amount.toFixed(2),
        newTotalCost: bom.totalCost.toFixed(2),
        sellingPrice: bom.pricing?.sellingPrice?.toFixed(2)
      },
      excludeUserId: req.user.id
    });

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

/**
 * @desc    Delete additional cost from BOM
 * @route   DELETE /api/boms/:id/additional-costs/:costId
 * @access  Private
 */
exports.deleteAdditionalCost = async (req, res) => {
  try {
    const bom = await BOM.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: 'BOM not found'
      });
    }

    // Find cost before deletion
    const costToDelete = bom.additionalCosts.find(
      cost => cost._id.toString() === req.params.costId
    );

    bom.additionalCosts = bom.additionalCosts.filter(
      cost => cost._id.toString() !== req.params.costId
    );

    applyPricing(bom);

    await bom.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'bom_updated',
      title: 'Additional Cost Removed from BOM',
      message: `${currentUser.fullname} removed ${costToDelete?.name || 'cost'} from BOM: ${bom.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        bomId: bom._id,
        bomName: bom.name,
        costName: costToDelete?.name || 'Cost',
        newTotalCost: bom.totalCost.toFixed(2),
        sellingPrice: bom.pricing?.sellingPrice?.toFixed(2)
      },
      excludeUserId: req.user.id
    });

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
