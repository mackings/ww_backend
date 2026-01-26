const Quotation = require('../../Models/quotationModel');
const BOM = require('../../Models/bomModel');
const Product = require('../../Models/productModel');
const Counter = require('../../Models/counterModel');
const { notifyCompany } = require('../../Utils/NotHelper');
const User = require("../../Models/user");

// @desc    Create new quotation
// @route   POST /api/quotations
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

const syncBomCounter = async () => {
  const latest = await BOM.findOne({ bomNumber: { $regex: /^BOM-\d+/ } })
    .sort({ createdAt: -1 })
    .select('bomNumber')
    .lean();

  const maxSeq = latest?.bomNumber
    ? parseInt(String(latest.bomNumber).replace('BOM-', ''), 10)
    : 0;

  if (Number.isNaN(maxSeq)) return;

  await Counter.findOneAndUpdate(
    { key: 'bomNumber' },
    { $max: { seq: maxSeq } },
    { upsert: true }
  );
};

const saveBomWithRetry = async (bom, retries = 2) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await bom.save();
      return bom;
    } catch (error) {
      lastError = error;
      if (error?.code === 11000 && error?.keyPattern?.bomNumber) {
        await syncBomCounter();
        bom.bomNumber = undefined;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

const createBomForQuotation = async ({ bomInput, quotation, req }) => {
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
  } = bomInput || {};

  if (!materials || !Array.isArray(materials) || materials.length === 0) {
    throw new Error('Each BOM must include at least one material');
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
      throw new Error('Product not found for this company');
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

  const bomName = name || productSnapshot?.name;
  if (!bomName) {
    throw new Error('Each BOM must include a name or valid product');
  }

  const updatedMaterials = materials.map(mat => ({
    ...mat,
    name: productSnapshot?.name || mat.name
  }));

  if (updatedMaterials.some(mat => !mat.name)) {
    throw new Error('Each BOM material must include a name');
  }

  const bomData = {
    userId: req.user.id,
    companyName: req.companyName,
    quotationId: quotation._id,
    productId: productRefId,
    product: productSnapshot,
    name: bomName,
    description,
    materials: updatedMaterials,
    additionalCosts: additionalCosts || [],
    dueDate: dueDate || null
  };

  if (
    expectedDuration &&
    typeof expectedDuration === 'object' &&
    expectedDuration.value !== null &&
    expectedDuration.value !== undefined
  ) {
    bomData.expectedDuration = expectedDuration;
  }

  const bom = new BOM(bomData);

  applyPricing(bom, pricing || {});
  await saveBomWithRetry(bom);
  return bom;
};

const createDefaultBomFromQuotation = async ({ quotation, req, productId, product }) => {
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

    if (productRecord) {
      productSnapshot = {
        productId: productRecord.productId,
        name: productRecord.name,
        description: productRecord.description,
        image: productRecord.image
      };
      productRefId = productRecord._id;
    }
  } else if (product && typeof product === 'object') {
    productSnapshot = {
      productId: product.productId || null,
      name: product.name || null,
      description: product.description || null,
      image: product.image || null
    };
  }

  const materials = (quotation.items || []).map(item => {
    const quantity = item.quantity || 1;
    const pricePerUnit = quantity > 0 ? (item.costPrice || 0) / quantity : (item.costPrice || 0);

    return {
      name: item.description || item.woodType || 'Material',
      woodType: item.woodType || null,
      foamType: item.foamType || null,
      width: item.width,
      height: item.height,
      length: item.length,
      thickness: item.thickness,
      unit: item.unit,
      squareMeter: item.squareMeter,
      price: pricePerUnit,
      quantity,
      description: item.description || null
    };
  });

  if (!productSnapshot) {
    const firstImage = (quotation.items || []).find(item => item && item.image)?.image || null;
    if (firstImage) {
      productSnapshot = {
        productId: null,
        name: quotation.description || quotation.clientName || quotation.quotationNumber || 'Quotation BOM',
        description: quotation.description || null,
        image: firstImage
      };
    }
  }

  const bomName = productSnapshot?.name || quotation.description || quotation.clientName || quotation.quotationNumber || 'Quotation BOM';

  const bomData = {
    userId: req.user.id,
    companyName: req.companyName,
    quotationId: quotation._id,
    productId: productRefId,
    product: productSnapshot,
    name: bomName,
    description: `Auto BOM for ${quotation.quotationNumber}`,
    materials,
    additionalCosts: [],
    dueDate: quotation.dueDate || null
  };

  if (
    quotation.expectedDuration &&
    typeof quotation.expectedDuration === 'object' &&
    quotation.expectedDuration.value !== null &&
    quotation.expectedDuration.value !== undefined
  ) {
    bomData.expectedDuration = quotation.expectedDuration;
  }

  const bom = new BOM(bomData);

  applyPricing(bom, {
    materialsTotal: quotation.totalCost || 0,
    additionalTotal: 0,
    overheadCost: quotation.overheadCost || 0,
    costPrice: quotation.costPrice || 0,
    sellingPrice: quotation.totalSellingPrice || 0
  });

  await saveBomWithRetry(bom);
  return bom;
};



exports.createQuotation = async (req, res) => {
  try {
    const {
      clientName,
      clientAddress,
      nearestBusStop,
      phoneNumber,
      email,
      description,
      productId,
      product,
      items,
      service,
      expectedDuration,
      expectedPeriod,
      dueDate,
      costPrice,
      overheadCost,
      discount,
      boms
    } = req.body;

    // Validation
    if (!clientName || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide client name and at least one item'
      });
    }

    // Calculate totals from items
    let totalCost = 0;
    let totalSellingPrice = 0;

    items.forEach(item => {
      const itemQuantity = item.quantity || 1;
      totalCost += (item.costPrice || 0) * itemQuantity;
      totalSellingPrice += (item.sellingPrice || 0) * itemQuantity;
    });

    // Handle expected duration
    let durationData = null;
    if (expectedDuration) {
      durationData = {
        value: expectedDuration,
        unit: expectedPeriod || 'Day'
      };
    } else if (typeof expectedDuration === 'object') {
      durationData = expectedDuration;
    }

    // Use provided cost breakdown or calculate from items
    const quotationCostPrice = costPrice || totalCost;
    const quotationOverheadCost = overheadCost || 0;
    const quotationSellingPrice = quotationCostPrice + quotationOverheadCost;

    // Calculate discount amount
    let discountAmount = 0;
    if (discount && discount > 0) {
      discountAmount = (quotationSellingPrice * discount) / 100;
    }

    // Final total
    const finalTotal = service?.totalPrice || (quotationSellingPrice - discountAmount);

    const quotation = await Quotation.create({
      userId: req.user.id,
      companyName: req.companyName, // ✅ Add company name
      clientName,
      clientAddress,
      nearestBusStop,
      phoneNumber,
      email,
      description,
      items,
      service,
      expectedDuration: durationData,
      dueDate: dueDate || null,
      costPrice: quotationCostPrice,
      overheadCost: quotationOverheadCost,
      discount: discount || 0,
      totalCost,
      totalSellingPrice: quotationSellingPrice,
      discountAmount,
      finalTotal,
      status: 'sent'
    });

    let createdBoms = [];
    try {
      const defaultBom = await createDefaultBomFromQuotation({
        quotation,
        req,
        productId,
        product
      });
      createdBoms.push(defaultBom);

      if (boms !== undefined) {
        if (!Array.isArray(boms) || boms.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'BOMs must be a non-empty array when provided'
          });
        }

        const extraBoms = await Promise.all(
          boms.map(bomInput => createBomForQuotation({ bomInput, quotation, req }))
        );
        createdBoms = createdBoms.concat(extraBoms);
      }
    } catch (bomError) {
      await BOM.deleteMany({ quotationId: quotation._id, companyName: req.companyName });
      await Quotation.deleteOne({ _id: quotation._id, companyName: req.companyName });
      return res.status(400).json({
        success: false,
        message: bomError.message || 'Error creating BOMs for quotation'
      });
    }

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'quotation_created',
      title: 'New Quotation Created',
      message: `${currentUser.fullname} created a quotation for ${clientName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        quotationId: quotation._id,
        quotationNumber: quotation.quotationNumber,
        clientName,
        finalTotal: finalTotal.toFixed(2)
      },
      excludeUserId: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: {
        ...quotation.toObject(),
        boms: createdBoms
      }
    });
  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating quotation',
      error: error.message
    });
  }
};

/**
 * @desc    Get all quotations
 * @route   GET /api/quotations
 * @access  Private
 */
exports.getAllQuotations = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    // Filter by company
    const query = { companyName: req.companyName };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { clientName: { $regex: search, $options: 'i' } },
        { quotationNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const quotations = await Quotation.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const quotationIds = quotations.map(q => q._id);
    const boms = quotationIds.length
      ? await BOM.find({
        companyName: req.companyName,
        quotationId: { $in: quotationIds }
      }).lean()
      : [];

    const bomsByQuotation = new Map();
    boms.forEach(bom => {
      const key = String(bom.quotationId);
      if (!bomsByQuotation.has(key)) bomsByQuotation.set(key, []);
      bomsByQuotation.get(key).push(bom);
    });

    const quotationsWithBoms = quotations.map(q => ({
      ...q,
      boms: bomsByQuotation.get(String(q._id)) || []
    }));

    const total = await Quotation.countDocuments(query);

    res.status(200).json({
      success: true,
      data: quotationsWithBoms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotations'
    });
  }
};

/**
 * @desc    Get single quotation
 * @route   GET /api/quotations/:id
 * @access  Private
 */
exports.getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    }).lean();

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    const boms = await BOM.find({
      companyName: req.companyName,
      quotationId: quotation._id
    }).lean();

    res.status(200).json({
      success: true,
      data: {
        ...quotation,
        boms
      }
    });
  } catch (error) {
    console.error('Get quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotation'
    });
  }
};

/**
 * @desc    Update quotation
 * @route   PUT /api/quotations/:id
 * @access  Private
 */
exports.updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    const {
      clientName,
      clientAddress,
      nearestBusStop,
      phoneNumber,
      email,
      description,
      items,
      service,
      discount,
      status,
      dueDate
    } = req.body;

    // Store old values
    const oldClientName = quotation.clientName;
    const oldStatus = quotation.status;
    const oldTotal = quotation.finalTotal;

    // Recalculate totals if items changed
    if (items) {
      let totalCost = 0;
      let totalSellingPrice = 0;

      items.forEach(item => {
        totalCost += item.costPrice || 0;
        totalSellingPrice += item.sellingPrice || 0;
      });

      const discountAmount = discount ? (totalSellingPrice * discount) / 100 : 0;
      const finalTotal = totalSellingPrice - discountAmount;

      quotation.totalCost = totalCost;
      quotation.totalSellingPrice = totalSellingPrice;
      quotation.discountAmount = discountAmount;
      quotation.finalTotal = finalTotal;
    }

    // Update fields
    if (clientName) quotation.clientName = clientName;
    if (clientAddress) quotation.clientAddress = clientAddress;
    if (nearestBusStop) quotation.nearestBusStop = nearestBusStop;
    if (phoneNumber) quotation.phoneNumber = phoneNumber;
    if (email) quotation.email = email;
    if (description) quotation.description = description;
    if (items) quotation.items = items;
    if (service) quotation.service = service;
    if (discount !== undefined) quotation.discount = discount;
    if (status) quotation.status = status;
    if (dueDate !== undefined) quotation.dueDate = dueDate;

    await quotation.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'quotation_updated',
      title: 'Quotation Updated',
      message: `${currentUser.fullname} updated quotation for ${quotation.clientName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        quotationId: quotation._id,
        quotationNumber: quotation.quotationNumber,
        clientName: quotation.clientName,
        oldStatus,
        newStatus: quotation.status,
        finalTotal: quotation.finalTotal.toFixed(2)
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Quotation updated successfully',
      data: quotation
    });
  } catch (error) {
    console.error('Update quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating quotation'
    });
  }
};

