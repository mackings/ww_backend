const ApiResponse = require('../../Utils/apiResponse');
const { notifyCompany } = require('../../Utils/NotHelper');
const Quotation = require('../../Models/quotationModel');
const BOM = require('../../Models/bomModel');
const User = require('../../Models/user');
const Product = require('../../Models/productModel');
const Material = require('../../Models/MaterialModel');

const calculateMaterialsTotal = (materials = []) => materials.reduce((sum, material) => {
  const squareMeter = material.squareMeter || 0;
  const price = material.price || 0;
  const quantity = material.quantity || 1;
  return sum + (price * squareMeter * quantity);
}, 0);

const calculateAdditionalTotal = (additionalCosts = []) => additionalCosts.reduce(
  (sum, cost) => sum + (cost.amount || 0),
  0
);

const applyPricing = (bom, pricingInput = {}) => {
  const materialsTotal = pricingInput.materialsTotal !== undefined
    ? Number(pricingInput.materialsTotal)
    : calculateMaterialsTotal(bom.materials);
  const additionalTotal = pricingInput.additionalTotal !== undefined
    ? Number(pricingInput.additionalTotal)
    : calculateAdditionalTotal(bom.additionalCosts);

  const overheadCost = pricingInput.overheadCost !== undefined
    ? Number(pricingInput.overheadCost)
    : (bom.pricing?.overheadCost || 0);

  const markupPercentage = pricingInput.markupPercentage !== undefined
    ? Number(pricingInput.markupPercentage)
    : (bom.pricing?.markupPercentage || 0);

  const costPrice = pricingInput.costPrice !== undefined
    ? Number(pricingInput.costPrice)
    : (materialsTotal + additionalTotal + overheadCost);

  const sellingPrice = pricingInput.sellingPrice !== undefined
    ? Number(pricingInput.sellingPrice)
    : (costPrice + (costPrice * markupPercentage) / 100);

  bom.pricing = {
    pricingMethod: pricingInput.pricingMethod || bom.pricing?.pricingMethod || null,
    markupPercentage,
    materialsTotal,
    additionalTotal,
    overheadCost,
    costPrice,
    sellingPrice
  };

  bom.materialsCost = Number(materialsTotal.toFixed(2));
  bom.additionalCostsTotal = Number(additionalTotal.toFixed(2));
  bom.totalCost = Number((materialsTotal + additionalTotal).toFixed(2));
};

const buildPagination = (page, limit, total) => ({
  page: parseInt(page, 10),
  limit: parseInt(limit, 10),
  total,
  pages: Math.ceil(total / limit)
});

const getActiveCompanyOrError = (req, res) => {
  if (!req.companyName) {
    ApiResponse.error(res, 'Company context required', 400);
    return null;
  }
  return req.companyName;
};

/**
 * @desc    Get all quotations (company)
 * @route   GET /api/database/quotations
 * @access  Private
 */
exports.getQuotations = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const { page = 1, limit = 50, search } = req.query;
    const query = { companyName };
    if (search) {
      query.$or = [
        { clientName: { $regex: search, $options: 'i' } },
        { quotationNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const data = await Quotation.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const total = await Quotation.countDocuments(query);
    return ApiResponse.success(res, 'Quotations fetched successfully', {
      data,
      pagination: buildPagination(page, limit, total)
    });
  } catch (error) {
    console.error('Get quotations (database) error:', error);
    return ApiResponse.error(res, 'Error fetching quotations', 500);
  }
};

/**
 * @desc    Update quotation (company)
 * @route   PUT /api/database/quotations/:id
 * @access  Private
 */
exports.updateQuotation = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const quotation = await Quotation.findOne({
      _id: req.params.id,
      companyName
    });

    if (!quotation) {
      return ApiResponse.error(res, 'Quotation not found', 404);
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

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'quotation_updated',
      title: 'Quotation Updated',
      message: `${currentUser.fullname} updated quotation for ${quotation.clientName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        quotationId: quotation._id,
        quotationNumber: quotation.quotationNumber,
        clientName: quotation.clientName
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Quotation updated successfully', quotation);
  } catch (error) {
    console.error('Update quotation (database) error:', error);
    return ApiResponse.error(res, 'Error updating quotation', 500);
  }
};

/**
 * @desc    Delete quotation (company)
 * @route   DELETE /api/database/quotations/:id
 * @access  Private
 */
exports.deleteQuotation = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const quotation = await Quotation.findOne({
      _id: req.params.id,
      companyName
    });

    if (!quotation) {
      return ApiResponse.error(res, 'Quotation not found', 404);
    }

    const clientName = quotation.clientName;
    const quotationNumber = quotation.quotationNumber;
    await quotation.deleteOne();

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'quotation_deleted',
      title: 'Quotation Deleted',
      message: `${currentUser.fullname} deleted quotation for ${clientName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        quotationNumber,
        clientName
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Quotation deleted successfully');
  } catch (error) {
    console.error('Delete quotation (database) error:', error);
    return ApiResponse.error(res, 'Error deleting quotation', 500);
  }
};

/**
 * @desc    Get all BOMs (company)
 * @route   GET /api/database/boms
 * @access  Private
 */
exports.getBoms = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const { page = 1, limit = 50, search } = req.query;
    const query = { companyName };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { bomNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const data = await BOM.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const total = await BOM.countDocuments(query);
    return ApiResponse.success(res, 'BOMs fetched successfully', {
      data,
      pagination: buildPagination(page, limit, total)
    });
  } catch (error) {
    console.error('Get BOMs (database) error:', error);
    return ApiResponse.error(res, 'Error fetching BOMs', 500);
  }
};

