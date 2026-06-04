const Product = require('../../Models/productModel');
const User = require('../../Models/user');
const Company = require('../../Models/companyModel');
const Order = require('../../Models/orderModel');
const Quotation = require('../../Models/quotationModel');
const Material = require('../../Models/MaterialModel');
const mongoose = require('mongoose');
const { sendEmail } = require('../../Utils/emailUtil');
const { notifyUser, notifyCompany, notifyAllCompanyOwners } = require('../../Utils/NotHelper');
const { getCatalogMaterials, normalizePricingUnit } = require('../../Utils/materialCatalog');
const ApiResponse = require('../../Utils/apiResponse');

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const getMaterialUnitPrice = (material) => (
  parseNumber(material.pricePerUnit) ?? parseNumber(material.catalogPrice) ?? null
);

const normalizeBillingMode = (mode, pricingUnit = '') => {
  const normalized = String(mode || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['area_prorated', 'full_sheet', 'unit'].includes(normalized)) return normalized;
  return normalizePricingUnit(pricingUnit) === 'sqm' ? 'area_prorated' : 'unit';
};

const materialToApi = (material) => {
  const obj = material?.toObject ? material.toObject() : material;
  const unitPrice = getMaterialUnitPrice(obj || {});
  const pricePerSqm = parseNumber(obj?.pricePerSqm);
  const pricingUnit = obj?.pricingUnit || obj?.unit || '';

  return {
    ...(obj || {}),
    billingMode: normalizeBillingMode(obj?.billingMode, pricingUnit),
    unitPrice,
    isPriced: (unitPrice !== null && unitPrice > 0) || (pricePerSqm !== null && pricePerSqm > 0)
  };
};

const parsePagination = (query = {}, options = {}) => {
  const {
    pageKey = 'page',
    limitKey = 'limit',
    defaultLimit = 20,
    maxLimit = 50
  } = options;

  const page = Math.max(parseInt(query[pageKey], 10) || 1, 1);
  const rawLimit = parseInt(query[limitKey], 10) || defaultLimit;
  const limit = Math.min(Math.max(rawLimit, 1), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const paginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit) || 0,
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1
});

const paginateArray = (items, page, limit) => items.slice((page - 1) * limit, page * limit);

const parseBulkMaterialIds = (body = {}) => {
  const rawIds = body.materialIds || body.ids;
  if (!Array.isArray(rawIds)) {
    return {
      error: 'materialIds must be an array of MongoDB ObjectIds',
      materialIds: [],
      invalidIds: []
    };
  }

  const materialIds = [];
  const invalidIds = [];
  const seen = new Set();

  rawIds.forEach((rawId) => {
    const materialId = String(rawId || '').trim();
    if (!materialId || !mongoose.Types.ObjectId.isValid(materialId)) {
      invalidIds.push(rawId);
      return;
    }

    if (!seen.has(materialId)) {
      seen.add(materialId);
      materialIds.push(materialId);
    }
  });

  return { materialIds, invalidIds };
};

const getEmbeddedCompanyNameFromId = (companyId) => {
  const id = String(companyId || '');
  if (!id.startsWith('embedded:')) return null;

  try {
    return decodeURIComponent(id.slice('embedded:'.length)).trim();
  } catch (error) {
    return '';
  }
};

const getEmbeddedCompanyByName = async (companyName) => {
  if (!companyName) return null;

  const users = await User.find({
    'companies.name': companyName
  }).select('fullname email phoneNumber companies createdAt');

  if (!users.length) return null;

  const memberships = [];
  users.forEach((user) => {
    (user.companies || []).forEach((embeddedCompany) => {
      if (embeddedCompany.name !== companyName) return;
      memberships.push({ user, embeddedCompany });
    });
  });

  if (!memberships.length) return null;

  const ownerMembership = memberships.find(({ embeddedCompany }) => embeddedCompany.role === 'owner') || memberships[0];
  const { user, embeddedCompany } = ownerMembership;
  const activeMemberships = memberships.filter(({ embeddedCompany: company }) => company.accessGranted !== false);

  return {
    _id: `embedded:${encodeURIComponent(companyName)}`,
    name: companyName,
    email: embeddedCompany.email || user.email,
    phoneNumber: embeddedCompany.phoneNumber || user.phoneNumber,
    address: embeddedCompany.address || '',
    owner: embeddedCompany.role === 'owner'
      ? {
          _id: user._id,
          fullname: user.fullname,
          email: user.email,
          phoneNumber: user.phoneNumber
        }
      : null,
    isActive: activeMemberships.length > 0,
    createdAt: embeddedCompany.joinedAt || user.createdAt,
    updatedAt: embeddedCompany.joinedAt || user.createdAt,
    source: 'user_embedded_company',
    isRegisteredDocument: false
  };
};

