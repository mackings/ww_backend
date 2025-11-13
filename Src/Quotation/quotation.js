const Quotation = require('../../Models/quotationModel');
const BOM = require('../../Models/bomModel');
const Product = require('../../Models/productModel');

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
    } = req.body;

    // Validation
    if (!clientName || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide client name and at least one item'
      });
    }

    // Calculate totals with quantity (for reference/audit only)
    let totalCost = 0;
    let totalSellingPrice = 0;

    items.forEach(item => {
      const itemQuantity = item.quantity || 1;
      totalCost += (item.costPrice || 0) * itemQuantity;
      totalSellingPrice += (item.sellingPrice || 0) * itemQuantity;
    });

    // Use service.totalPrice as finalTotal (already calculated in the app)
    const finalTotal = service?.totalPrice || totalSellingPrice;

    const quotation = await Quotation.create({
      userId: req.user.id,
      clientName,
      clientAddress,
      nearestBusStop,
      phoneNumber,
      email,
      description,
      items,
      service,
      totalCost,
      totalSellingPrice,
      finalTotal,  // Use service.totalPrice from the app
      status: 'draft'
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


// @desc    Get all quotations
// @route   GET /api/quotations
// @access  Private
exports.getAllQuotations = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const query = { userId: req.user.id };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search by client name or BOM number
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

// @desc    Get single quotation
// @route   GET /api/quotations/:id
// @access  Private
exports.getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      userId: req.user.id
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

// @desc    Update quotation
// @route   PUT /api/quotations/:id
// @access  Private
exports.updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      userId: req.user.id
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
      status
    } = req.body;

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

    await quotation.save();

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



// @desc    Delete quotation
// @route   DELETE /api/quotations/:id
// @access  Private
exports.deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

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

// @desc    Add item to quotation
// @route   POST /api/quotations/:id/items
// @access  Private
exports.addItemToQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      userId: req.user.id
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

// @desc    Delete item from quotation
// @route   DELETE /api/quotations/:id/items/:itemId
// @access  Private
exports.deleteItemFromQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

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

// @desc    Generate PDF for quotation
// @route   GET /api/quotations/:id/pdf
// @access  Private
exports.generateQuotationPDF = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // TODO: Implement PDF generation using libraries like pdfkit or puppeteer
    // For now, return quotation data
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