/**
 * @desc    Update BOM (company)
 * @route   PUT /api/database/boms/:id
 * @access  Private
 */
exports.updateBom = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const bom = await BOM.findOne({
      _id: req.params.id,
      companyName
    });

    if (!bom) {
      return ApiResponse.error(res, 'BOM not found', 404);
    }

    const {
      name,
      description,
      materials,
      additionalCosts,
      dueDate,
      product,
      pricing,
      expectedDuration
    } = req.body;

    let shouldRecalculate = false;
    if (materials) {
      bom.materials = materials;
      shouldRecalculate = true;
    }
    if (additionalCosts !== undefined) {
      bom.additionalCosts = additionalCosts;
      shouldRecalculate = true;
    }

    if (product && typeof product === 'object') {
      bom.product = {
        productId: product.productId || bom.product?.productId || null,
        name: product.name || bom.product?.name || null,
        description: product.description || bom.product?.description || null,
        image: product.image || bom.product?.image || null
      };
    }

    if (name) bom.name = name;
    if (description) bom.description = description;
    if (dueDate !== undefined) bom.dueDate = dueDate;
    if (expectedDuration !== undefined) bom.expectedDuration = expectedDuration;

    if (shouldRecalculate || pricing) {
      applyPricing(bom, pricing || {});
    }

    await bom.save();

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'bom_updated',
      title: 'BOM Updated',
      message: `${currentUser.fullname} updated BOM: ${bom.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        bomId: bom._id,
        bomName: bom.name
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'BOM updated successfully', bom);
  } catch (error) {
    console.error('Update BOM (database) error:', error);
    return ApiResponse.error(res, 'Error updating BOM', 500);
  }
};

/**
 * @desc    Delete BOM (company)
 * @route   DELETE /api/database/boms/:id
 * @access  Private
 */
exports.deleteBom = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const bom = await BOM.findOne({
      _id: req.params.id,
      companyName
    });

    if (!bom) {
      return ApiResponse.error(res, 'BOM not found', 404);
    }

    const bomName = bom.name;
    await bom.deleteOne();

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'bom_deleted',
      title: 'BOM Deleted',
      message: `${currentUser.fullname} deleted BOM: ${bomName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        bomName
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'BOM deleted successfully');
  } catch (error) {
    console.error('Delete BOM (database) error:', error);
    return ApiResponse.error(res, 'Error deleting BOM', 500);
  }
};

/**
 * @desc    Get staff list (company)
 * @route   GET /api/database/staff
 * @access  Private
 */
exports.getStaff = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const users = await User.find({
      'companies.name': companyName
    }).select('-password');

    const staffList = [];
    users.forEach(u => {
      const companyData = u.companies.find(c => c.name === companyName);
      if (companyData) {
        staffList.push({
          id: u._id,
          fullname: u.fullname,
          email: u.email,
          phoneNumber: u.phoneNumber,
          role: companyData.role,
          position: companyData.position,
          accessGranted: companyData.accessGranted,
          permissions: companyData.permissions || {},
          joinedAt: companyData.joinedAt
        });
      }
    });

    return ApiResponse.success(res, 'Staff fetched successfully', staffList);
  } catch (error) {
    console.error('Get staff (database) error:', error);
    return ApiResponse.error(res, 'Error fetching staff', 500);
  }
};