const resolvePlatformCompany = async (companyId) => {
  const embeddedCompanyName = getEmbeddedCompanyNameFromId(companyId);
  if (embeddedCompanyName !== null) {
    return getEmbeddedCompanyByName(embeddedCompanyName);
  }

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return null;
  }

  const company = await Company.findById(companyId)
    .populate('owner', 'fullname email phoneNumber');

  if (!company) return null;

  return {
    ...company.toObject(),
    source: 'company_collection',
    isRegisteredDocument: true
  };
};

/**
 * @desc    Get platform dashboard statistics
 * @route   GET /api/platform/dashboard/stats
 * @access  Platform Owner
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const recentLimit = parsePagination(req.query, {
      limitKey: 'recentLimit',
      defaultLimit: 5,
      maxLimit: 20
    }).limit;

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
      .limit(recentLimit)
      .lean();

    const recentCompanies = await Company.find()
      .populate('owner', 'fullname email')
      .sort({ createdAt: -1 })
      .limit(recentLimit)
      .lean();

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
    const { search, isActive } = req.query;
    const { page: safePage, limit: safeLimit } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50
    });
    const normalizeCompanyName = (value) => String(value || '').trim().toLowerCase();
    const companiesByName = new Map();

    const companyDocs = await Company.find({})
      .populate('owner', 'fullname email phoneNumber')
      .sort({ createdAt: -1 })
      .lean();

    companyDocs.forEach((company) => {
      companiesByName.set(normalizeCompanyName(company.name), {
        ...company,
        source: 'company_collection',
        isRegisteredDocument: true
      });
    });

    const usersWithCompanies = await User.find({
      'companies.0': { $exists: true }
    }).select('fullname email phoneNumber companies createdAt').lean();

    usersWithCompanies.forEach((user) => {
      (user.companies || []).forEach((embeddedCompany) => {
        const name = String(embeddedCompany.name || '').trim();
        if (!name) return;

        const key = normalizeCompanyName(name);
        if (companiesByName.has(key)) return;

        companiesByName.set(key, {
          _id: `embedded:${encodeURIComponent(name)}`,
          name,
          email: embeddedCompany.email || user.email,
          phoneNumber: embeddedCompany.phoneNumber || user.phoneNumber,
          address: embeddedCompany.address || '',
          owner: embeddedCompany.role === 'owner'
            ? {
                _id: user._id,
                fullname: user.fullname,
                email: user.email,
                phoneNumber: user.phoneNumber
              }
            : null,
          isActive: embeddedCompany.accessGranted !== false,
          createdAt: embeddedCompany.joinedAt || user.createdAt,
          updatedAt: embeddedCompany.joinedAt || user.createdAt,
          source: 'user_embedded_company',
          isRegisteredDocument: false
        });
      });
    });

    let companies = Array.from(companiesByName.values());

    if (search) {
      const searchTerm = String(search).trim().toLowerCase();
      companies = companies.filter((company) => (
        String(company.name || '').toLowerCase().includes(searchTerm)
        || String(company.email || '').toLowerCase().includes(searchTerm)
      ));
    }

    if (isActive !== undefined) {
      const activeFlag = isActive === true || isActive === 'true';
      companies = companies.filter((company) => Boolean(company.isActive) === activeFlag);
    }

    companies.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = companies.length;
    const paginatedCompanies = paginateArray(companies, safePage, safeLimit);

    // Get stats for each company
    const companiesWithStats = await Promise.all(
      paginatedCompanies.map(async (company) => {
        const [productCount, orderCount, quotationCount, userCount] = await Promise.all([
          Product.countDocuments({ companyName: company.name }),
          Order.countDocuments({ companyName: company.name }),
          Quotation.countDocuments({ companyName: company.name }),
          User.countDocuments({ 'companies.name': company.name })
        ]);

        return {
          ...company,
          stats: {
            products: productCount,
            orders: orderCount,
            quotations: quotationCount,
            users: userCount
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      data: companiesWithStats,
      pagination: paginationMeta(safePage, safeLimit, total)
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
    const { page: recentOrdersPage, limit: recentOrdersLimit, skip: recentOrdersSkip } = parsePagination(req.query, {
      pageKey: 'recentOrdersPage',
      limitKey: 'recentOrdersLimit',
      defaultLimit: 10,
      maxLimit: 50
    });

    const company = await resolvePlatformCompany(companyId);

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
      rejectedProducts,
      recentOrdersTotal
    ] = await Promise.all([
      Product.countDocuments({ companyName: company.name }),
      Order.countDocuments({ companyName: company.name }),
      Quotation.countDocuments({ companyName: company.name }),
      User.countDocuments({ 'companies.name': company.name }),
      Product.countDocuments({ companyName: company.name, status: 'pending' }),
      Product.countDocuments({ companyName: company.name, status: 'approved' }),
      Product.countDocuments({ companyName: company.name, status: 'rejected' }),
      Order.countDocuments({ companyName: company.name })
    ]);

    // Get recent orders
    const recentOrders = await Order.find({ companyName: company.name })
      .sort({ createdAt: -1 })
      .skip(recentOrdersSkip)
      .limit(recentOrdersLimit)
      .select('orderNumber totalAmount status paymentStatus createdAt')
      .lean();

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
        recentOrders: recentOrders,
        recentOrdersPagination: paginationMeta(recentOrdersPage, recentOrdersLimit, recentOrdersTotal)
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
    const { companyName, category } = req.query;
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50
    });

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
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products,
      pagination: paginationMeta(page, limit, total)
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
    const { status, companyName, category, isGlobal, search } = req.query;
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50
    });

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
      .skip(skip)
      .limit(limit)
      .lean();

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
      pagination: paginationMeta(page, limit, total)
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
    const { page: staffPage, limit: staffLimit } = parsePagination(req.query, {
      pageKey: 'staffPage',
      limitKey: 'staffLimit',
      defaultLimit: 20,
      maxLimit: 50
    });
    const { page: recentProductsPage, limit: recentProductsLimit, skip: recentProductsSkip } = parsePagination(req.query, {
      pageKey: 'recentProductsPage',
      limitKey: 'recentProductsLimit',
      defaultLimit: 10,
      maxLimit: 50
    });
    const { page: recentOrdersPage, limit: recentOrdersLimit, skip: recentOrdersSkip } = parsePagination(req.query, {
      pageKey: 'recentOrdersPage',
      limitKey: 'recentOrdersLimit',
      defaultLimit: 10,
      maxLimit: 50
    });

    const company = await resolvePlatformCompany(companyId);

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
    }).select('fullname email phoneNumber companies').lean();

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
      globalProducts,
      recentProductsTotal,
      recentOrdersTotal
    ] = await Promise.all([
      Product.countDocuments({ companyName: company.name }),
      Product.countDocuments({ companyName: company.name, status: 'pending' }),
      Product.countDocuments({ companyName: company.name, status: 'approved' }),
      Product.countDocuments({ companyName: company.name, status: 'rejected' }),
      Product.countDocuments({ isGlobal: true }),
      Product.countDocuments({ companyName: company.name }),
      Order.countDocuments({ companyName: company.name })
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
      .skip(recentProductsSkip)
      .limit(recentProductsLimit)
      .select('name productId category status createdAt')
      .lean();

    // Get recent orders
    const recentOrders = await Order.find({ companyName: company.name })
      .sort({ createdAt: -1 })
      .skip(recentOrdersSkip)
      .limit(recentOrdersLimit)
      .select('orderNumber totalAmount status paymentStatus createdAt')
      .lean();

    const paginatedStaff = paginateArray(staffWithRoles, staffPage, staffLimit);

    res.status(200).json({
      success: true,
      data: {
        company: company,
        staff: paginatedStaff,
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
        },
        staffPagination: paginationMeta(staffPage, staffLimit, staffWithRoles.length),
        recentProductsPagination: paginationMeta(recentProductsPage, recentProductsLimit, recentProductsTotal),
        recentOrdersPagination: paginationMeta(recentOrdersPage, recentOrdersLimit, recentOrdersTotal)
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
    const topLimit = parsePagination(req.query, {
      limitKey: 'topLimit',
      defaultLimit: 10,
      maxLimit: 50
    }).limit;

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
      { $limit: topLimit }
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
      { $limit: topLimit }
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
    const { companyName, category } = req.query;
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50
    });

    const query = { status: 'pending', isGlobal: false };

    if (companyName) {
      query.companyName = { $regex: companyName, $options: 'i' };
    }

    if (category) {
      query.category = { $regex: `^${String(category).trim()}$`, $options: 'i' };
    }

    const materials = await Material.find(query)
      .populate('submittedBy', 'fullname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Material.countDocuments(query);

    res.status(200).json({
      success: true,
      data: materials,
      pagination: paginationMeta(page, limit, total)
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
 * @desc    Reseed all materials from Excel catalog CSV
 * @route   POST /api/platform/materials/reseed-from-catalog
 * @access  Platform Owner
 */
