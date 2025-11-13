const Order = require('../../Models/orderModel'); 
const Quotation = require('../../Models/quotationModel'); 
const ApiResponse = require('../../Utils/apiResponse');



// Create order from quotation
exports.createOrderFromQuotation = async (req, res) => {
  try {
    const { 
      quotationId, 
      startDate, 
      endDate, 
      notes,
      amountPaid = 0
    } = req.body;

    const quotation = await Quotation.findOne({
      _id: quotationId,
      userId: req.user._id
    });

    if (!quotation) {
      return ApiResponse.error(res, 'Quotation not found or unauthorized', 404);
    }

    if (quotation.status !== 'approved' && quotation.status !== 'sent') {
      return ApiResponse.error(res, 'Only approved or sent quotations can be converted to orders', 400);
    }

    // Check if order already exists for this quotation
    const existingOrder = await Order.findOne({ quotationId });
    if (existingOrder) {
      return ApiResponse.error(res, 'Order already exists for this quotation', 400);
    }

    const order = new Order({
      userId: req.user._id,
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      clientName: quotation.clientName,
      clientAddress: quotation.clientAddress,
      nearestBusStop: quotation.nearestBusStop,
      phoneNumber: quotation.phoneNumber,
      email: quotation.email,
      description: quotation.description,
      items: quotation.items, 
      service: quotation.service,
      discount: quotation.discount,
      totalCost: quotation.totalCost,
      totalSellingPrice: quotation.totalSellingPrice,
      discountAmount: quotation.discountAmount,
      totalAmount: quotation.finalTotal,
      amountPaid: amountPaid || 0,
      startDate: startDate,
      endDate: endDate,
      notes: notes || ''
    });

    await order.save();

    // Update quotation status to 'completed'
    quotation.status = 'completed';
    await quotation.save();

    return ApiResponse.success(res, 'Order created successfully', order, 201);
  } catch (error) {
    console.error('Create order error:', error);
    return ApiResponse.error(res, error.message || 'Server error creating order', 500);
  }
};

// Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      search,
      startDate,
      endDate,
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
        { orderNumber: { $regex: search, $options: 'i' } },
        { quotationNumber: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate);
      if (endDate) filter.orderDate.$lte = new Date(endDate);
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('quotationId', 'quotationNumber status')
        .populate('invoiceId', 'invoiceNumber')
        .lean(),
      Order.countDocuments(filter)
    ]);

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalOrders: total,
      limit: parseInt(limit)
    };

    return ApiResponse.success(res, 'Orders fetched successfully', {
      orders,
      pagination
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return ApiResponse.error(res, 'Server error fetching orders', 500);
  }
};

// Get single order
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      userId: req.user._id
    })
      .populate('quotationId', 'quotationNumber status description')
      .populate('invoiceId', 'invoiceNumber');

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    return ApiResponse.success(res, 'Order fetched successfully', order);
  } catch (error) {
    console.error('Get order error:', error);
    return ApiResponse.error(res, 'Server error fetching order', 500);
  }
};

// Update order
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.userId;
    delete updates.orderNumber;
    delete updates.quotationId;
    delete updates.quotationNumber;
    delete updates.createdAt;

    const order = await Order.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    if (order.status === 'cancelled') {
      return ApiResponse.error(res, 'Cannot update cancelled order', 400);
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      order[key] = updates[key];
    });

    await order.save();

    return ApiResponse.success(res, 'Order updated successfully', order);
  } catch (error) {
    console.error('Update order error:', error);
    return ApiResponse.error(res, 'Server error updating order', 500);
  }
};

// Add payment to order