/**
 * @desc    Update staff (company)
 * @route   PUT /api/database/staff/:userId
 * @access  Private (Owner/Admin)
 */
exports.updateStaff = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const { role, position, accessGranted, permissions } = req.body;
    const staffUser = await User.findById(req.params.userId);
    if (!staffUser) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    const companyIndex = staffUser.companies.findIndex(c => c.name === companyName);
    if (companyIndex === -1) {
      return ApiResponse.error(res, 'Staff is not part of this company', 404);
    }

    if (staffUser.companies[companyIndex].role === 'owner') {
      return ApiResponse.error(res, 'Cannot modify owner', 403);
    }

    if (role) staffUser.companies[companyIndex].role = role;
    if (position) staffUser.companies[companyIndex].position = position;
    if (accessGranted !== undefined) staffUser.companies[companyIndex].accessGranted = accessGranted;
    if (permissions && typeof permissions === 'object') {
      staffUser.companies[companyIndex].permissions = {
        ...staffUser.companies[companyIndex].permissions,
        ...permissions
      };
    }

    await staffUser.save();

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'staff_updated',
      title: 'Staff Updated',
      message: `${currentUser.fullname} updated staff: ${staffUser.fullname}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        staffId: staffUser._id
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Staff updated successfully');
  } catch (error) {
    console.error('Update staff (database) error:', error);
    return ApiResponse.error(res, 'Error updating staff', 500);
  }
};

/**
 * @desc    Remove staff from company
 * @route   DELETE /api/database/staff/:userId
 * @access  Private (Owner/Admin)
 */
exports.deleteStaff = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const staffUser = await User.findById(req.params.userId);
    if (!staffUser) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    const companyIndex = staffUser.companies.findIndex(c => c.name === companyName);
    if (companyIndex === -1) {
      return ApiResponse.error(res, 'Staff is not part of this company', 404);
    }

    if (staffUser.companies[companyIndex].role === 'owner') {
      return ApiResponse.error(res, 'Cannot remove owner', 403);
    }

    staffUser.companies.splice(companyIndex, 1);
    if (staffUser.activeCompanyIndex >= staffUser.companies.length) {
      staffUser.activeCompanyIndex = Math.max(0, staffUser.companies.length - 1);
    }
    await staffUser.save();

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'staff_removed',
      title: 'Staff Removed',
      message: `${currentUser.fullname} removed staff: ${staffUser.fullname}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        staffId: staffUser._id
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Staff removed successfully');
  } catch (error) {
    console.error('Delete staff (database) error:', error);
    return ApiResponse.error(res, 'Error deleting staff', 500);
  }
};

/**
 * @desc    Get clients (derived from quotations)
 * @route   GET /api/database/clients
 * @access  Private
 */
