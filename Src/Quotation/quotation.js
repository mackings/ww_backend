const Quotation = require('../../Models/quotationModel');
const BOM = require('../../Models/bomModel');
const Product = require('../../Models/productModel');
const { notifyCompany } = require('../../Utils/NotHelper');
const User = require("../../Models/user");

// @desc    Create new quotation
// @route   POST /api/quotations
// @access  Private



exports.createQuotation = async (req, res) => {
  try {
    const {
      clientName,
      clientAddress,
      nearestBusStop,
      phoneNumber,
      email,
      description,
      items,
      service,
      expectedDuration,
      expectedPeriod,
      dueDate,
      costPrice,
      overheadCost,
      discount,
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
      data: quotation
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
      .limit(parseInt(limit));

    const total = await Quotation.countDocuments(query);

    res.status(200).json({
      success: true,
      data: quotations,
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
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: quotation
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
