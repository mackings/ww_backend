const Order = require('../../Models/orderModel'); 
const Quotation = require('../../Models/quotationModel'); 
const ApiResponse = require('../../Utils/apiResponse');
const User = require("../../Models/user")



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
      companyName: req.companyName,
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
      sortOrder = 'desc',
      assignedTo,
      showMyAssignments = false
    } = req.query;

    // Build filter - ✅ CHANGED: Filter by company instead of userId
    const filter = { companyName: req.companyName }; // ✅ This is the key change

    // Handle staff viewing their assignments
    if (showMyAssignments === 'true' || showMyAssignments === true) {
      filter.assignedTo = req.user._id;
    } else {
      // Check user role
      if (req.user.role === 'staff') {
        filter.assignedTo = req.user._id;
      } else {
        // Admin can filter by assigned staff
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

    // Execute query with pagination
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

    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return ApiResponse.error(res, 'Valid numeric payment amount is required', 400);
    }

    // Allow access if:
    // 1. User created the order (admin), OR
    // 2. User is assigned to the order (staff)
    const order = await Order.findOne({
      _id: id,
      $or: [
        { userId: req.user._id }, // Order creator
        { assignedTo: req.user._id } // Assigned staff
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


// Helper function to check if user has access to order
const checkOrderAccess = async (orderId, userId) => {
  const order = await Order.findOne({
    _id: orderId,
    $or: [
      { userId: userId }, // Order creator
      { assignedTo: userId } // Assigned staff
    ]
  });
  
  return order;
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

    // Allow access if:
    // 1. User created the order (admin), OR
    // 2. User is assigned to the order (staff)
    const order = await Order.findOne({
      _id: id,
      $or: [
        { userId: req.user._id }, // Order creator
        { assignedTo: req.user._id } // Assigned staff
      ]
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found or unauthorized', 404);
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



/**
 * @desc    Get Available Staff (from active company)
 * @route   GET /api/orders/staff-available
 * @access  Private
 */
exports.getAvailableStaff = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    
    // Get active company
    const activeCompany = currentUser.companies && currentUser.companies.length > 0
      ? currentUser.companies[currentUser.activeCompanyIndex || 0]
      : null;

    if (!activeCompany || !activeCompany.name) {
      return ApiResponse.error(res, 'No active company found', 404);
    }

    const companyName = activeCompany.name;

    // ✅ Find all users who belong to this company with access granted
    const allUsers = await User.find({
      'companies.name': companyName,
    }).select('fullname email phoneNumber companies');

    // ✅ Extract staff with their company-specific role and position
    const staffList = [];

    allUsers.forEach(user => {
      const companyData = user.companies.find(c => c.name === companyName);
      
      // Only include if they have access and are not the current user (optional)
      if (companyData && companyData.accessGranted) {
        staffList.push({
          _id: user._id,
          id: user._id, // Some frontends expect 'id'
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
 * @desc    Assign Order to Staff
 * @route   POST /api/orders/:id/assign
 * @access  Private
 */
exports.assignOrderToStaff = async (req, res) => {
  try {
    const { id } = req.params; // Order ID
    const { staffId, notes } = req.body;

    // Validate staffId
    if (!staffId) {
      return ApiResponse.error(res, 'Staff ID is required', 400);
    }

    const currentUser = await User.findById(req.user._id);
    
    // Get active company
    const activeCompany = currentUser.companies && currentUser.companies.length > 0
      ? currentUser.companies[currentUser.activeCompanyIndex || 0]
      : null;

    if (!activeCompany || !activeCompany.name) {
      return ApiResponse.error(res, 'No active company found', 404);
    }

    // ✅ Check if current user can assign (owner or admin in this company)
    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return ApiResponse.error(res, 'You do not have permission to assign orders', 403);
    }

    // ✅ Find the order (filter by company)
    const order = await Order.findOne({
      _id: id,
      companyName: activeCompany.name // ✅ Ensure order belongs to company
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found or unauthorized', 404);
    }

    // ✅ Verify the staff exists and belongs to the same company
    const staffUser = await User.findById(staffId);

    if (!staffUser) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    // ✅ Check if staff belongs to this company
    const staffCompanyData = staffUser.companies.find(
      c => c.name === activeCompany.name
    );

    if (!staffCompanyData) {
      return ApiResponse.error(res, 'Staff is not part of this company', 404);
    }

    if (!staffCompanyData.accessGranted) {
      return ApiResponse.error(res, 'Staff does not have access to this company', 403);
    }

    // Cannot assign cancelled orders
    if (order.status === 'cancelled') {
      return ApiResponse.error(res, 'Cannot assign cancelled orders', 400);
    }

    // ✅ Update assignment
    order.assignedTo = staffId;
    order.assignedBy = req.user._id;
    order.assignedAt = new Date();
    order.assignmentNotes = notes || null;

    await order.save();

    // ✅ Populate the assignment details for response
    await order.populate([
      { path: 'assignedTo', select: 'fullname email phoneNumber' },
      { path: 'assignedBy', select: 'fullname email' }
    ]);

    // ✅ Get the staff's role and position in this company
    const assignedToData = {
      _id: staffUser._id,
      fullname: staffUser.fullname,
      email: staffUser.email,
      phoneNumber: staffUser.phoneNumber,
      role: staffCompanyData.role,
      position: staffCompanyData.position,
    };

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
 * @desc    Unassign/Remove Staff from Order
 * @route   DELETE /api/orders/:id/unassign
 * @access  Private
 */
exports.unassignOrderFromStaff = async (req, res) => {
  try {
    const { id } = req.params; // Order ID

    const currentUser = await User.findById(req.user._id);
    
    // Get active company
    const activeCompany = currentUser.companies && currentUser.companies.length > 0
      ? currentUser.companies[currentUser.activeCompanyIndex || 0]
      : null;

    if (!activeCompany || !activeCompany.name) {
      return ApiResponse.error(res, 'No active company found', 404);
    }

    // ✅ Check if current user can unassign (owner or admin)
    if (!['owner', 'admin'].includes(activeCompany.role)) {
      return ApiResponse.error(res, 'You do not have permission to unassign orders', 403);
    }

    // ✅ Find the order (filter by company)
    const order = await Order.findOne({
      _id: id,
      companyName: activeCompany.name // ✅ Ensure order belongs to company
    });

    if (!order) {
      return ApiResponse.error(res, 'Order not found or unauthorized', 404);
    }

    if (!order.assignedTo) {
      return ApiResponse.error(res, 'Order is not assigned to any staff', 400);
    }

    // ✅ Remove assignment
    order.assignedTo = null;
    order.assignedBy = null;
    order.assignedAt = null;
    order.assignmentNotes = null;

    await order.save();

    return ApiResponse.success(res, 'Order unassigned successfully', order);

  } catch (error) {
    console.error('Unassign order error:', error);
    return ApiResponse.error(res, 'Server error unassigning order', 500);
  }
};