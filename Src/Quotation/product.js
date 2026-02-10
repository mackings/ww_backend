const Product = require('../../Models/productModel');
const ImageKit = require("imagekit");
const Material = require("../../Models/MaterialModel");
const { notifyCompany, notifyPlatformOwners, notifyAllCompanyOwners } = require('../../Utils/NotHelper');
const User = require("../../Models/user");
const {
  getCatalogMaterials,
  findCatalogMaterial,
  getCatalogSummary,
  getCatalogCacheInfo
} = require('../../Utils/materialCatalog');
const { buildWeakEtag, setJsonCacheHeaders, sendNotModifiedIfMatch } = require('../../Utils/httpCache');


const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});


/**
 * Convert any unit to meters
 */
const convertToMeters = (value, unit) => {
  const conversions = {
    'mm': 0.001,
    'cm': 0.01,
    'm': 1,
    'inches': 0.0254,
    'ft': 0.3048
  };
  
  const factor = conversions[unit.toLowerCase()];
  if (!factor) {
    throw new Error(`Unsupported unit: ${unit}`);
  }
  
  return value * factor;
};

/**
 * Calculate square meters from dimensions
 */
const calculateSquareMeters = (width, length, unit) => {
  const widthM = convertToMeters(width, unit);
  const lengthM = convertToMeters(length, unit);
  return widthM * lengthM;
};

const asBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());
};