exports.reseedMaterialsFromCatalog = async (req, res) => {
  try {
    const { confirm } = req.body || {};
    if (confirm !== true && confirm !== 'true') {
      return res.status(400).json({
        success: false,
        message: 'This action deletes all existing materials. Set confirm=true to proceed.'
      });
    }

    const catalog = getCatalogMaterials();
    if (!catalog.length) {
      return res.status(400).json({
        success: false,
        message: 'Catalog is empty. Ensure materials_all.csv has content.'
      });
    }

    const now = new Date();
    const submittedBy = req.user?._id;
    const performedByName = req.user?.fullname || 'Platform Owner';

    const seedPayload = catalog.map((item) => {
      const pricingUnit = item.pricingUnit || normalizePricingUnit(item.unit);
      const isSqmPricing = pricingUnit === 'sqm';

      return {
        companyName: 'GLOBAL',
        isGlobal: true,
        status: 'approved',
        submittedBy,
        submittedAt: now,
        approvedBy: submittedBy,
        approvedAt: now,
        approvalHistory: [{
          action: 'approved',
          performedBy: submittedBy,
          performedByName,
          reason: 'Reseeded from materials_all.csv catalog',
          timestamp: now
        }],
        name: item.material,
        category: item.category,
        subCategory: item.subCategory || '',
        size: item.size || '',
        unit: item.unit || '',
        color: item.color || '',
        thickness: item.thickness ?? null,
        thicknessUnit: item.thicknessUnit || 'inches',
        catalogKey: item.key,
        catalogPrice: item.priceNumeric,
        isCatalogMaterial: true,
        isCatalogPriced: item.isPriced,
        standardWidth: item.standardWidth,
        standardLength: item.standardLength,
        standardUnit: item.standardUnit || 'inches',
        pricingUnit,
        billingMode: isSqmPricing ? 'area_prorated' : 'unit',
        pricePerSqm: item.pricePerSqm ?? (isSqmPricing ? item.priceNumeric : null),
        pricePerUnit: isSqmPricing ? null : item.priceNumeric,
        isActive: true,
        notes: `Seeded from Excel catalog (materials_all.csv). Stock dimension source: ${item.stockDimensionSource || 'none'}`
      };
    });

    const existingCount = await Material.countDocuments({});
    await Material.deleteMany({});
    const inserted = await Material.insertMany(seedPayload, { ordered: false });

    const pricedCount = inserted.filter((material) => material.isCatalogPriced).length;
    const unpricedCount = inserted.length - pricedCount;

    return res.status(200).json({
      success: true,
      message: 'Materials reseeded successfully from catalog',
      data: {
        deletedMaterials: existingCount,
        insertedMaterials: inserted.length,
        pricedMaterials: pricedCount,
        unpricedMaterials: unpricedCount
      }
    });
  } catch (error) {
    console.error('Reseed materials from catalog error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error reseeding materials from catalog'
    });
  }
};

