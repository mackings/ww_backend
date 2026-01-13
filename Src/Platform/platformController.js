const Product = require('../../Models/productModel');
const User = require('../../Models/user');
const Company = require('../../Models/companyModel');
const Order = require('../../Models/orderModel');
const Quotation = require('../../Models/quotationModel');
const Material = require('../../Models/MaterialModel');
const { sendEmail } = require('../../Utils/emailUtil');
const { notifyUser, notifyCompany } = require('../../Utils/NotHelper');

/**
 * @desc    Get platform dashboard statistics
 * @route   GET /api/platform/dashboard/stats
 * @access  Platform Owner
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalCompanies,
      activeCompanies,
      totalProducts,
      pendingProducts,
      globalProducts,
      totalOrders,
      totalQuotations,
      totalUsers
    ] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ isActive: true }),
      Product.countDocuments(),
      Product.countDocuments({ status: 'pending', isGlobal: false }),
      Product.countDocuments({ isGlobal: true }),
      Order.countDocuments(),
      Quotation.countDocuments(),
      User.countDocuments()
    ]);

    // Recent activity
    const recentProducts = await Product.find({ status: 'pending' })
      .populate('submittedBy', 'fullname email')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentCompanies = await Company.find()
      .populate('owner', 'fullname email')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          companies: {
            total: totalCompanies,
            active: activeCompanies,
            inactive: totalCompanies - activeCompanies
          },
          products: {
            total: totalProducts,
            pending: pendingProducts,
            global: globalProducts,
            companyProducts: totalProducts - globalProducts
          },
          orders: totalOrders,
          quotations: totalQuotations,
          users: totalUsers
        },
        recentActivity: {
          pendingProducts: recentProducts,
          recentCompanies: recentCompanies
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics'
    });
  }
};

/**
 * @desc    Get all companies with stats
 * @route   GET /api/platform/companies
 * @access  Platform Owner
 */
exports.getAllCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const companies = await Company.find(query)
      .populate('owner', 'fullname email phoneNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get stats for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const [productCount, orderCount, quotationCount, userCount] = await Promise.all([
          Product.countDocuments({ companyName: company.name }),
          Order.countDocuments({ companyName: company.name }),
          Quotation.countDocuments({ companyName: company.name }),
          User.countDocuments({ 'companies.name': company.name })
        ]);

        return {
          ...company.toObject(),
          stats: {
            products: productCount,
            orders: orderCount,
            quotations: quotationCount,
            users: userCount
          }
        };
      })
    );

    const total = await Company.countDocuments(query);

    res.status(200).json({
      success: true,
      data: companiesWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching companies'
    });
  }
};

/**
 * @desc    Get company usage statistics
 * @route   GET /api/platform/companies/:companyId/usage
 * @access  Platform Owner
 */
exports.getCompanyUsage = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId)
      .populate('owner', 'fullname email phoneNumber');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const [
      products,
      orders,
      quotations,
      users,
      pendingProducts,
      approvedProducts,
      rejectedProducts
    ] = await Promise.all([
      Product.countDocuments({ companyName: company.name }),
      Order.countDocuments({ companyName: company.name }),
      Quotation.countDocuments({ companyName: company.name }),
      User.countDocuments({ 'companies.name': company.name }),
      Product.countDocuments({ companyName: company.name, status: 'pending' }),
      Product.countDocuments({ companyName: company.name, status: 'approved' }),
      Product.countDocuments({ companyName: company.name, status: 'rejected' })
    ]);

    // Get recent orders
    const recentOrders = await Order.find({ companyName: company.name })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderNumber totalAmount status paymentStatus createdAt');

    // Calculate revenue (from completed orders)
    const revenueData = await Order.aggregate([
      { $match: { companyName: company.name, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        company: company,
        stats: {
          products: {
            total: products,
            pending: pendingProducts,
            approved: approvedProducts,
            rejected: rejectedProducts
          },
          orders: orders,
          quotations: quotations,
          users: users,
          revenue: revenueData[0] || { totalRevenue: 0, totalPaid: 0 }
        },
        recentOrders: recentOrders
      }
    });
  } catch (error) {
    console.error('Get company usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company usage'
    });
  }
};

/**
 * @desc    Get all pending products
 * @route   GET /api/platform/products/pending
 * @access  Platform Owner
 */
exports.getPendingProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, companyName, category } = req.query;

    const query = {
      status: 'pending',
      isGlobal: false
    };

    if (companyName) {
      query.companyName = companyName;
    }

    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .populate('submittedBy', 'fullname email')
      .populate('userId', 'fullname email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get pending products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending products'
    });
  }
};

/**
 * @desc    Approve a product
 * @route   PATCH /api/platform/products/:productId/approve
 * @access  Platform Owner
 */
