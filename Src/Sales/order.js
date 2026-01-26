const Order = require('../../Models/orderModel'); 
const Quotation = require('../../Models/quotationModel'); 
const BOM = require('../../Models/bomModel');
const Receipt = require('../../Models/receiptModel');
const ApiResponse = require('../../Utils/apiResponse');
const User = require("../../Models/user");
const { notifyCompany, notifyUser } = require('../../Utils/NotHelper');
const { sendEmail } = require('../../Utils/emailUtil');



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
      companyName: req.companyName // ✅ Filter by company
    });

    if (!quotation) {
      return ApiResponse.error(res, 'Quotation not found or unauthorized', 404);
    }

    if (quotation.status !== 'approved' && quotation.status !== 'sent') {
      return ApiResponse.error(res, 'Only approved or sent quotations can be converted to orders', 400);
    }

    // Check if order already exists
    const existingOrder = await Order.findOne({ quotationId });
    if (existingOrder) {
      return ApiResponse.error(res, 'Order already exists for this quotation', 400);
    }

    const boms = await BOM.find({
      quotationId: quotation._id,
      companyName: req.companyName
    });

    if (!boms.length) {
      return ApiResponse.error(res, 'No BOMs found for this quotation', 400);
    }

    const bomSnapshots = boms.map(bom => ({
      bomId: bom._id,
      bomNumber: bom.bomNumber,
      name: bom.name,
      description: bom.description,
      productId: bom.productId || null,
      product: bom.product || null,
      materials: bom.materials || [],
      additionalCosts: bom.additionalCosts || [],
      materialsCost: bom.materialsCost || 0,
      additionalCostsTotal: bom.additionalCostsTotal || 0,
      totalCost: bom.totalCost || 0,
      pricing: bom.pricing || {},
      expectedDuration: bom.expectedDuration || null,
      dueDate: bom.dueDate || null
    }));

    const order = new Order({
      userId: req.user._id,
      companyName: req.companyName, // ✅ Add company name
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      clientName: quotation.clientName,
      clientAddress: quotation.clientAddress,
      nearestBusStop: quotation.nearestBusStop,
      phoneNumber: quotation.phoneNumber,
      email: quotation.email,
      description: quotation.description,
      items: quotation.items, 
      boms: bomSnapshots,
      bomIds: boms.map(bom => bom._id),
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

    // Update quotation status
    quotation.status = 'completed';
    await quotation.save();

    // Get current user
    const currentUser = await User.findById(req.user._id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'order_created',
      title: 'New Order Created',
      message: `${currentUser.fullname} created order ${order.orderNumber} for ${quotation.clientName}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        quotationNumber: quotation.quotationNumber,
        clientName: quotation.clientName,
        totalAmount: order.totalAmount.toFixed(2),
        amountPaid: order.amountPaid.toFixed(2),
        status: order.status
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Order created successfully', order, 201);
  } catch (error) {
    console.error('Create order error:', error);
    return ApiResponse.error(res, error.message || 'Server error creating order', 500);
  }
};

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Private
 */
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
      sortOrder = 'desc',
      assignedTo,
      showMyAssignments = false
    } = req.query;

    // Filter by company
    const filter = { companyName: req.companyName };

    // Handle staff viewing their assignments
    if (showMyAssignments === 'true' || showMyAssignments === true) {
      filter.assignedTo = req.user._id;
    } else {
      if (req.user.role === 'staff') {
        filter.assignedTo = req.user._id;
      } else {
        if (assignedTo) {
          if (assignedTo === 'unassigned') {
            filter.assignedTo = null;
          } else {
            filter.assignedTo = assignedTo;
          }
        }
      }
    }

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

    // Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('quotationId', 'quotationNumber status')
        .populate('invoiceId', 'invoiceNumber')
        .populate('assignedTo', 'fullname email phoneNumber position role')
        .populate('assignedBy', 'fullname email position')
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

/**
 * @desc    Get single order
 * @route   GET /api/orders/:id
 * @access  Private
 */
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      companyName: req.companyName // ✅ Filter by company
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

/**
 * @desc    Update order
 * @route   PUT /api/orders/:id
 * @access  Private
 */
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
      companyName: req.companyName // ✅ Filter by company
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    if (order.status === 'cancelled') {
      return ApiResponse.error(res, 'Cannot update cancelled order', 400);
    }

    // Store old values
    const oldStatus = order.status;

    // Apply updates
    Object.keys(updates).forEach(key => {
      order[key] = updates[key];
    });

    await order.save();

    // Get current user
    const currentUser = await User.findById(req.user._id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'order_updated',
      title: 'Order Updated',
      message: `${currentUser.fullname} updated order ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        oldStatus,
        newStatus: order.status
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Order updated successfully', order);
  } catch (error) {
    console.error('Update order error:', error);
    return ApiResponse.error(res, 'Server error updating order', 500);
  }
};

/**
 * @desc    Add payment to order
 * @route   POST /api/orders/:id/payment
 * @access  Private
 */
exports.addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, reference, notes, paymentDate } = req.body;

    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return ApiResponse.error(res, 'Valid numeric payment amount is required', 400);
    }

    // Allow access if user created order or is assigned
    const order = await Order.findOne({
      _id: id,
      $or: [
        { userId: req.user._id },
        { assignedTo: req.user._id }
      ]
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found or unauthorized', 404);
    }

    if (order.status === 'cancelled') {
      return ApiResponse.error(res, 'Cannot add payment to cancelled order', 400);
    }

    order.totalAmount = Number(order.totalAmount) || 0;
    order.amountPaid = Number(order.amountPaid) || 0;

    if (order.amountPaid + numericAmount > order.totalAmount) {
      const remaining = order.totalAmount - order.amountPaid;
      return ApiResponse.error(
        res,
        `Payment exceeds remaining balance. Remaining: ₦${remaining}`,
        400
      );
    }

    const paymentRecord = {
      amount: numericAmount,
      paymentMethod: paymentMethod || 'cash',
      reference: reference || null,
      notes: notes || null,
      paymentDate: paymentDate || new Date(),
      recordedBy: req.user.fullname || req.user.email
    };

    const oldAmountPaid = order.amountPaid;
    const oldPaymentStatus = order.paymentStatus;

    order.payments.push(paymentRecord);
    order.amountPaid += numericAmount;

    if (order.amountPaid >= order.totalAmount) {
      order.paymentStatus = 'paid';
    } else if (order.amountPaid > 0) {
      order.paymentStatus = 'partial';
    } else {
      order.paymentStatus = 'unpaid';
    }

    await order.save();

    const remainingBalance = order.totalAmount - order.amountPaid;

    const receipt = await Receipt.create({
      userId: req.user._id,
      companyName: req.companyName,
      orderId: order._id,
      orderNumber: order.orderNumber,
      invoiceId: order.invoiceId || null,
      quotationId: order.quotationId || null,
      quotationNumber: order.quotationNumber || null,
      receiptDate: paymentRecord.paymentDate,
      clientName: order.clientName,
      clientAddress: order.clientAddress,
      nearestBusStop: order.nearestBusStop,
      phoneNumber: order.phoneNumber,
      email: order.email,
      subtotal: order.totalSellingPrice || 0,
      discount: order.discount || 0,
      discountAmount: order.discountAmount || 0,
      totalAmount: order.totalAmount || 0,
      amountPaid: numericAmount,
      balance: remainingBalance,
      currency: order.currency || 'NGN',
      paymentMethod: paymentRecord.paymentMethod,
      reference: paymentRecord.reference,
      notes: paymentRecord.notes,
      recordedBy: paymentRecord.recordedBy,
      recordedAt: paymentRecord.paymentDate
    });

    if (order.email) {
      try {
        const formatMoney = (value) =>
          `₦${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const paymentDate = new Date(receipt.receiptDate || receipt.createdAt);
        const formattedPaymentDate = paymentDate.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: 'numeric',
          minute: '2-digit'
        });

        await sendEmail({
          to: order.email,
          subject: `Receipt ${receipt.receiptNumber} for Order ${order.orderNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <div style="background:#A16438; color:#fff; padding:24px 20px; border-radius:12px 12px 0 0;">
                <h2 style="margin:0; font-size:28px;">${req.companyName}</h2>
                <p style="margin:6px 0 0; font-size:16px; opacity:0.9;">Receipt ${receipt.receiptNumber}</p>
              </div>
              <div style="padding:20px; border:1px solid #eee; border-top:0; border-radius:0 0 12px 12px;">
                <p style="font-size:15px;"><strong>Payment Date:</strong> ${formattedPaymentDate}</p>
                <div style="border:1px solid #eee; border-radius:12px; padding:16px; margin:16px 0;">
                  <h3 style="margin:0 0 8px;">Client Information</h3>
                  <p style="margin:4px 0;"><strong>Name:</strong> ${order.clientName || '-'}</p>
                  <p style="margin:4px 0;"><strong>Email:</strong> ${order.email || '-'}</p>
                  <p style="margin:4px 0;"><strong>Phone:</strong> ${order.phoneNumber || '-'}</p>
                  <p style="margin:4px 0;"><strong>Address:</strong> ${order.clientAddress || '-'}</p>
                </div>
                <div style="border:1px solid #eee; border-radius:12px; padding:16px; margin:16px 0;">
                  <p style="margin:6px 0;"><strong>Subtotal:</strong> ${formatMoney(receipt.subtotal)}</p>
                  <p style="margin:6px 0;"><strong>Discount:</strong> -${formatMoney(receipt.discountAmount)}</p>
                  <hr style="border:none; border-top:1px solid #eee; margin:12px 0;" />
                  <p style="margin:6px 0; font-size:18px;"><strong>Total Amount:</strong> ${formatMoney(receipt.totalAmount)}</p>
                  <p style="margin:6px 0;"><strong>Amount Paid:</strong> ${formatMoney(receipt.amountPaid)}</p>
                  <hr style="border:none; border-top:1px solid #eee; margin:12px 0;" />
                  <p style="margin:6px 0; font-size:18px; color:#A16438;"><strong>Balance:</strong> ${formatMoney(receipt.balance)}</p>
                </div>
                <p style="font-size:13px; color:#777; text-align:center; margin-top:16px;">Woodworker</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Receipt email error:', emailError);
      }
    }

    // Get current user
    const currentUser = await User.findById(req.user._id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'order_updated',
      title: 'Payment Added to Order',
      message: `${currentUser.fullname} added ₦${numericAmount.toLocaleString()} payment to order ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        paymentAmount: numericAmount.toFixed(2),
        oldAmountPaid: oldAmountPaid.toFixed(2),
        newAmountPaid: order.amountPaid.toFixed(2),
        remainingBalance: remainingBalance.toFixed(2),
        oldPaymentStatus,
        newPaymentStatus: order.paymentStatus
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Payment added successfully', {
      order,
      payment: paymentRecord,
      remainingBalance,
      receipt
    });

  } catch (error) {
    console.error('❌ Add payment error:', error);
    return ApiResponse.error(res, 'Server error adding payment', 500);
  }
};

/**
 * @desc    Update order status
 * @route   PATCH /api/orders/:id/status
 * @access  Private
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled', 'on_hold'];
    if (!validStatuses.includes(status)) {
      return ApiResponse.error(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    // Allow access if user created order or is assigned
    const order = await Order.findOne({
      _id: id,
      $or: [
        { userId: req.user._id },
        { assignedTo: req.user._id }
      ]
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found or unauthorized', 404);
    }

    // Store old status
    const oldStatus = order.status;
    
    order.status = status;
    await order.save();

    // Get current user
    const currentUser = await User.findById(req.user._id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'order_updated',
      title: 'Order Status Updated',
      message: `${currentUser.fullname} changed order ${order.orderNumber} status to ${status}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        oldStatus,
        newStatus: status
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Order status updated successfully', order);
  } catch (error) {
    console.error('Update order status error:', error);
    return ApiResponse.error(res, 'Server error updating order status', 500);
  }
};

/**
 * @desc    Delete order
 * @route   DELETE /api/orders/:id
 * @access  Private
 */
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    // Store info before deletion
    const orderNumber = order.orderNumber;
    const clientName = order.clientName;
    const totalAmount = order.totalAmount;

    await order.deleteOne();

    // Get current user
    const currentUser = await User.findById(req.user._id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'order_deleted',
      title: 'Order Deleted',
      message: `${currentUser.fullname} deleted order ${orderNumber} for ${clientName}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        orderNumber,
        clientName,
        totalAmount: totalAmount.toFixed(2)
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Order deleted successfully', { id });
  } catch (error) {
    console.error('Delete order error:', error);
    return ApiResponse.error(res, 'Server error deleting order', 500);
  }
};

/**
 * @desc    Get order statistics
 * @route   GET /api/orders/stats
 * @access  Private
 */
exports.getOrderStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      { $match: { companyName: req.companyName } }, // ✅ Filter by company
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

/**
 * @desc    Get order receipt data
 * @route   GET /api/orders/:id/receipt
 * @access  Private
 */
exports.getOrderReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      companyName: req.companyName // ✅ Filter by company
    })
      .populate('quotationId', 'quotationNumber')
      .populate('userId', 'name email phoneNumber businessName businessAddress');

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

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
      boms: order.boms,
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

/**
 * @desc    Get available staff
 * @route   GET /api/orders/staff-available
 * @access  Private
 */
exports.getAvailableStaff = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    
    const activeCompany = currentUser.companies && currentUser.companies.length > 0
      ? currentUser.companies[currentUser.activeCompanyIndex || 0]
      : null;

    if (!activeCompany || !activeCompany.name) {
      return ApiResponse.error(res, 'No active company found', 404);
    }

    const companyName = activeCompany.name;

    const allUsers = await User.find({
      'companies.name': companyName,
    }).select('fullname email phoneNumber companies');

    const staffList = [];

    allUsers.forEach(user => {
      const companyData = user.companies.find(c => c.name === companyName);
      
      if (companyData && companyData.accessGranted) {
        staffList.push({
          _id: user._id,
          id: user._id,
          fullname: user.fullname,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: companyData.role,
          position: companyData.position,
          accessGranted: companyData.accessGranted,
        });
      }
    });

    return ApiResponse.success(res, 'Staff fetched successfully', staffList);
  } catch (error) {
    console.error('Get staff error:', error);
    return ApiResponse.error(res, 'Server error fetching staff', 500);
  }
};

/**
 * @desc    Assign order to staff
 * @route   POST /api/orders/:id/assign
 * @access  Private
 */
exports.assignOrderToStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId, notes } = req.body;

    if (!staffId) {
      return ApiResponse.error(res, 'Staff ID is required', 400);
    }

    const currentUser = await User.findById(req.user._id);
    
    const activeCompany = currentUser.companies && currentUser.companies.length > 0
      ? currentUser.companies[currentUser.activeCompanyIndex || 0]
      : null;

    if (!activeCompany || !activeCompany.name) {
      return ApiResponse.error(res, 'No active company found', 404);
    }

    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return ApiResponse.error(res, 'You do not have permission to assign orders', 403);
    }

    const order = await Order.findOne({
      _id: id,
      companyName: activeCompany.name
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found or unauthorized', 404);
    }

    const staffUser = await User.findById(staffId);

    if (!staffUser) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    const staffCompanyData = staffUser.companies.find(
      c => c.name === activeCompany.name
    );

    if (!staffCompanyData) {
      return ApiResponse.error(res, 'Staff is not part of this company', 404);
    }

    if (!staffCompanyData.accessGranted) {
      return ApiResponse.error(res, 'Staff does not have access to this company', 403);
    }

    if (order.status === 'cancelled') {
      return ApiResponse.error(res, 'Cannot assign cancelled orders', 400);
    }

    order.assignedTo = staffId;
    order.assignedBy = req.user._id;
    order.assignedAt = new Date();
    order.assignmentNotes = notes || null;

    await order.save();

    await order.populate([
      { path: 'assignedTo', select: 'fullname email phoneNumber' },
      { path: 'assignedBy', select: 'fullname email' }
    ]);

    const assignedToData = {
      _id: staffUser._id,
      fullname: staffUser.fullname,
      email: staffUser.email,
      phoneNumber: staffUser.phoneNumber,
      role: staffCompanyData.role,
      position: staffCompanyData.position,
    };

    // ✅ Notify the assigned staff
    await notifyUser({
      userId: staffId,
      companyName: activeCompany.name,
      type: 'order_assigned',
      title: 'Order Assigned to You',
      message: `${currentUser.fullname} assigned order ${order.orderNumber} (${order.clientName}) to you`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        totalAmount: order.totalAmount.toFixed(2),
        assignmentNotes: notes
      }
    });

    // ✅ Notify company members (except assigned staff and assigner)
    await notifyCompany({
      companyName: activeCompany.name,
      type: 'order_assigned',
      title: 'Order Assigned',
      message: `${currentUser.fullname} assigned order ${order.orderNumber} to ${staffUser.fullname}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        assignedToName: staffUser.fullname,
        assignedToPosition: staffCompanyData.position
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Order assigned successfully', {
      order,
      assignment: {
        assignedTo: assignedToData,
        assignedBy: order.assignedBy,
        assignedAt: order.assignedAt,
        notes: order.assignmentNotes
      }
    });

  } catch (error) {
    console.error('Assign order error:', error);
    return ApiResponse.error(res, 'Server error assigning order', 500);
  }
};