/**
 * @desc    Update a company material price
 * @route   PATCH /api/platform/materials/:materialId/price
 * @access  Platform Owner
 */
exports.updateMaterialPrice = async (req, res) => {
  try {
    const { materialId } = req.params;
    const body = req.body || {};
    const material = await Material.findById(materialId);

    if (!material) {
      return ApiResponse.error(res, 'Material not found', 404);
    }

    if (material.isGlobal) {
      return ApiResponse.error(res, 'Use this endpoint only for company-owned materials', 400);
    }

    const hasPricePerUnit = Object.prototype.hasOwnProperty.call(body, 'pricePerUnit');
    const hasPricePerSqm = Object.prototype.hasOwnProperty.call(body, 'pricePerSqm');
    const hasCatalogPrice = Object.prototype.hasOwnProperty.call(body, 'catalogPrice');
    const hasPricingUnit = Object.prototype.hasOwnProperty.call(body, 'pricingUnit');
    const hasBillingMode = Object.prototype.hasOwnProperty.call(body, 'billingMode');

    if (!hasPricePerUnit && !hasPricePerSqm && !hasCatalogPrice && !hasPricingUnit && !hasBillingMode) {
      return ApiResponse.error(
        res,
        'Provide at least one of pricePerUnit, pricePerSqm, catalogPrice, pricingUnit, or billingMode',
        400
      );
    }

    const validateNumberField = (fieldName) => {
      if (!Object.prototype.hasOwnProperty.call(body, fieldName)) return undefined;
      if (body[fieldName] === null || body[fieldName] === '') return null;

      const value = Number(body[fieldName]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${fieldName} must be a valid number greater than or equal to 0`);
      }

      return value;
    };

    const pricePerUnit = validateNumberField('pricePerUnit');
    const pricePerSqm = validateNumberField('pricePerSqm');
    const catalogPrice = validateNumberField('catalogPrice');

    if (pricePerUnit !== undefined) material.pricePerUnit = pricePerUnit;
    if (pricePerSqm !== undefined) material.pricePerSqm = pricePerSqm;
    if (catalogPrice !== undefined) {
      material.catalogPrice = catalogPrice;
      material.isCatalogPriced = Number(catalogPrice) > 0;
    }
    if (hasPricingUnit) material.pricingUnit = normalizePricingUnit(body.pricingUnit);
    if (hasBillingMode) {
      material.billingMode = normalizeBillingMode(body.billingMode, material.pricingUnit);
    }

    await material.save();

    const actor = await User.findById(req.user._id).select('fullname');
    const performerName = actor?.fullname || req.user?.fullname || 'Platform Owner';

    await notifyCompany({
      companyName: material.companyName,
      type: 'material_updated',
      title: 'Material Price Updated',
      message: `${performerName} updated pricing for material: ${material.name}`,
      performedBy: req.user._id,
      performedByName: performerName,
      metadata: {
        materialId: material._id,
        materialName: material.name,
        pricePerUnit: material.pricePerUnit ?? null,
        pricePerSqm: material.pricePerSqm ?? null,
        catalogPrice: material.catalogPrice ?? null,
        pricingUnit: material.pricingUnit ?? null,
        billingMode: material.billingMode ?? null
      }
    });

    return ApiResponse.success(res, 'Material price updated successfully', materialToApi(material));
  } catch (error) {
    console.error('Update material price error:', error);
    return ApiResponse.error(res, error.message || 'Error updating material price', 500);
  }
};

/**
 * @desc    Delete any material by ID
 * @route   DELETE /api/platform/materials/:materialId
 * @access  Platform Owner
 */
exports.deleteMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;

    const material = await Material.findById(materialId);

    if (!material) {
      return ApiResponse.error(res, 'Material not found', 404);
    }

    const deletedMaterial = {
      _id: material._id,
      name: material.name,
      category: material.category,
      companyName: material.companyName,
      isGlobal: material.isGlobal,
      status: material.status
    };

    await material.deleteOne();

    const actor = await User.findById(req.user._id).select('fullname');
    const performerName = actor?.fullname || req.user?.fullname || 'Platform Owner';

    const notificationPayload = {
      type: 'material_deleted',
      title: 'Material Deleted',
      message: `${performerName} deleted material: ${material.name}`,
      performedBy: req.user._id,
      performedByName: performerName,
      metadata: {
        materialId: material._id,
        materialName: material.name,
        category: material.category,
        isGlobal: material.isGlobal
      }
    };

    if (material.isGlobal) {
      await notifyAllCompanyOwners(notificationPayload);
    } else {
      await notifyCompany({
        companyName: material.companyName,
        ...notificationPayload,
        excludeUserId: req.user._id
      });
    }

    return ApiResponse.success(res, 'Material deleted successfully', deletedMaterial);
  } catch (error) {
    console.error('Delete material error:', error);
    return ApiResponse.error(res, 'Error deleting material', 500);
  }
};

/**
 * @desc    Delete many materials by ID
 * @route   DELETE /api/platform/materials
 * @access  Platform Owner
 */
exports.deleteMaterialsBulk = async (req, res) => {
  try {
    const body = req.body || {};
    const { confirm } = body;

    if (confirm !== true && confirm !== 'true') {
      return ApiResponse.error(res, 'This action deletes multiple materials. Set confirm=true to proceed.', 400);
    }

    const { error, materialIds, invalidIds } = parseBulkMaterialIds(body);
    if (error) {
      return ApiResponse.error(res, error, 400);
    }

    if (!materialIds.length) {
      return ApiResponse.error(res, 'Provide at least one valid materialId to delete', 400, { invalidIds });
    }

    const materials = await Material.find({ _id: { $in: materialIds } })
      .select('_id name category companyName isGlobal status')
      .lean();

    const foundIdSet = new Set(materials.map((material) => material._id.toString()));
    const notFoundIds = materialIds.filter((materialId) => !foundIdSet.has(materialId));

    if (!materials.length) {
      return ApiResponse.error(res, 'No matching materials found', 404, {
        requestedCount: materialIds.length,
        invalidIds,
        notFoundIds
      });
    }

    const deleteResult = await Material.deleteMany({ _id: { $in: materials.map((material) => material._id) } });

    const actor = await User.findById(req.user._id).select('fullname');
    const performerName = actor?.fullname || req.user?.fullname || 'Platform Owner';
    const deletedMaterials = materials.map((material) => ({
      _id: material._id,
      name: material.name,
      category: material.category,
      companyName: material.companyName,
      isGlobal: material.isGlobal,
      status: material.status
    }));

    const globalMaterials = deletedMaterials.filter((material) => material.isGlobal);
    const companyMaterials = deletedMaterials.filter((material) => !material.isGlobal);

    if (globalMaterials.length) {
      await notifyAllCompanyOwners({
        type: 'material_deleted',
        title: 'Materials Deleted',
        message: `${performerName} deleted ${globalMaterials.length} global material(s)`,
        performedBy: req.user._id,
        performedByName: performerName,
        metadata: {
          count: globalMaterials.length,
          materialIds: globalMaterials.map((material) => material._id),
          scope: 'global'
        }
      });
    }

    const materialsByCompany = companyMaterials.reduce((groups, material) => {
      const companyName = material.companyName || 'UNKNOWN';
      if (!groups.has(companyName)) groups.set(companyName, []);
      groups.get(companyName).push(material);
      return groups;
    }, new Map());

    await Promise.all(Array.from(materialsByCompany.entries()).map(([companyName, companyGroup]) => notifyCompany({
      companyName,
      type: 'material_deleted',
      title: 'Materials Deleted',
      message: `${performerName} deleted ${companyGroup.length} material(s)`,
      performedBy: req.user._id,
      performedByName: performerName,
      metadata: {
        count: companyGroup.length,
        materialIds: companyGroup.map((material) => material._id),
        materialNames: companyGroup.map((material) => material.name)
      },
      excludeUserId: req.user._id
    })));

    return ApiResponse.success(res, 'Materials deleted successfully', {
      requestedCount: materialIds.length,
      deletedCount: deleteResult.deletedCount ?? deletedMaterials.length,
      invalidIds,
      notFoundIds,
      deletedMaterials
    });
  } catch (error) {
    console.error('Bulk delete materials error:', error);
    return ApiResponse.error(res, 'Error deleting materials', 500);
  }
};

/**
 * @desc    Approve many pending materials by ID
 * @route   PATCH /api/platform/materials/approve
 * @access  Platform Owner
 */
exports.approveMaterialsBulk = async (req, res) => {
  try {
    const { notes } = req.body || {};
    const { error, materialIds, invalidIds } = parseBulkMaterialIds(req.body || {});

    if (error) {
      return ApiResponse.error(res, error, 400);
    }

    if (!materialIds.length) {
      return ApiResponse.error(res, 'Provide at least one valid materialId to approve', 400, { invalidIds });
    }

    const materials = await Material.find({ _id: { $in: materialIds } })
      .populate('submittedBy', 'fullname email');

    const foundIdSet = new Set(materials.map((material) => material._id.toString()));
    const notFoundIds = materialIds.filter((materialId) => !foundIdSet.has(materialId));
    const pendingMaterials = materials.filter((material) => material.status === 'pending');
    const skippedMaterials = materials
      .filter((material) => material.status !== 'pending')
      .map((material) => ({
        _id: material._id,
        name: material.name,
        status: material.status,
        reason: 'Only pending materials can be approved'
      }));

    if (!pendingMaterials.length) {
      return ApiResponse.error(res, 'No pending materials found to approve', 400, {
        requestedCount: materialIds.length,
        invalidIds,
        notFoundIds,
        skippedMaterials
      });
    }

    const approvedAt = new Date();
    const approvedMaterials = [];

    for (const material of pendingMaterials) {
      material.status = 'approved';
      material.approvedBy = req.user._id;
      material.approvedAt = approvedAt;
      material.rejectionReason = null;
      material.approvalHistory.push({
        action: 'approved',
        performedBy: req.user._id,
        performedByName: req.user.fullname,
        reason: notes || 'Approved by platform owner',
        timestamp: approvedAt
      });

      await material.save();

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #10b981; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Material Approved</h1>
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

      approvedMaterials.push(materialToApi(material));
    }

    return ApiResponse.success(res, 'Materials approved successfully', {
      requestedCount: materialIds.length,
      approvedCount: approvedMaterials.length,
      invalidIds,
      notFoundIds,
      skippedMaterials,
      approvedMaterials
    });
  } catch (error) {
    console.error('Bulk approve materials error:', error);
    return ApiResponse.error(res, 'Error approving materials', 500);
  }
};

/**
 * @desc    Reject many pending materials by ID
 * @route   PATCH /api/platform/materials/reject
 * @access  Platform Owner
 */
exports.rejectMaterialsBulk = async (req, res) => {
  try {
    const { reason } = req.body || {};

    if (!reason) {
      return ApiResponse.error(res, 'Rejection reason is required', 400);
    }

    const { error, materialIds, invalidIds } = parseBulkMaterialIds(req.body || {});

    if (error) {
      return ApiResponse.error(res, error, 400);
    }

    if (!materialIds.length) {
      return ApiResponse.error(res, 'Provide at least one valid materialId to reject', 400, { invalidIds });
    }

    const materials = await Material.find({ _id: { $in: materialIds } })
      .populate('submittedBy', 'fullname email');

    const foundIdSet = new Set(materials.map((material) => material._id.toString()));
    const notFoundIds = materialIds.filter((materialId) => !foundIdSet.has(materialId));
    const pendingMaterials = materials.filter((material) => material.status === 'pending');
    const skippedMaterials = materials
      .filter((material) => material.status !== 'pending')
      .map((material) => ({
        _id: material._id,
        name: material.name,
        status: material.status,
        reason: 'Only pending materials can be rejected'
      }));

    if (!pendingMaterials.length) {
      return ApiResponse.error(res, 'No pending materials found to reject', 400, {
        requestedCount: materialIds.length,
        invalidIds,
        notFoundIds,
        skippedMaterials
      });
    }

    const rejectedAt = new Date();
    const rejectedMaterials = [];

    for (const material of pendingMaterials) {
      material.status = 'rejected';
      material.rejectionReason = reason;
      material.approvalHistory.push({
        action: 'rejected',
        performedBy: req.user._id,
        performedByName: req.user.fullname,
        reason,
        timestamp: rejectedAt
      });

      await material.save();

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #ef4444; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Material Rejected</h1>
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

      rejectedMaterials.push(materialToApi(material));
    }

    return ApiResponse.success(res, 'Materials rejected successfully', {
      requestedCount: materialIds.length,
      rejectedCount: rejectedMaterials.length,
      invalidIds,
      notFoundIds,
      skippedMaterials,
      rejectedMaterials
    });
  } catch (error) {
    console.error('Bulk reject materials error:', error);
    return ApiResponse.error(res, 'Error rejecting materials', 500);
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
      data: materialToApi(material)
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
