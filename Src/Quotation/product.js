const Product = require('../../Models/productModel');
const ImageKit = require("imagekit");
const Material = require("../../Models/MaterialModel");
const { notifyCompany } = require('../../Utils/NotHelper');
const User = require("../../Models/user");


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

exports.createProduct = async (req, res) => {
  try {
    const { name, category, subCategory, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: "Please provide product name and category",
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

    // ✅ FIX: Use req.user._id consistently
    const product = await Product.create({
      userId: req.user._id,  // Changed from req.user.id
      companyName: req.companyName,
      name,
      productId,
      category,
      subCategory,
      description,
      image: uploadedImage,
    });

    // ✅ FIX: Use req.user._id here too
    const currentUser = await User.findById(req.user._id);

    // Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'product_created',
      title: 'New Product Created',
      message: `${currentUser.fullname} created a new product: ${name}`,
      performedBy: req.user._id,  // Changed from req.user.id
      performedByName: currentUser.fullname,
      metadata: {
        productId: product._id,
        productCode: productId,
        productName: name,
        category,
        subCategory
      },
      excludeUserId: req.user._id  // Changed from req.user.id
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
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
    const { category, subCategory, search, page = 1, limit = 20 } = req.query;

    // Filter by company
    const query = { companyName: req.companyName };

    if (category) {
      query.category = category;
    }

    if (subCategory) {
      query.subCategory = subCategory;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
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
      companyName: req.companyName // ✅ Filter by company
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
    const { category, isActive = true } = req.query;
    
    const filter = { 
      companyName: req.companyName, // ✅ Filter by company
      isActive 
    };
    
    if (category) {
      filter.category = category.toUpperCase();
    }
    
    const materials = await Material.find(filter).sort({ category: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      count: materials.length,
      data: materials
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
 * @desc    Create material
 * @route   POST /api/materials
 * @access  Private
 */
exports.createMaterial = async (req, res) => {
  try {
    const { 
      name,
      category,
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
      notes
    } = req.body;

    // Validation
    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: "Name and category are required"
      });
    }

    // For sheet materials, require dimensions and pricing
    if (['WOOD', 'BOARD', 'FOAM', 'MARBLE'].includes(category.toUpperCase())) {
      if (!standardWidth || !standardLength || !standardUnit) {
        return res.status(400).json({
          success: false,
          message: "Standard dimensions are required for sheet materials"
        });
      }
    }

    const material = new Material({
      name,
      companyName: req.companyName, // ✅ Add company name
      category: category.toUpperCase(),
      standardWidth,
      standardLength,
      standardUnit: standardUnit || 'inches',
      pricePerSqm,
      pricePerUnit,
      pricingUnit: pricingUnit || 'sqm',
      types: types || [],
      sizeVariants: sizeVariants || [],
      foamVariants: foamVariants || [],
      commonThicknesses: commonThicknesses || [], 
      wasteThreshold: wasteThreshold || 0.75,
      unit,
      notes
    });

    await material.save();

    // Get current user
    const currentUser = await User.findById(req.user.id);

    // ✅ Notify company members
    await notifyCompany({
      companyName: req.companyName,
      type: 'material_created',
      title: 'New Material Added',
      message: `${currentUser.fullname} added a new material: ${name} (${category})`,
      performedBy: req.user.id,
      performedByName: currentUser.fullname,
      metadata: {
        materialId: material._id,
        materialName: name,
        category
      },
      excludeUserId: req.user.id
    });

    res.status(201).json({
      success: true,
      data: material
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

    // Validation
    if (!requiredWidth || !requiredLength || !requiredUnit) {
      return res.status(400).json({
        success: false,
        message: "Required width, length, and unit are needed"
      });
    }

    if (requiredWidth <= 0 || requiredLength <= 0) {
      return res.status(400).json({
        success: false,
        message: "Width and length must be positive numbers"
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
    let pricePerSqm = material.pricePerSqm;

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