// Add payment to order
exports.addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, reference, notes, paymentDate } = req.body;

    // ✅ Ensure amount is numeric
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return ApiResponse.error(res, 'Valid numeric payment amount is required', 400);
    }

    // ✅ Find order owned by user
    const order = await Order.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    if (order.status === 'cancelled') {
      return ApiResponse.error(res, 'Cannot add payment to cancelled order', 400);
    }

    // ✅ Ensure totalAmount and amountPaid exist
    order.totalAmount = Number(order.totalAmount) || 0;
    order.amountPaid = Number(order.amountPaid) || 0;

    // ✅ Prevent overpayment
    if (order.amountPaid + numericAmount > order.totalAmount) {
      const remaining = order.totalAmount - order.amountPaid;
      return ApiResponse.error(
        res,
        `Payment exceeds remaining balance. Remaining: ₦${remaining}`,
        400
      );
    }

    // ✅ Record payment details
    const paymentRecord = {
      amount: numericAmount,
      paymentMethod: paymentMethod || 'cash',
      reference: reference || null,
      notes: notes || null,
      paymentDate: paymentDate || new Date(),
      recordedBy: req.user.name || req.user.email
    };

    order.payments.push(paymentRecord);

    // ✅ Update total paid
    order.amountPaid += numericAmount;

    // ✅ Automatically update payment status
    if (order.amountPaid >= order.totalAmount) {
      order.paymentStatus = 'paid';
    } else if (order.amountPaid > 0) {
      order.paymentStatus = 'partial';
    } else {
      order.paymentStatus = 'unpaid';
    }

    await order.save();

    // ✅ Calculate remaining balance
    const remainingBalance = order.totalAmount - order.amountPaid;

    // ✅ Return response
    return ApiResponse.success(res, 'Payment added successfully', {
      order,
      payment: paymentRecord,
      remainingBalance
    });

  } catch (error) {
    console.error('❌ Add payment error:', error);
    return ApiResponse.error(res, 'Server error adding payment', 500);
  }
};


// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled', 'on_hold'];
    if (!validStatuses.includes(status)) {
      return ApiResponse.error(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const order = await Order.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    order.status = status;
    await order.save();

    return ApiResponse.success(res, 'Order status updated successfully', order);
  } catch (error) {
    console.error('Update order status error:', error);
    return ApiResponse.error(res, 'Server error updating order status', 500);
  }
};

// Delete order
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    return ApiResponse.success(res, 'Order deleted successfully', { id });
  } catch (error) {
    console.error('Delete order error:', error);
    return ApiResponse.error(res, 'Server error deleting order', 500);
  }
};

// Get order statistics
exports.getOrderStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Order.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' },
          totalBalance: { $sum: '$balance' },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          inProgressCount: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          unpaidCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] }
          },
          partialCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, 1, 0] }
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalPaid: 0,
      totalBalance: 0,
      pendingCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      unpaidCount: 0,
      partialCount: 0,
      paidCount: 0
    };

    return ApiResponse.success(res, 'Order statistics fetched successfully', result);
  } catch (error) {
    console.error('Get order stats error:', error);
    return ApiResponse.error(res, 'Server error fetching order statistics', 500);
  }
};

// Get order receipt data (for PDF generation/download)
exports.getOrderReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      userId: req.user._id
    })
      .populate('quotationId', 'quotationNumber')
      .populate('userId', 'name email phoneNumber businessName businessAddress');

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    // Format data for receipt
    const receiptData = {
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      quotationNumber: order.quotationNumber,
      client: {
        name: order.clientName,
        phone: order.phoneNumber,
        email: order.email,
        address: order.clientAddress,
        nearestBusStop: order.nearestBusStop
      },
      business: {
        name: order.userId?.businessName || 'Woodworker',
        address: order.userId?.businessAddress,
        phone: order.userId?.phoneNumber,
        email: order.userId?.email
      },
      items: order.items,
      service: order.service,
      discount: order.discount,
      discountAmount: order.discountAmount,
      totalCost: order.totalCost,
      totalSellingPrice: order.totalSellingPrice,
      totalAmount: order.totalAmount,
      amountPaid: order.amountPaid,
      balance: order.balance,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      status: order.status,
      startDate: order.startDate,
      endDate: order.endDate,
      notes: order.notes,
      payments: order.payments
    };

    return ApiResponse.success(res, 'Order receipt data fetched successfully', receiptData);
  } catch (error) {
    console.error('Get order receipt error:', error);
    return ApiResponse.error(res, 'Server error fetching order receipt', 500);
  }
};