exports.approveProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { notes } = req.body;

    const product = await Product.findById(productId)
      .populate('submittedBy', 'fullname email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Product is already approved'
      });
    }

    // Update product
    product.status = 'approved';
    product.approvedBy = req.user._id;
    product.approvedAt = new Date();
    product.rejectionReason = null;

    product.approvalHistory.push({
      action: 'approved',
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      reason: notes || 'Approved by platform owner',
      timestamp: new Date()
    });

    await product.save();

    // Send email notification to submitter
    if (product.submittedBy && product.submittedBy.email) {
      await sendEmail({
        to: product.submittedBy.email,
        subject: `Product Approved: ${product.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Product Approved!</h2>
            <p>Great news! Your product has been approved by the platform owner.</p>

            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Product Details:</h3>
              <p><strong>Name:</strong> ${product.name}</p>
              <p><strong>Product ID:</strong> ${product.productId}</p>
              <p><strong>Category:</strong> ${product.category}</p>
              ${product.subCategory ? `<p><strong>Sub-Category:</strong> ${product.subCategory}</p>` : ''}
              <p><strong>Company:</strong> ${product.companyName}</p>
            </div>

            ${notes ? `
              <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Approval Notes:</strong></p>
                <p>${notes}</p>
              </div>
            ` : ''}

            <p>Your product is now visible to all users in your company.</p>

            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              This is an automated notification from your platform.
            </p>
          </div>
        `
      });
    }

    // Create in-app notification
    await notifyCompany({
      companyName: product.companyName,
      type: 'product_approved',
      title: 'Product Approved',
      message: `Your product "${product.name}" has been approved!`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: {
        productId: product._id,
        productCode: product.productId,
        productName: product.name,
        notes: notes
      }
    });

    res.status(200).json({
      success: true,
      message: 'Product approved successfully',
      data: product
    });
  } catch (error) {
    console.error('Approve product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving product'
    });
  }
};

/**
 * @desc    Reject a product
 * @route   PATCH /api/platform/products/:productId/reject
 * @access  Platform Owner
 */