/**
 * @desc    Delete quotation
 * @route   DELETE /api/quotations/:id
 * @access  Private
 */
exports.deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Store info before deletion
    const clientName = quotation.clientName;
    const quotationNumber = quotation.quotationNumber;
    const finalTotal = quotation.finalTotal;

    await quotation.deleteOne();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'quotation_deleted',
      title: 'Quotation Deleted',
      message: `${currentUser.fullname} deleted quotation for ${clientName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        quotationNumber,
        clientName,
        finalTotal: finalTotal.toFixed(2)
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Quotation deleted successfully'
    });
  } catch (error) {
    console.error('Delete quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting quotation'
    });
  }
};

/**
 * @desc    Add item to quotation
 * @route   POST /api/quotations/:id/items
 * @access  Private
 */
exports.addItemToQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    const { item } = req.body;

    if (!item) {
      return res.status(400).json({
        success: false,
        message: 'Please provide item details'
      });
    }

    quotation.items.push(item);

    // Recalculate totals
    let totalCost = 0;
    let totalSellingPrice = 0;

    quotation.items.forEach(itm => {
      totalCost += itm.costPrice || 0;
      totalSellingPrice += itm.sellingPrice || 0;
    });

    const discountAmount = quotation.discount ? (totalSellingPrice * quotation.discount) / 100 : 0;
    quotation.totalCost = totalCost;
    quotation.totalSellingPrice = totalSellingPrice;
    quotation.discountAmount = discountAmount;
    quotation.finalTotal = totalSellingPrice - discountAmount;

    await quotation.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'quotation_updated',
      title: 'Item Added to Quotation',
      message: `${currentUser.fullname} added item to quotation for ${quotation.clientName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        quotationId: quotation._id,
        quotationNumber: quotation.quotationNumber,
        clientName: quotation.clientName,
        itemName: item.name || 'New Item',
        newTotal: quotation.finalTotal.toFixed(2)
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Item added successfully',
      data: quotation
    });
  } catch (error) {
    console.error('Add item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding item'
    });
  }
};