const normalizePricingUnit = (unit = '') => {
  const normalized = String(unit || '').trim().toLowerCase();
  if (!normalized) return 'piece';
  if (normalized.includes('square meter') || normalized === 'sqm') return 'sqm';
  if (normalized.includes('yard') || normalized.includes('meter')) return 'meter';
  if (normalized.includes('pound')) return 'pound';
  if (normalized.includes('bag')) return 'bag';
  if (normalized.includes('liter') || normalized.includes('ltr')) return 'liter';
  return 'piece';
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const parseFraction = (value) => {
  if (!value) return null;
  const parts = String(value).trim().split('/');
  if (parts.length !== 2) return null;
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
};

const parseNumberish = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  const fraction = parseFraction(text);
  if (fraction !== null) return fraction;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const deriveThicknessFromCatalog = ({ category, size }) => {
  const cat = String(category || '').trim().toLowerCase();
  const rawSize = String(size || '').trim();
  if (!rawSize) return { thickness: null, thicknessUnit: 'inches' };

  if (cat === 'board') {
    const match = rawSize.match(/^\s*([0-9.]+|[0-9]+\/[0-9]+)\s*(\"|in|inch|inches)?\s*$/i);
    if (!match) return { thickness: null, thicknessUnit: 'inches' };
    return { thickness: parseNumberish(match[1]), thicknessUnit: 'inches' };
  }

  if (cat === 'wood') {
    const match = rawSize.match(/^\s*([0-9.]+|[0-9]+\/[0-9]+)\s*\"?\s*x/i);
    if (!match) return { thickness: null, thicknessUnit: 'inches' };
    return { thickness: parseNumberish(match[1]), thicknessUnit: 'inches' };
  }

  return { thickness: null, thicknessUnit: 'inches' };
};

const getUnitPrice = (material) => parseNumber(material.pricePerUnit) ?? parseNumber(material.catalogPrice) ?? null;

const isMaterialPriced = (material) => {
  const unitPrice = getUnitPrice(material);
  const sqmPrice = parseNumber(material.pricePerSqm);
  return (unitPrice !== null && unitPrice > 0) || (sqmPrice !== null && sqmPrice > 0);
};

const materialToApi = (material) => {
  const obj = material?.toObject ? material.toObject() : material;
  const unitPrice = getUnitPrice(obj || {});
  return {
    ...(obj || {}),
    unitPrice,
    isPriced: isMaterialPriced(obj || {})
  };
};

exports.createProduct = async (req, res) => {
  try {
    const { name, category, subCategory, description, isGlobal } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: "Please provide product name and category",
      });
    }

    // Check if this is a global product creation
    const isGlobalProduct = req.user.isPlatformOwner && isGlobal === true;

    // Platform owners creating global products don't need company
    if (!isGlobalProduct && !req.companyName) {
      return res.status(400).json({
        success: false,
        message: "Company context required for company products",
      });
    }

    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const productId = `PRD-${randomCode}`;

    let uploadedImage = null;
    if (req.file) {
      const uploadResponse = await imagekit.upload({
        file: req.file.buffer.toString("base64"),
        fileName: `${Date.now()}_${name.replace(/\s+/g, "_")}.jpg`,
        folder: "/products",
      });
      uploadedImage = uploadResponse.url;
    }

    const currentUser = await User.findById(req.user._id);

    const product = await Product.create({
      userId: req.user._id,
      companyName: isGlobalProduct ? 'GLOBAL' : req.companyName,
      name,
      productId,
      category,
      subCategory,
      description,
      image: uploadedImage,
      isGlobal: isGlobalProduct,
      status: isGlobalProduct ? 'approved' : 'pending',
      submittedBy: req.user._id,
      approvedBy: isGlobalProduct ? req.user._id : null,
      approvedAt: isGlobalProduct ? new Date() : null,
      approvalHistory: [{
        action: isGlobalProduct ? 'approved' : 'submitted',
        performedBy: req.user._id,
        performedByName: currentUser.fullname,
        timestamp: new Date()
      }]
    });

    // Notification logic
    if (isGlobalProduct) {
      // Notify all company owners about new global product
      await notifyAllCompanyOwners({
        type: 'global_product_added',
        title: 'New Global Product Available',
        message: `Platform added a new global product: ${name}`,
        performedBy: req.user._id,
        performedByName: currentUser.fullname,
        metadata: {
          productId: product._id,
          productCode: productId,
          productName: name,
          category,
          subCategory
        }
      });
    } else {
      // Notify company members
      await notifyCompany({
        companyName: req.companyName,
        type: 'product_created',
        title: 'New Product Created',
        message: `${currentUser.fullname} created a new product: ${name} (Pending Approval)`,
        performedBy: req.user._id,
        performedByName: currentUser.fullname,
        metadata: {
          productId: product._id,
          productCode: productId,
          productName: name,
          category,
          subCategory,
          status: 'pending'
        },
        excludeUserId: req.user._id
      });

      // Notify platform owners about pending product
      await notifyPlatformOwners({
        type: 'product_submitted_for_approval',
        title: 'Product Pending Approval',
        message: `${currentUser.fullname} from ${req.companyName} submitted product: ${name}`,
        performedBy: req.user._id,
        performedByName: currentUser.fullname,
        metadata: {
          productId: product._id,
          productCode: productId,
          productName: name,
          companyName: req.companyName,
          category
        }
      });
    }

    res.status(201).json({
      success: true,
      message: isGlobalProduct
        ? "Global product created successfully"
        : "Product submitted for approval",
      data: product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};

/**
 * @desc    Get all products
 * @route   GET /api/products
 * @access  Private
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { category, subCategory, search, page = 1, limit = 20, status } = req.query;

    let query = {};

    // Platform owners can see all products
    if (req.isPlatformOwner) {
      // Optional: filter by specific company
      if (req.query.companyName) {
        query.companyName = req.query.companyName;
        query.isGlobal = false;
      }
      // Optional: filter by status
      if (status) {
        query.status = status;
      }
    } else {
      // Regular users: see approved products from their company + all global products
      const companyRole = req.activeCompany.role;

      if (['owner', 'admin'].includes(companyRole)) {
        // Owners/Admins see all their company products + global products
        query.$or = [
          { companyName: req.companyName },
          { isGlobal: true, status: 'approved' }
        ];
      } else {
        // Staff only see approved products from company + global products
        query.$or = [
          { companyName: req.companyName, status: 'approved' },
          { isGlobal: true, status: 'approved' }
        ];
      }
    }

    if (category) {
      query.category = category;
    }

    if (subCategory) {
      query.subCategory = subCategory;
    }

    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { productId: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const products = await Product.find(query)
      .populate('submittedBy', 'fullname email')
      .populate('approvedBy', 'fullname email')
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
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products'
    });
  }
};

/**
 * @desc    Get single product
 * @route   GET /api/products/:id
 * @access  Private
 */
exports.getProduct = async (req, res) => {
  try {
    const baseFilter = { _id: req.params.id };
    const accessFilter = req.isPlatformOwner
      ? {}
      : {
          $or: [
            { companyName: req.companyName },
            { isGlobal: true, status: 'approved' }
          ]
        };
    const product = await Product.findOne({ ...baseFilter, ...accessFilter });

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
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product'
    });
  }
};

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Private
 */
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const {
      name,
      productId,
      category,
      subCategory,
      description,
      image
    } = req.body;

    // Store old values for notification
    const oldName = product.name;
    const oldCategory = product.category;

    // Check if new product ID already exists
    if (productId && productId !== product.productId) {
      const existingProduct = await Product.findOne({ 
        productId, 
        companyName: req.companyName,
        _id: { $ne: req.params.id }
      });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product ID already exists'
        });
      }
    }

    if (name) product.name = name;
    if (productId) product.productId = productId;
    if (category) product.category = category;
    if (subCategory) product.subCategory = subCategory;
    if (description) product.description = description;
    if (image) product.image = image;

    await product.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'product_updated',
      title: 'Product Updated',
      message: `${currentUser.fullname} updated product: ${product.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        productId: product._id,
        productCode: product.productId,
        oldName,
        newName: product.name,
        category: product.category
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product'
    });
  }
};

/**
 * @desc    Resubmit rejected product
 * @route   PATCH /api/product/:id/resubmit
 * @access  Private
 */
exports.resubmitProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      companyName: req.companyName
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Only rejected products can be resubmitted'
      });
    }

    // Update product fields if provided
    const { name, category, subCategory, description } = req.body;

    if (name) product.name = name;
    if (category) product.category = category;
    if (subCategory) product.subCategory = subCategory;
    if (description) product.description = description;

    // Handle image upload if present
    if (req.file) {
      const uploadResponse = await imagekit.upload({
        file: req.file.buffer.toString("base64"),
        fileName: `${Date.now()}_${product.name.replace(/\s+/g, "_")}.jpg`,
        folder: "/products",
      });
      product.image = uploadResponse.url;
    }

    // Reset approval status
    product.status = 'pending';
    product.rejectionReason = null;
    product.resubmissionCount += 1;

    product.approvalHistory.push({
      action: 'resubmitted',
      performedBy: req.user._id,
      performedByName: req.user.fullname,
      reason: `Resubmission attempt #${product.resubmissionCount}`,
      timestamp: new Date()
    });

    await product.save();

    const currentUser = await User.findById(req.user._id);

    // Notify platform owners
    await notifyPlatformOwners({
      type: 'product_resubmitted',
      title: 'Product Resubmitted',
      message: `${currentUser.fullname} from ${req.companyName} resubmitted product: ${product.name}`,
      performedBy: req.user._id,
      performedByName: currentUser.fullname,
      metadata: {
        productId: product._id,
        productCode: product.productId,
        productName: product.name,
        companyName: req.companyName,
        resubmissionCount: product.resubmissionCount
      }
    });

    res.status(200).json({
      success: true,
      message: 'Product resubmitted for approval',
      data: product
    });
  } catch (error) {
    console.error('Resubmit product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resubmitting product'
    });
  }
};

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:id
 * @access  Private
 */
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Store info before deletion
    const productName = product.name;
    const productCode = product.productId;
    const category = product.category;

    await product.deleteOne();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'product_deleted',
      title: 'Product Deleted',
      message: `${currentUser.fullname} deleted product: ${productName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        productName,
        productCode,
        category
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product'
    });
  }
};

/**
 * @desc    Get product categories
 * @route   GET /api/products/categories
 * @access  Private
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', {
      $or: [
        { companyName: req.companyName },
        { isGlobal: true, status: 'approved' }
      ]
    });

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories.'
    });
  }
};

// ==================== MATERIAL CONTROLLERS ====================

/**
 * @desc    Get all materials
 * @route   GET /api/materials
 * @access  Private
 */
exports.getMaterials = async (req, res) => {
  try {
    const { category, subCategory, isActive = true, search, priced } = req.query;

    // Build query to include company materials + approved global materials
    const query = {
      $or: [
        { companyName: req.companyName, status: 'approved' },
        { isGlobal: true, status: 'approved' }
      ],
      isActive: asBoolean(isActive, true)
    };

    if (category) {
      query.category = { $regex: `^${String(category).trim()}$`, $options: 'i' };
    }

    if (subCategory) {
      query.subCategory = { $regex: `^${String(subCategory).trim()}$`, $options: 'i' };
    }

    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { subCategory: { $regex: search, $options: 'i' } },
          { color: { $regex: search, $options: 'i' } }
        ]
      });
    }

    if (priced !== undefined) {
      const shouldBePriced = asBoolean(priced);
      query.$and = query.$and || [];
      query.$and.push(shouldBePriced
        ? { $or: [{ pricePerUnit: { $gt: 0 } }, { catalogPrice: { $gt: 0 } }, { pricePerSqm: { $gt: 0 } }] }
        : { $and: [{ pricePerUnit: { $in: [null, 0] } }, { catalogPrice: { $in: [null, 0] } }, { pricePerSqm: { $in: [null, 0] } }] });
    }

    const materials = await Material.find(query).sort({ category: 1, name: 1 });
    const data = materials.map(materialToApi);
    const lastUpdatedAt = materials.reduce((max, item) => {
      const value = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      return Math.max(max, value);
    }, 0);

    const etag = buildWeakEtag([
      'materials',
      req.companyName || '',
      category || '',
      subCategory || '',
      String(isActive),
      search || '',
      priced === undefined ? '' : String(priced),
      String(data.length),
      String(lastUpdatedAt)
    ]);

    setJsonCacheHeaders(res, {
      etag,
      cacheControl: 'private, max-age=60, stale-while-revalidate=300'
    });

    if (sendNotModifiedIfMatch(req, res, etag)) return;

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("Get materials error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching materials"
    });
  }
};

/**
 * @desc    Get materials grouped by category -> subCategory -> variants
 * @route   GET /api/materials/grouped
 * @access  Private
 */
exports.getMaterialsGrouped = async (req, res) => {
  try {
    const { category, subCategory, isActive = true, search, priced } = req.query;

    const query = {
      $or: [
        { companyName: req.companyName, status: 'approved' },
        { isGlobal: true, status: 'approved' }
      ],
      isActive: asBoolean(isActive, true)
    };

    if (category) {
      query.category = { $regex: `^${String(category).trim()}$`, $options: 'i' };
    }

    if (subCategory) {
      query.subCategory = { $regex: `^${String(subCategory).trim()}$`, $options: 'i' };
    }

    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { subCategory: { $regex: search, $options: 'i' } },
          { size: { $regex: search, $options: 'i' } },
          { unit: { $regex: search, $options: 'i' } },
          { color: { $regex: search, $options: 'i' } }
        ]
      });
    }

    if (priced !== undefined) {
      const shouldBePriced = asBoolean(priced);
      query.$and = query.$and || [];
      query.$and.push(shouldBePriced
        ? { $or: [{ pricePerUnit: { $gt: 0 } }, { catalogPrice: { $gt: 0 } }, { pricePerSqm: { $gt: 0 } }] }
        : { $and: [{ pricePerUnit: { $in: [null, 0] } }, { catalogPrice: { $in: [null, 0] } }, { pricePerSqm: { $in: [null, 0] } }] });
    }

    const materials = await Material.find(query).sort({ category: 1, subCategory: 1, name: 1 });

    const categoryMap = new Map();

    materials.forEach((material) => {
      const categoryKey = material.category || 'Uncategorized';
      const subCategoryKey = material.subCategory || 'General';

      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          category: categoryKey,
          total: 0,
          priced: 0,
          unpriced: 0,
          subCategories: new Map()
        });
      }

      const categoryNode = categoryMap.get(categoryKey);
      if (!categoryNode.subCategories.has(subCategoryKey)) {
        categoryNode.subCategories.set(subCategoryKey, {
          subCategory: subCategoryKey,
          total: 0,
          priced: 0,
          unpriced: 0,
          variants: []
        });
      }

      const subCategoryNode = categoryNode.subCategories.get(subCategoryKey);
      const apiMaterial = materialToApi(material);
      const isPricedMaterial = apiMaterial.isPriced;

      const variant = {
        id: apiMaterial._id,
        name: apiMaterial.name,
        type: apiMaterial.subCategory || '',
        size: apiMaterial.size || '',
        unit: apiMaterial.unit || '',
        color: apiMaterial.color || '',
        thickness: apiMaterial.thickness ?? null,
        thicknessUnit: apiMaterial.thicknessUnit || 'inches',
        pricingUnit: apiMaterial.pricingUnit || 'piece',
        unitPrice: apiMaterial.unitPrice ?? null,
        pricePerUnit: apiMaterial.pricePerUnit ?? null,
        pricePerSqm: apiMaterial.pricePerSqm ?? null,
        catalogPrice: apiMaterial.catalogPrice ?? null,
        isPriced: isPricedMaterial,
        isCatalogMaterial: apiMaterial.isCatalogMaterial || false,
        image: apiMaterial.image || null,
        status: apiMaterial.status,
        isGlobal: apiMaterial.isGlobal
      };

      subCategoryNode.variants.push(variant);
      subCategoryNode.total += 1;
      categoryNode.total += 1;

      if (isPricedMaterial) {
        subCategoryNode.priced += 1;
        categoryNode.priced += 1;
      } else {
        subCategoryNode.unpriced += 1;
        categoryNode.unpriced += 1;
      }
    });

    const grouped = Array.from(categoryMap.values()).map((categoryNode) => ({
      category: categoryNode.category,
      total: categoryNode.total,
      priced: categoryNode.priced,
      unpriced: categoryNode.unpriced,
      subCategories: Array.from(categoryNode.subCategories.values())
    }));

    const lastUpdatedAt = materials.reduce((max, item) => {
      const value = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      return Math.max(max, value);
    }, 0);
    const etag = buildWeakEtag([
      'materials_grouped',
      req.companyName || '',
      category || '',
      subCategory || '',
      String(isActive),
      search || '',
      priced === undefined ? '' : String(priced),
      String(materials.length),
      String(grouped.length),
      String(lastUpdatedAt)
    ]);

    setJsonCacheHeaders(res, {
      etag,
      cacheControl: 'private, max-age=60, stale-while-revalidate=300'
    });
    if (sendNotModifiedIfMatch(req, res, etag)) return;

    return res.status(200).json({
      success: true,
      count: materials.length,
      categoryCount: grouped.length,
      data: grouped
    });
  } catch (error) {
    console.error("Get grouped materials error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching grouped materials"
    });
  }
};

/**
 * @desc    Get supported materials from catalog
 * @route   GET /api/materials/supported
 * @access  Private
 */
exports.getSupportedMaterials = async (req, res) => {
  try {
    const { category, subCategory, search, priced, page = 1, limit = 100 } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

    let catalog = getCatalogMaterials();

    if (category) {
      const selectedCategory = String(category).trim().toLowerCase();
      catalog = catalog.filter((item) => item.category.toLowerCase() === selectedCategory);
    }

    if (subCategory) {
      const selectedSubCategory = String(subCategory).trim().toLowerCase();
      catalog = catalog.filter((item) => item.subCategory.toLowerCase() === selectedSubCategory);
    }

    if (search) {
      const searchTerm = String(search).trim().toLowerCase();
      catalog = catalog.filter((item) =>
        item.material.toLowerCase().includes(searchTerm)
        || item.category.toLowerCase().includes(searchTerm)
        || item.subCategory.toLowerCase().includes(searchTerm)
        || item.size.toLowerCase().includes(searchTerm)
        || item.color.toLowerCase().includes(searchTerm));
    }

    if (priced !== undefined) {
      const shouldBePriced = asBoolean(priced);
      catalog = catalog.filter((item) => shouldBePriced ? item.isPriced : !item.isPriced);
    }

    const total = catalog.length;
    const startIndex = (safePage - 1) * safeLimit;
    const pagedCatalog = catalog.slice(startIndex, startIndex + safeLimit);

    const cacheInfo = getCatalogCacheInfo();
    const etag = buildWeakEtag([
      'supported_catalog',
      category || '',
      subCategory || '',
      search || '',
      priced === undefined ? '' : String(priced),
      String(safePage),
      String(safeLimit),
      String(total),
      String(cacheInfo.mtimeMs || 0),
      String(cacheInfo.rowCount || 0)
    ]);
    setJsonCacheHeaders(res, {
      etag,
      cacheControl: 'public, max-age=3600, stale-while-revalidate=86400',
      vary: 'Authorization, Accept-Encoding'
    });
    if (sendNotModifiedIfMatch(req, res, etag)) return;

    return res.status(200).json({
      success: true,
      message: 'Supported materials fetched successfully',
      count: pagedCatalog.length,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
      data: pagedCatalog
    });
  } catch (error) {
    console.error("Get supported materials error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching supported materials"
    });
  }
};

/**
 * @desc    Get supported material summary by category/subcategory
 * @route   GET /api/materials/supported/summary
 * @access  Private
 */
exports.getSupportedMaterialsSummary = async (req, res) => {
  try {
    const summary = getCatalogSummary();
    const totals = summary.reduce((accumulator, category) => ({
      total: accumulator.total + category.total,
      priced: accumulator.priced + category.priced,
      unpriced: accumulator.unpriced + category.unpriced
    }), { total: 0, priced: 0, unpriced: 0 });

    const cacheInfo = getCatalogCacheInfo();
    const etag = buildWeakEtag([
      'supported_catalog_summary',
      String(cacheInfo.mtimeMs || 0),
      String(cacheInfo.rowCount || 0)
    ]);
    setJsonCacheHeaders(res, {
      etag,
      cacheControl: 'public, max-age=3600, stale-while-revalidate=86400',
      vary: 'Authorization, Accept-Encoding'
    });
    if (sendNotModifiedIfMatch(req, res, etag)) return;

    return res.status(200).json({
      success: true,
      message: 'Supported material summary fetched successfully',
      totals,
      categories: summary
    });
  } catch (error) {
    console.error("Get supported materials summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching supported material summary"
    });
  }
};

/**
 * @desc    Create material
 * @route   POST /api/materials
 * @access  Private
 */
 exports.createMaterial = async (req, res) => {
  try {
    const {
      catalogMaterial,
      name,
      category,
      subCategory,
      size,
      color,
      thickness,
      thicknessUnit,
      standardWidth,
      standardLength,
      standardUnit,
      pricePerSqm,
      pricePerUnit,
      pricingUnit,
      types,
      sizeVariants,
      foamVariants,
      commonThicknesses,
      wasteThreshold,
      unit,
      notes,
      isGlobal,
      useCatalog = true
    } = req.body;

    const parseJsonArray = (value, fieldName) => {
      if (value === undefined || value === null || value === '') return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new Error(`${fieldName} must be an array`);
          }
          return parsed;
        } catch (error) {
          throw new Error(`${fieldName} must be a valid JSON array`);
        }
      }
      throw new Error(`${fieldName} must be an array`);
    };

    let parsedTypes;
    let parsedSizeVariants;
    let parsedFoamVariants;
    let parsedCommonThicknesses;
    try {
      parsedTypes = parseJsonArray(types, 'types');
      parsedSizeVariants = parseJsonArray(sizeVariants, 'sizeVariants');
      parsedFoamVariants = parseJsonArray(foamVariants, 'foamVariants');
      parsedCommonThicknesses = parseJsonArray(commonThicknesses, 'commonThicknesses');
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const shouldValidateAgainstCatalog = asBoolean(useCatalog, true);
    const requestedMaterialName = catalogMaterial || name;

    if (!requestedMaterialName) {
      return res.status(400).json({
        success: false,
        message: "Material name is required"
      });
    }

    let selectedCatalogMaterial = null;
    if (shouldValidateAgainstCatalog) {
      const { exact, matches } = findCatalogMaterial({
        material: requestedMaterialName,
        category,
        subCategory,
        size,
        unit,
        color
      });

      if (!exact) {
        if (matches.length > 1) {
          return res.status(400).json({
            success: false,
            message: "Multiple supported variants found. Please include category/subCategory/size/unit/color.",
            options: matches.slice(0, 10)
          });
        }

        return res.status(400).json({
          success: false,
          message: "Material must match supported catalog entries from the uploaded Excel sheet."
        });
      }

      selectedCatalogMaterial = exact;
    }

    // Platform owners default to global materials; non-platform users always submit for approval
    const isGlobalFlag = isGlobal === true || isGlobal === 'true' || isGlobal === 1 || isGlobal === '1';
    const isGlobalMaterial = req.user.isPlatformOwner
      ? (isGlobal === undefined ? true : isGlobalFlag)
      : false;

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      const uploadResult = await imagekit.upload({
        file: req.file.buffer.toString("base64"),
        fileName: `material_${Date.now()}_${req.file.originalname}`,
        folder: '/materials'
      });
      imageUrl = uploadResult.url;
    }

    const finalCategory = selectedCatalogMaterial ? selectedCatalogMaterial.category : category;
    const finalSubCategory = selectedCatalogMaterial ? selectedCatalogMaterial.subCategory : (subCategory || '');
    const finalSize = selectedCatalogMaterial ? selectedCatalogMaterial.size : (size || '');
    const finalColor = selectedCatalogMaterial ? selectedCatalogMaterial.color : (color || '');
    const finalUnit = selectedCatalogMaterial ? selectedCatalogMaterial.unit : (unit || '');
    const catalogPrice = selectedCatalogMaterial ? selectedCatalogMaterial.priceNumeric : null;
    const finalPricePerUnit = parseNumber(pricePerUnit) ?? catalogPrice;
    const finalPricingUnit = pricingUnit || normalizePricingUnit(finalUnit);
    const derivedThickness = selectedCatalogMaterial
      ? { thickness: selectedCatalogMaterial.thickness, thicknessUnit: selectedCatalogMaterial.thicknessUnit }
      : deriveThicknessFromCatalog({ category: finalCategory, size: finalSize });

    const thicknessValue = parseNumberish(thickness) ?? derivedThickness.thickness;
    const thicknessUnitValue = (thicknessUnit || derivedThickness.thicknessUnit || 'inches');

    if (!finalCategory) {
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    const categoryForThicknessRule = String(finalCategory || '').trim().toLowerCase();
    if (['board', 'wood'].includes(categoryForThicknessRule) && (thicknessValue === null || thicknessValue === undefined)) {
      return res.status(400).json({
        success: false,
        message: "Thickness is required for Board/Wood materials. Provide thickness (e.g. 0.25) and thicknessUnit (e.g. inches)."
      });
    }

    const material = new Material({
      name: selectedCatalogMaterial ? selectedCatalogMaterial.material : name,
      companyName: isGlobalMaterial ? 'GLOBAL' : req.companyName,
      category: finalCategory,
      subCategory: finalSubCategory,
      size: finalSize,
      color: finalColor,
      unit: finalUnit,
      thickness: thicknessValue,
      thicknessUnit: thicknessUnitValue,
      catalogKey: selectedCatalogMaterial ? selectedCatalogMaterial.key : '',
      catalogPrice,
      isCatalogMaterial: Boolean(selectedCatalogMaterial),
      isCatalogPriced: Boolean(selectedCatalogMaterial?.isPriced),
      image: imageUrl,
      standardWidth,
      standardLength,
      standardUnit: standardUnit || 'inches',
      pricePerSqm: parseNumber(pricePerSqm),
      pricePerUnit: finalPricePerUnit,
      pricingUnit: finalPricingUnit,
      types: parsedTypes,
      sizeVariants: parsedSizeVariants,
      foamVariants: parsedFoamVariants,
      commonThicknesses: parsedCommonThicknesses,
      wasteThreshold: wasteThreshold || 0.75,
      notes,
      isGlobal: isGlobalMaterial,
      status: isGlobalMaterial ? 'approved' : 'pending',
      submittedBy: req.user._id,
      approvedBy: isGlobalMaterial ? req.user._id : null,
      approvedAt: isGlobalMaterial ? new Date() : null,
      approvalHistory: [{
        action: isGlobalMaterial ? 'approved' : 'submitted',
        performedBy: req.user._id,
        performedByName: req.user.fullname,
        reason: isGlobalMaterial ? 'Global material - auto approved by platform owner' : 'Initial submission',
        timestamp: new Date()
      }]
    });

    await material.save();

    // Get current user
    const currentUser = await User.findById(req.user._id);

    if (isGlobalMaterial) {
      // Notify all company owners about new global material
      await notifyAllCompanyOwners({
        type: 'global_material_added',
        title: 'New Global Material',
        message: `Platform added new global material: ${material.name} (${finalCategory})`,
        performedBy: req.user._id,
        performedByName: currentUser.fullname,
        metadata: {
          materialId: material._id,
          materialName: material.name,
          category: finalCategory,
          subCategory: finalSubCategory
        }
      });
    } else {
      // Notify platform owners about pending material
      await notifyPlatformOwners({
        type: 'material_submitted_for_approval',
        title: 'Material Pending Approval',
        message: `${currentUser.fullname} from ${req.companyName} submitted material: ${material.name} (${finalCategory})`,
        performedBy: req.user._id,
        performedByName: currentUser.fullname,
        metadata: {
          materialId: material._id,
          materialName: material.name,
          companyName: req.companyName,
          category: finalCategory,
          subCategory: finalSubCategory
        }
      });
    }

    res.status(201).json({
      success: true,
      data: materialToApi(material)
    });

  } catch (error) {
    console.error("Create material error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error creating material"
    });
  }
};

/**
 * @desc    Calculate material cost
 * @route   POST /api/materials/:materialId/calculate
 * @access  Private
 */
exports.calculateMaterialCost = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { 
      requiredWidth, 
      requiredLength, 
      requiredUnit,
      materialType,
      sizeVariant,
      foamThickness,
      foamDensity,
      quantity = 1
    } = req.body;

    const hasDimensionInput = requiredWidth && requiredLength && requiredUnit;
    const parsedQuantity = parseNumber(quantity);
    const quantityNumber = parsedQuantity === null ? 1 : parsedQuantity;

    if (quantityNumber <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive number"
      });
    }

    if (hasDimensionInput && (requiredWidth <= 0 || requiredLength <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Width and length must be positive numbers"
      });
    }

    const material = await Material.findOne({
      _id: materialId,
      $or: [
        { companyName: req.companyName, status: 'approved' },
        { isGlobal: true, status: 'approved' }
      ]
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

    const pricePerUnit = parseNumber(material.pricePerUnit) ?? parseNumber(material.catalogPrice);

    if (!hasDimensionInput) {
      const safeUnitPrice = pricePerUnit ?? 0;
      const totalMaterialCost = quantityNumber * safeUnitPrice;
      return res.status(200).json({
        success: true,
        data: {
          material: {
            id: material._id,
            name: material.name,
            category: material.category,
            subCategory: material.subCategory || '',
            unit: material.unit || material.pricingUnit || 'piece'
          },
          calculation: {
            mode: 'unit_based',
            quantity: quantityNumber,
            needsPricing: pricePerUnit === null
          },
          pricing: {
            pricePerUnit: safeUnitPrice.toFixed(2),
            totalMaterialCost: totalMaterialCost.toFixed(2)
          }
        }
      });
    }

    // Calculate project area in square meters
    const projectAreaSqm = calculateSquareMeters(
      requiredWidth, 
      requiredLength, 
      requiredUnit
    );

    // Get the appropriate dimensions and price based on variants
    let standardWidth = material.standardWidth;
    let standardLength = material.standardLength;
    let standardUnit = material.standardUnit;
    let pricePerSqm = parseNumber(material.pricePerSqm);

    // Check for size variant
    if (sizeVariant && material.sizeVariants?.length) {
      const variant = material.sizeVariants.find(v => 
        v.name.toLowerCase() === sizeVariant.toLowerCase()
      );
      
      if (variant) {
        standardWidth = variant.width;
        standardLength = variant.length;
        standardUnit = variant.unit || material.standardUnit;
        if (variant.pricePerUnit) {
          pricePerSqm = variant.pricePerUnit;
        }
      }
    }

    // Check for foam variant
    if (material.category === 'FOAM' && foamThickness && material.foamVariants?.length) {
      const variant = material.foamVariants.find(v => 
        v.thickness == foamThickness && 
        (!foamDensity || v.density?.toLowerCase() === foamDensity.toLowerCase())
      );
      
      if (variant) {
        if (variant.width) standardWidth = variant.width;
        if (variant.length) standardLength = variant.length;
        if (variant.dimensionUnit) standardUnit = variant.dimensionUnit;
        if (variant.pricePerSqm) pricePerSqm = variant.pricePerSqm;
      }
    }

    // Check for material type price override
    if (materialType && material.types?.length) {
      const typeData = material.types.find(t => 
        t.name.toLowerCase() === materialType.toLowerCase()
      );
      
      if (!typeData) {
        return res.status(404).json({
          success: false,
          message: `Material type '${materialType}' not found for ${material.name}`
        });
      }
      
      if (typeData.pricePerSqm) {
        pricePerSqm = typeData.pricePerSqm;
      }
      
      if (typeData.standardWidth) standardWidth = typeData.standardWidth;
      if (typeData.standardLength) standardLength = typeData.standardLength;
    }

    if (!standardWidth || !standardLength || !standardUnit || pricePerSqm === null) {
      const safeUnitPrice = pricePerUnit ?? 0;
      const totalMaterialCost = quantityNumber * safeUnitPrice;
      return res.status(200).json({
        success: true,
        data: {
          material: {
            id: material._id,
            name: material.name,
            category: material.category,
            subCategory: material.subCategory || '',
            unit: material.unit || material.pricingUnit || 'piece'
          },
          calculation: {
            mode: 'unit_based',
            quantity: quantityNumber,
            needsPricing: pricePerUnit === null
          },
          pricing: {
            pricePerUnit: safeUnitPrice.toFixed(2),
            totalMaterialCost: totalMaterialCost.toFixed(2)
          }
        }
      });
    }

    // Calculate standard sheet area
    const standardAreaSqm = calculateSquareMeters(
      standardWidth,
      standardLength,
      standardUnit
    );

    // Calculate minimum units needed
    let minimumUnits = Math.ceil(projectAreaSqm / standardAreaSqm);
    
    const rawRemainder = projectAreaSqm % standardAreaSqm;
    const wasteThresholdArea = standardAreaSqm * material.wasteThreshold;
    
    if (rawRemainder > 0 && rawRemainder > wasteThresholdArea) {
      minimumUnits += 1;
    }

    // Calculate pricing
    const pricePerFullUnit = standardAreaSqm * pricePerSqm;
    const totalMaterialCost = minimumUnits * pricePerFullUnit;

    // Calculate waste
    const totalAreaUsed = minimumUnits * standardAreaSqm;
    const wasteArea = totalAreaUsed - projectAreaSqm;
    const wastePercentage = (wasteArea / totalAreaUsed) * 100;

    return res.status(200).json({
      success: true,
      data: {
        material: {
          id: material._id,
          name: material.name,
          category: material.category,
          type: materialType || null,
          variant: sizeVariant || null
        },
        project: {
          requiredWidth,
          requiredLength,
          requiredUnit,
          projectAreaSqm: projectAreaSqm.toFixed(4)
        },
        standard: {
          standardWidth,
          standardLength,
          standardUnit,
          standardAreaSqm: standardAreaSqm.toFixed(4)
        },
        calculation: {
          minimumUnits,
          wasteThreshold: material.wasteThreshold,
          rawRemainder: rawRemainder.toFixed(4),
          wasteThresholdArea: wasteThresholdArea.toFixed(4),
          extraUnitAdded: rawRemainder > 0 && rawRemainder > wasteThresholdArea
        },
        pricing: {
          pricePerSqm: pricePerSqm.toFixed(2),
          pricePerFullUnit: pricePerFullUnit.toFixed(2),
          totalMaterialCost: totalMaterialCost.toFixed(2)
        },
        waste: {
          totalAreaUsed: totalAreaUsed.toFixed(4),
          wasteArea: wasteArea.toFixed(4),
          wastePercentage: wastePercentage.toFixed(2)
        }
      }
    });

  } catch (error) {
    console.error("Calculate material cost error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error calculating material cost"
    });
  }
};

/**
 * @desc    Update material
 * @route   PUT /api/materials/:materialId
 * @access  Private
 */
exports.updateMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const updateData = req.body;

    const material = await Material.findOne({
      _id: materialId,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

    // Store old values
    const oldName = material.name;
    const oldCategory = material.category;

    // Update material
    Object.assign(material, updateData);
    await material.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'material_updated',
      title: 'Material Updated',
      message: `${currentUser.fullname} updated material: ${material.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        materialId: material._id,
        oldName,
        newName: material.name,
        category: material.category
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      data: material
    });

  } catch (error) {
    console.error("Update material error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating material"
    });
  }
};