exports.rejectProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const product = await Product.findById(productId)
      .populate('submittedBy', 'fullname email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Product is already rejected'
      });
    }

    // Update product
    product.status = 'rejected';
    product.rejectionReason = reason;

    product.approvalHistory.push({
      action: 'rejected',
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      reason: reason,
      timestamp: new Date()
    });

    await product.save();

    // Send email notification to submitter
    if (product.submittedBy && product.submittedBy.email) {
      await sendEmail({
        to: product.submittedBy.email,
        subject: `Product Rejected: ${product.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Product Rejected</h2>
            <p>Your product submission has been rejected by the platform owner.</p>

            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Product Details:</h3>
              <p><strong>Name:</strong> ${product.name}</p>
              <p><strong>Product ID:</strong> ${product.productId}</p>
              <p><strong>Category:</strong> ${product.category}</p>
              ${product.subCategory ? `<p><strong>Sub-Category:</strong> ${product.subCategory}</p>` : ''}
              <p><strong>Company:</strong> ${product.companyName}</p>
            </div>

            <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Rejection Reason:</strong></p>
              <p>${reason}</p>
            </div>

            <p>You can edit your product and resubmit it for approval.</p>

            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              This is an automated notification from your platform.
            </p>
          </div>
        `
      });
    }

    // Create in-app notification
    await notifyCompany({
      companyName: product.companyName,
      type: 'product_rejected',
      title: 'Product Rejected',
      message: `Your product "${product.name}" was rejected. Reason: ${reason}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: {
        productId: product._id,
        productCode: product.productId,
        productName: product.name,
        reason: reason
      }
    });

    res.status(200).json({
      success: true,
      message: 'Product rejected',
      data: product
    });
  } catch (error) {
    console.error('Reject product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting product'
    });
  }
};

/**
 * @desc    Create global product
 * @route   POST /api/platform/products/global
 * @access  Platform Owner
 */
exports.createGlobalProduct = async (req, res) => {
  try {
    // Delegate to product controller with isGlobal flag
    req.body.isGlobal = true;

    // Import and use the existing createProduct function
    const { createProduct } = require('../Quotation/product');
    return createProduct(req, res);
  } catch (error) {
    console.error('Create global product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating global product'
    });
  }
};

/**
 * @desc    Get all products in the system (approved, pending, rejected, global)
 * @route   GET /api/platform/products/all
 * @access  Platform Owner
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, companyName, category, isGlobal, search } = req.query;

    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by company
    if (companyName) {
      query.companyName = companyName;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter global vs company products
    if (isGlobal !== undefined) {
      query.isGlobal = isGlobal === 'true';
    }

    // Search by name or product ID
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .populate('submittedBy', 'fullname email')
      .populate('approvedBy', 'fullname email')
      .populate('userId', 'fullname email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    // Get aggregated stats
    const stats = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusBreakdown = {
      pending: 0,
      approved: 0,
      rejected: 0
    };

    stats.forEach(stat => {
      statusBreakdown[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      data: products,
      stats: statusBreakdown,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products'
    });
  }
};

/**
 * @desc    Get single product details (for any product in the system)
 * @route   GET /api/platform/products/:productId
 * @access  Platform Owner
 */
exports.getProductDetails = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .populate('submittedBy', 'fullname email phoneNumber')
      .populate('approvedBy', 'fullname email')
      .populate('userId', 'fullname email phoneNumber');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product details'
    });
  }
};

/**
 * @desc    Get detailed company profile with all information
 * @route   GET /api/platform/companies/:companyId/profile
 * @access  Platform Owner
 */
exports.getCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId)
      .populate('owner', 'fullname email phoneNumber');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Get all staff members (users who have this company in their companies array)
    const staff = await User.find({
      'companies.name': company.name,
      'companies.accessGranted': true
    }).select('fullname email phoneNumber companies');

    // Extract company-specific info for each staff member
    const staffWithRoles = staff.map(user => {
      const companyData = user.companies.find(c => c.name === company.name);
      return {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: companyData.role,
        position: companyData.position,
        accessGranted: companyData.accessGranted,
        joinedAt: companyData.joinedAt,
        permissions: companyData.permissions
      };
    });

    // Get products breakdown
    const [
      totalProducts,
      pendingProducts,
      approvedProducts,
      rejectedProducts,
      globalProducts
    ] = await Promise.all([
      Product.countDocuments({ companyName: company.name }),
      Product.countDocuments({ companyName: company.name, status: 'pending' }),
      Product.countDocuments({ companyName: company.name, status: 'approved' }),
      Product.countDocuments({ companyName: company.name, status: 'rejected' }),
      Product.countDocuments({ isGlobal: true })
    ]);

    // Get orders breakdown
    const [
      totalOrders,
      pendingOrders,
      inProgressOrders,
      completedOrders,
      cancelledOrders
    ] = await Promise.all([
      Order.countDocuments({ companyName: company.name }),
      Order.countDocuments({ companyName: company.name, status: 'pending' }),
      Order.countDocuments({ companyName: company.name, status: 'in_progress' }),
      Order.countDocuments({ companyName: company.name, status: 'completed' }),
      Order.countDocuments({ companyName: company.name, status: 'cancelled' })
    ]);

    // Get quotations count
    const totalQuotations = await Quotation.countDocuments({ companyName: company.name });

    // Get revenue data
    const revenueData = await Order.aggregate([
      { $match: { companyName: company.name } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' },
          totalBalance: { $sum: '$balance' }
        }
      }
    ]);

    // Get recent products
    const recentProducts = await Product.find({ companyName: company.name })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name productId category status createdAt');

    // Get recent orders
    const recentOrders = await Order.find({ companyName: company.name })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderNumber totalAmount status paymentStatus createdAt');

    res.status(200).json({
      success: true,
      data: {
        company: company,
        staff: staffWithRoles,
        statistics: {
          products: {
            total: totalProducts,
            pending: pendingProducts,
            approved: approvedProducts,
            rejected: rejectedProducts,
            globalAvailable: globalProducts
          },
          orders: {
            total: totalOrders,
            pending: pendingOrders,
            inProgress: inProgressOrders,
            completed: completedOrders,
            cancelled: cancelledOrders
          },
          quotations: totalQuotations,
          staff: staffWithRoles.length,
          revenue: revenueData[0] || { totalRevenue: 0, totalPaid: 0, totalBalance: 0 }
        },
        recentActivity: {
          products: recentProducts,
          orders: recentOrders
        }
      }
    });
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company profile'
    });
  }
};

/**
 * @desc    Get platform-wide statistics
 * @route   GET /api/platform/stats/overview
 * @access  Platform Owner
 */
exports.getPlatformOverview = async (req, res) => {
  try {
    // Product stats by status
    const productStats = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Product stats by company
    const productsByCompany = await Product.aggregate([
      {
        $match: { isGlobal: false }
      },
      {
        $group: {
          _id: '$companyName',
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);

    // Order stats
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Orders by company
    const ordersByCompany = await Order.aggregate([
      {
        $group: {
          _id: '$companyName',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // User stats
    const [totalUsers, platformOwners, companyOwners] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isPlatformOwner: true }),
      User.countDocuments({ 'companies.role': 'owner' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        products: {
          byStatus: productStats,
          byCompany: productsByCompany,
          global: await Product.countDocuments({ isGlobal: true })
        },
        orders: {
          byStatus: orderStats,
          byCompany: ordersByCompany
        },
        users: {
          total: totalUsers,
          platformOwners: platformOwners,
          companyOwners: companyOwners
        },
        companies: {
          total: await Company.countDocuments(),
          active: await Company.countDocuments({ isActive: true })
        },
        quotations: {
          total: await Quotation.countDocuments()
        }
      }
    });
  } catch (error) {
    console.error('Get platform overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching platform overview'
    });
  }
};

/**
 * @desc    Get pending materials
 * @route   GET /api/platform/materials/pending
 * @access  Platform Owner
 */
exports.getPendingMaterials = async (req, res) => {
  try {
    const { page = 1, limit = 20, companyName, category } = req.query;

    const query = { status: 'pending', isGlobal: false };

    if (companyName) {
      query.companyName = { $regex: companyName, $options: 'i' };
    }

    if (category) {
      query.category = category.toUpperCase();
    }

    const materials = await Material.find(query)
      .populate('submittedBy', 'fullname email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Material.countDocuments(query);

    res.status(200).json({
      success: true,
      data: materials,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get pending materials error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending materials'
    });
  }
};

/**
 * @desc    Approve material
 * @route   PATCH /api/platform/materials/:materialId/approve
 * @access  Platform Owner
 */
exports.approveMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { notes } = req.body;

    const material = await Material.findById(materialId).populate('submittedBy', 'fullname email');

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    if (material.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending materials can be approved'
      });
    }

    material.status = 'approved';
    material.approvedBy = req.user._id;
    material.approvedAt = new Date();
    material.rejectionReason = null;
    material.approvalHistory.push({
      action: 'approved',
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      reason: notes || 'Approved by platform owner',
      timestamp: new Date()
    });

    await material.save();

    // Send email notification
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #10b981; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Material Approved</h1>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <p>Hi ${material.submittedBy.fullname},</p>
          <p>Great news! Your material has been approved and is now available in your system.</p>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Material Details:</h3>
            <p><strong>Name:</strong> ${material.name}</p>
            <p><strong>Category:</strong> ${material.category}</p>
            <p><strong>Company:</strong> ${material.companyName}</p>
          </div>

          ${notes ? `<p><strong>Notes from platform owner:</strong><br>${notes}</p>` : ''}

          <p>You can now use this material in your quotations and BOMs.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: material.submittedBy.email,
      subject: `Material Approved: ${material.name}`,
      html: emailHtml
    });

    // Create notification
    await notifyCompany({
      companyName: material.companyName,
      type: 'material_approved',
      title: 'Material Approved',
      message: `Your material "${material.name}" has been approved`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: {
        materialId: material._id,
        materialName: material.name
      }
    });

    res.status(200).json({
      success: true,
      message: 'Material approved successfully',
      data: material
    });
  } catch (error) {
    console.error('Approve material error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving material'
    });
  }
};

/**
 * @desc    Reject material
 * @route   PATCH /api/platform/materials/:materialId/reject
 * @access  Platform Owner
 */
exports.rejectMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const material = await Material.findById(materialId).populate('submittedBy', 'fullname email');

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    if (material.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending materials can be rejected'
      });
    }

    material.status = 'rejected';
    material.rejectionReason = reason;
    material.approvalHistory.push({
      action: 'rejected',
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      reason: reason,
      timestamp: new Date()
    });

    await material.save();

    // Send email notification
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #ef4444; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">❌ Material Rejected</h1>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <p>Hi ${material.submittedBy.fullname},</p>
          <p>Your material submission has been rejected.</p>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Material Details:</h3>
            <p><strong>Name:</strong> ${material.name}</p>
            <p><strong>Category:</strong> ${material.category}</p>
            <p><strong>Company:</strong> ${material.companyName}</p>
          </div>

          <div style="background-color: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <p style="margin: 0;"><strong>Reason for rejection:</strong><br>${reason}</p>
          </div>

          <p>You can update and resubmit this material for approval.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: material.submittedBy.email,
      subject: `Material Rejected: ${material.name}`,
      html: emailHtml
    });

    // Create notification
    await notifyCompany({
      companyName: material.companyName,
      type: 'material_rejected',
      title: 'Material Rejected',
      message: `Your material "${material.name}" was rejected: ${reason}`,
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      metadata: {
        materialId: material._id,
        materialName: material.name,
        reason
      }
    });

    res.status(200).json({
      success: true,
      message: 'Material rejected successfully',
      data: material
    });
  } catch (error) {
    console.error('Reject material error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting material'
    });
  }
};
