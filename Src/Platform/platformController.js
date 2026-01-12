const Product = require('../../Models/productModel');
const User = require('../../Models/user');
const Company = require('../../Models/companyModel');
const Order = require('../../Models/orderModel');
const Quotation = require('../../Models/quotationModel');
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