exports.getClients = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const quotations = await Quotation.find({ companyName })
      .select('clientName phoneNumber email clientAddress nearestBusStop')
      .lean();

    const uniqueClients = [];
    const seen = new Set();
    quotations.forEach(q => {
      const key = `${q.clientName}-${q.phoneNumber || q.email || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueClients.push({
          clientName: q.clientName,
          phoneNumber: q.phoneNumber || null,
          email: q.email || null,
          clientAddress: q.clientAddress || null,
          nearestBusStop: q.nearestBusStop || null
        });
      }
    });

    return ApiResponse.success(res, 'Clients fetched successfully', uniqueClients);
  } catch (error) {
    console.error('Get clients (database) error:', error);
    return ApiResponse.error(res, 'Error fetching clients', 500);
  }
};

/**
 * @desc    Update client info across quotations
 * @route   PUT /api/database/clients
 * @access  Private
 */
exports.updateClient = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const { match, update } = req.body || {};
    if (!match || (!match.clientName && !match.phoneNumber && !match.email)) {
      return ApiResponse.error(res, 'Match criteria required', 400);
    }
    if (!update || typeof update !== 'object') {
      return ApiResponse.error(res, 'Update data required', 400);
    }

    const query = { companyName };
    if (match.clientName) query.clientName = match.clientName;
    if (match.phoneNumber) query.phoneNumber = match.phoneNumber;
    if (match.email) query.email = match.email;

    const quotations = await Quotation.find(query).select('_id clientName');
    if (!quotations.length) {
      return ApiResponse.error(res, 'Client not found', 404);
    }

    const updateFields = {};
    ['clientName', 'phoneNumber', 'email', 'clientAddress', 'nearestBusStop'].forEach(field => {
      if (update[field] !== undefined) {
        updateFields[field] = update[field];
      }
    });

    await Quotation.updateMany({ _id: { $in: quotations.map(q => q._id) } }, { $set: updateFields });

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'client_updated',
      title: 'Client Updated',
      message: `${currentUser.fullname} updated client info`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        affectedQuotations: quotations.length
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Client updated successfully', {
      affectedQuotations: quotations.length
    });
  } catch (error) {
    console.error('Update client (database) error:', error);
    return ApiResponse.error(res, 'Error updating client', 500);
  }
};

/**
 * @desc    Delete client (removes related quotations)
 * @route   DELETE /api/database/clients
 * @access  Private
 */
exports.deleteClient = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const { match } = req.body || {};
    if (!match || (!match.clientName && !match.phoneNumber && !match.email)) {
      return ApiResponse.error(res, 'Match criteria required', 400);
    }

    const query = { companyName };
    if (match.clientName) query.clientName = match.clientName;
    if (match.phoneNumber) query.phoneNumber = match.phoneNumber;
    if (match.email) query.email = match.email;

    const quotations = await Quotation.find(query).select('_id clientName');
    if (!quotations.length) {
      return ApiResponse.error(res, 'Client not found', 404);
    }

    const result = await Quotation.deleteMany({ _id: { $in: quotations.map(q => q._id) } });

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'client_deleted',
      title: 'Client Deleted',
      message: `${currentUser.fullname} deleted a client and related quotations`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        deletedQuotations: result.deletedCount || quotations.length
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Client deleted successfully', {
      deletedQuotations: result.deletedCount || quotations.length
    });
  } catch (error) {
    console.error('Delete client (database) error:', error);
    return ApiResponse.error(res, 'Error deleting client', 500);
  }
};

/**
 * @desc    Get products (company)
 * @route   GET /api/database/products
 * @access  Private
 */
exports.getProducts = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const { page = 1, limit = 50, search, category } = req.query;
    const query = { companyName };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) {
      query.category = category;
    }

    const data = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));
    const total = await Product.countDocuments(query);

    return ApiResponse.success(res, 'Products fetched successfully', {
      data,
      pagination: buildPagination(page, limit, total)
    });
  } catch (error) {
    console.error('Get products (database) error:', error);
    return ApiResponse.error(res, 'Error fetching products', 500);
  }
};

/**
 * @desc    Update product (company)
 * @route   PUT /api/database/products/:id
 * @access  Private
 */
exports.updateProduct = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const product = await Product.findOne({
      _id: req.params.id,
      companyName
    });

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    const { name, productId, category, subCategory, description, image } = req.body;

    if (productId && productId !== product.productId) {
      const existingProduct = await Product.findOne({
        productId,
        companyName,
        _id: { $ne: req.params.id }
      });
      if (existingProduct) {
        return ApiResponse.error(res, 'Product ID already exists', 400);
      }
    }

    if (name) product.name = name;
    if (productId) product.productId = productId;
    if (category) product.category = category;
    if (subCategory) product.subCategory = subCategory;
    if (description) product.description = description;
    if (image) product.image = image;

    await product.save();

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'product_updated',
      title: 'Product Updated',
      message: `${currentUser.fullname} updated product: ${product.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        productId: product._id,
        productCode: product.productId
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Product updated successfully', product);
  } catch (error) {
    console.error('Update product (database) error:', error);
    return ApiResponse.error(res, 'Error updating product', 500);
  }
};

/**
 * @desc    Delete product (company)
 * @route   DELETE /api/database/products/:id
 * @access  Private
 */
exports.deleteProduct = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const product = await Product.findOne({
      _id: req.params.id,
      companyName
    });

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    const productName = product.name;
    await product.deleteOne();

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'product_deleted',
      title: 'Product Deleted',
      message: `${currentUser.fullname} deleted product: ${productName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        productName
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Product deleted successfully');
  } catch (error) {
    console.error('Delete product (database) error:', error);
    return ApiResponse.error(res, 'Error deleting product', 500);
  }
};

/**
 * @desc    Get materials (company)
 * @route   GET /api/database/materials
 * @access  Private
 */
exports.getMaterials = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const { page = 1, limit = 50, search, category, status } = req.query;
    const query = { companyName };
    if (status) {
      query.status = status;
    }
    if (category) {
      query.category = category.toUpperCase();
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const data = await Material.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));
    const total = await Material.countDocuments(query);

    return ApiResponse.success(res, 'Materials fetched successfully', {
      data,
      pagination: buildPagination(page, limit, total)
    });
  } catch (error) {
    console.error('Get materials (database) error:', error);
    return ApiResponse.error(res, 'Error fetching materials', 500);
  }
};

/**
 * @desc    Update material (company)
 * @route   PUT /api/database/materials/:id
 * @access  Private
 */
exports.updateMaterial = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const material = await Material.findOne({
      _id: req.params.id,
      companyName
    });

    if (!material) {
      return ApiResponse.error(res, 'Material not found', 404);
    }

    const parseJsonArray = (value, fieldName) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new Error(`${fieldName} must be an array`);
          }
          return parsed;
        } catch (err) {
          throw new Error(`${fieldName} must be a valid JSON array`);
        }
      }
      throw new Error(`${fieldName} must be an array`);
    };

    const body = req.body || {};
    const update = {};

    if (body.name !== undefined) update.name = body.name;
    if (body.category !== undefined) update.category = String(body.category).toUpperCase();
    if (body.image !== undefined) update.image = body.image;
    if (body.standardWidth !== undefined) update.standardWidth = body.standardWidth;
    if (body.standardLength !== undefined) update.standardLength = body.standardLength;
    if (body.standardUnit !== undefined) update.standardUnit = body.standardUnit;
    if (body.pricePerSqm !== undefined) update.pricePerSqm = body.pricePerSqm;
    if (body.pricePerUnit !== undefined) update.pricePerUnit = body.pricePerUnit;
    if (body.pricingUnit !== undefined) update.pricingUnit = body.pricingUnit;
    if (body.wasteThreshold !== undefined) update.wasteThreshold = body.wasteThreshold;
    if (body.unit !== undefined) update.unit = body.unit;
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.isActive !== undefined) update.isActive = body.isActive;

    const types = parseJsonArray(body.types, 'types');
    if (types !== undefined) update.types = types;

    const sizeVariants = parseJsonArray(body.sizeVariants, 'sizeVariants');
    if (sizeVariants !== undefined) update.sizeVariants = sizeVariants;

    const foamVariants = parseJsonArray(body.foamVariants, 'foamVariants');
    if (foamVariants !== undefined) update.foamVariants = foamVariants;

    const commonThicknesses = parseJsonArray(body.commonThicknesses, 'commonThicknesses');
    if (commonThicknesses !== undefined) update.commonThicknesses = commonThicknesses;

    const updatedMaterial = await Material.findOneAndUpdate(
      { _id: req.params.id, companyName },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updatedMaterial) {
      return ApiResponse.error(res, 'Material not found', 404);
    }

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'material_updated',
      title: 'Material Updated',
      message: `${currentUser.fullname} updated material: ${updatedMaterial.name}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        materialId: updatedMaterial._id,
        materialName: updatedMaterial.name
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Material updated successfully', updatedMaterial);
  } catch (error) {
    console.error('Update material (database) error:', error);
    return ApiResponse.error(res, error.message || 'Error updating material', 500);
  }
};

/**
 * @desc    Delete material (company)
 * @route   DELETE /api/database/materials/:id
 * @access  Private
 */
exports.deleteMaterial = async (req, res) => {
  try {
    const companyName = getActiveCompanyOrError(req, res);
    if (!companyName) return;

    const material = await Material.findOne({
      _id: req.params.id,
      companyName
    });

    if (!material) {
      return ApiResponse.error(res, 'Material not found', 404);
    }

    const materialName = material.name;
    await material.deleteOne();

    const currentUser = await User.findById(req.user.id);
    await notifyCompany({
      companyName,
      type: 'material_deleted',
      title: 'Material Deleted',
      message: `${currentUser.fullname} deleted material: ${materialName}`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        materialName
      },
      excludeUserId: req.user.id
    });

    return ApiResponse.success(res, 'Material deleted successfully');
  } catch (error) {
    console.error('Delete material (database) error:', error);
    return ApiResponse.error(res, 'Error deleting material', 500);
  }
};
