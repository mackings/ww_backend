const Invoice = require('../../Models/invoice'); 
const Quotation = require('../../Models/quotationModel'); 
const ApiResponse = require('../../Utils/apiResponse');




exports.createInvoiceFromQuotation = async (req, res) => {
  try {
    const { quotationId, dueDate, notes, amountPaid } = req.body;

    // Validate quotation exists and belongs to user
    const quotation = await Quotation.findOne({
      _id: quotationId,
      userId: req.user._id
    });

    if (!quotation) {
      return ApiResponse.error(res, 'Quotation not found or unauthorized', 404);
    }

    // Check if quotation is approved or sent
    if (quotation.status !== 'approved' && quotation.status !== 'sent') {
      return ApiResponse.error(res, 'Only approved or sent quotations can be converted to invoices', 400);
    }

    // Check if invoice already exists for this quotation
    const existingInvoice = await Invoice.findOne({ quotationId });
    if (existingInvoice) {
      return ApiResponse.error(res, 'Invoice already exists for this quotation', 400);
    }

    // Create invoice by copying all data from quotation
    const invoice = new Invoice({
      userId: req.user._id,
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      clientName: quotation.clientName,
      clientAddress: quotation.clientAddress,
      nearestBusStop: quotation.nearestBusStop,
      phoneNumber: quotation.phoneNumber,
      email: quotation.email,
      description: quotation.description,
      items: quotation.items, // Copy all items from quotation
      service: quotation.service,
      discount: quotation.discount,
      totalCost: quotation.totalCost,
      totalSellingPrice: quotation.totalSellingPrice,
      discountAmount: quotation.discountAmount,
      finalTotal: quotation.finalTotal,
      amountPaid: amountPaid || 0,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      notes: notes || ''
    });

    await invoice.save();

    // Update quotation status to 'completed'
    quotation.status = 'completed';
    await quotation.save();

    return ApiResponse.success(res, 'Invoice created successfully', invoice, 201);
  } catch (error) {
    console.error('Create invoice error:', error);
    return ApiResponse.error(res, error.message || 'Server error creating invoice', 500);
  }
};

// Get all invoices for logged-in user
exports.getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = { userId: req.user._id };

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { quotationNumber: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('quotationId', 'quotationNumber status')
        .lean(),
      Invoice.countDocuments(filter)
    ]);

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalInvoices: total,
      limit: parseInt(limit)
    };

    return ApiResponse.success(res, 'Invoices fetched successfully', {
      invoices,
      pagination
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return ApiResponse.error(res, 'Server error fetching invoices', 500);
  }
};

// Get single invoice
exports.getInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({
      _id: id,
      userId: req.user._id
    }).populate('quotationId', 'quotationNumber status description');

    if (!invoice) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    return ApiResponse.success(res, 'Invoice fetched successfully', invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    return ApiResponse.error(res, 'Server error fetching invoice', 500);
  }
};

// Update invoice payment
exports.updateInvoicePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid, notes } = req.body;

    const invoice = await Invoice.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!invoice) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    if (invoice.status === 'cancelled') {
      return ApiResponse.error(res, 'Cannot update payment for cancelled invoice', 400);
    }

    // Update payment
    if (amountPaid !== undefined) {
      if (amountPaid < 0) {
        return ApiResponse.error(res, 'Payment amount cannot be negative', 400);
      }
      invoice.amountPaid = amountPaid;
    }

    if (notes !== undefined) {
      invoice.notes = notes;
    }

    await invoice.save(); // Pre-save hook will handle status updates

    return ApiResponse.success(res, 'Invoice payment updated successfully', invoice);
  } catch (error) {
    console.error('Update invoice payment error:', error);
    return ApiResponse.error(res, 'Server error updating invoice payment', 500);
  }
};

// Update invoice status
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return ApiResponse.error(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const invoice = await Invoice.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!invoice) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    invoice.status = status;
    await invoice.save();

    return ApiResponse.success(res, 'Invoice status updated successfully', invoice);
  } catch (error) {
    console.error('Update invoice status error:', error);
    return ApiResponse.error(res, 'Server error updating invoice status', 500);
  }
};

// Delete invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!invoice) {
      return ApiResponse.error(res, 'Invoice not found', 404);
    }

    return ApiResponse.success(res, 'Invoice deleted successfully', { id });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return ApiResponse.error(res, 'Server error deleting invoice', 500);
  }
};

// Get invoice statistics
exports.getInvoiceStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Invoice.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$finalTotal' },
          totalPaid: { $sum: '$amountPaid' },
          totalBalance: { $sum: '$balance' },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          },
          unpaidCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] }
          },
          partialCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, 1, 0] }
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          overdueCount: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalInvoices: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalBalance: 0,
      paidCount: 0,
      unpaidCount: 0,
      partialCount: 0,
      pendingCount: 0,
      overdueCount: 0
    };

    return ApiResponse.success(res, 'Invoice statistics fetched successfully', result);
  } catch (error) {
    console.error('Get invoice stats error:', error);
    return ApiResponse.error(res, 'Server error fetching invoice statistics', 500);
  }
};
    