/**
 * @desc    Add material types
 * @route   POST /api/materials/:materialId/types
 * @access  Private
 */
exports.addMaterialTypes = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { types } = req.body;

    if (!types || !Array.isArray(types)) {
      return res.status(400).json({
        success: false,
        message: "Types must be an array"
      });
    }

    const material = await Material.findOne({
      _id: materialId,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

    // Add new types without duplicates
    types.forEach(t => {
      const typeName = (typeof t === 'string' ? t : t.name).trim();
      const typePrice = typeof t === 'object' ? t.pricePerSqm : undefined;
      const typeWidth = typeof t === 'object' ? t.standardWidth : undefined;
      const typeLength = typeof t === 'object' ? t.standardLength : undefined;
      
      if (!material.types.some(mt => mt.name.toLowerCase() === typeName.toLowerCase())) {
        material.types.push({ 
          name: typeName,
          pricePerSqm: typePrice,
          standardWidth: typeWidth,
          standardLength: typeLength
        });
      }
    });

    await material.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'material_updated',
      title: 'Material Types Added',
      message: `${currentUser.fullname} added types to material: ${material.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        materialId: material._id,
        materialName: material.name,
        typesAdded: types.map(t => typeof t === 'string' ? t : t.name)
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      data: material
    });

  } catch (error) {
    console.error("Add material types error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding material types"
    });
  }
};

/**
 * @desc    Delete material
 * @route   DELETE /api/materials/:materialId
 * @access  Private
 */
exports.deleteMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;

    const material = await Material.findOne({
      _id: materialId,
      companyName: req.companyName // ✅ Filter by company
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

    // Store info before deletion
    const materialName = material.name;
    const category = material.category;

    await material.deleteOne();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'material_deleted',
      title: 'Material Deleted',
      message: `${currentUser.fullname} deleted material: ${materialName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        materialName,
        category
      },
      excludeUserId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: "Material deleted successfully"
    });

  } catch (error) {
    console.error("Delete material error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting material"
    });
  }
};