/**
 * @desc    Unassign order from staff
 * @route   DELETE /api/orders/:id/unassign
 * @access  Private
 */
exports.unassignOrderFromStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const currentUser = await User.findById(req.user._id);
    
    const activeCompany = currentUser.companies && currentUser.companies.length > 0
      ? currentUser.companies[currentUser.activeCompanyIndex || 0]
      : null;

    if (!activeCompany || !activeCompany.name) {
      return ApiResponse.error(res, 'No active company found', 404);
    }

    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return ApiResponse.error(res, 'You do not have permission to unassign orders', 403);
    }

    const order = await Order.findOne({
      _id: id,
      companyName: activeCompany.name
    }).populate('assignedTo', 'fullname email');

    if (!order) {
      return ApiResponse.error(res, 'Order not found or unauthorized', 404);
    }

    if (!order.assignedTo) {
      return ApiResponse.error(res, 'Order is not assigned to any staff', 400);
    }

    // Store info before unassigning
    const previouslyAssignedTo = order.assignedTo._id;
    const previouslyAssignedName = order.assignedTo.fullname;

    order.assignedTo = null;
    order.assignedBy = null;
    order.assignedAt = null;
    order.assignmentNotes = null;

    await order.save();

    // ✅ Notify the previously assigned staff
    await notifyUser({
      userId: previouslyAssignedTo,
      companyName: activeCompany.name,
      type: 'order_unassigned',
      title: 'Order Unassigned',
      message: `${currentUser.fullname} removed you from order ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientName: order.clientName
      }
    });

    // ✅ Notify company members
    await notifyCompany({
      companyName: activeCompany.name,
      type: 'order_unassigned',
      title: 'Order Unassigned',
      message: `${currentUser.fullname} unassigned ${previouslyAssignedName} from order ${order.orderNumber}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        previouslyAssignedTo: previouslyAssignedName
      },
      excludeUserId: req.user._id
    });

    return ApiResponse.success(res, 'Order unassigned successfully', order);

  } catch (error) {
    console.error('Unassign order error:', error);
    return ApiResponse.error(res, 'Server error unassigning order', 500);
  }
};