/**
 * @desc    Delete item from quotation
 * @route   DELETE /api/quotations/:id/items/:itemId
 * @access  Private
 */
exports.deleteItemFromQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Find item before deletion
    const itemToDelete = quotation.items.find(
      item => item._id.toString() === req.params.itemId
    );

    quotation.items = quotation.items.filter(
      item => item._id.toString() !== req.params.itemId
    );

    // Recalculate totals
    let totalCost = 0;
    let totalSellingPrice = 0;

    quotation.items.forEach(item => {
      totalCost += item.costPrice || 0;
      totalSellingPrice += item.sellingPrice || 0;
    });

    const discountAmount = quotation.discount ? (totalSellingPrice * quotation.discount) / 100 : 0;
    quotation.totalCost = totalCost;
    quotation.totalSellingPrice = totalSellingPrice;
    quotation.discountAmount = discountAmount;
    quotation.finalTotal = totalSellingPrice - discountAmount;

    await quotation.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'quotation_updated',
      title: 'Item Removed from Quotation',
      message: `${currentUser.fullname} removed item from quotation for ${quotation.clientName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        quotationId: quotation._id,
        quotationNumber: quotation.quotationNumber,
        clientName: quotation.clientName,
        itemName: itemToDelete?.name || 'Item',
        newTotal: quotation.finalTotal.toFixed(2)
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
      data: quotation
    });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting item'
    });
  }
};

/**
 * @desc    Generate PDF for quotation
 * @route   GET /api/quotations/:id/pdf
 * @access  Private
 */
exports.generateQuotationPDF = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // TODO: Implement PDF generation using libraries like pdfkit or puppeteer

    res.status(200).json({
      success: true,
      message: 'PDF generation endpoint',
      data: quotation,
      note: 'Implement PDF generation with pdfkit or puppeteer'
    });
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF'
    });
  }
};
