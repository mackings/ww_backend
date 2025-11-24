const Product = require('../../Models/productModel');
const ImageKit = require("imagekit");
const Material = require("../../Models/MaterialModel");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});



exports.createProduct = async (req, res) => {
  try {
    const { name, category, subCategory, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: "Please provide product name and category",
      });
    }

    // ✅ Auto-generate product ID (e.g. PRD-ABC123)
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const productId = `PRD-${randomCode}`;

    // ✅ Ensure uniqueness
    const existing = await Product.findOne({ productId });
    if (existing) {
      // regenerate if collision (rare)
      productId = `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    let uploadedImage = null;

    // ✅ Upload image from Multer buffer if provided
    if (req.file) {
      const uploadResponse = await imagekit.upload({
        file: req.file.buffer.toString("base64"),
        fileName: `${Date.now()}_${name.replace(/\s+/g, "_")}.jpg`,
        folder: "/products",
      });
      uploadedImage = uploadResponse.url;
    }

    // ✅ Create product
    const product = await Product.create({
      userId: req.user.id,
      name,
      productId,
      category,
      subCategory,
      description,
      image: uploadedImage,
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


// @desc    Get all products
// @route   GET /api/products
// @access  Private


exports.getAllProducts = async (req, res) => {
  try {
    const { category, subCategory, search, page = 1, limit = 20 } = req.query;

    const query = { userId: req.user.id };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by subcategory
    if (subCategory) {
      query.subCategory = subCategory;
    }

    // Search by name or product ID
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



// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user.id
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

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user.id
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

    // Check if new product ID already exists
    if (productId && productId !== product.productId) {
      const existingProduct = await Product.findOne({ 
        productId, 
        userId: req.user.id,
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

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

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

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Private



exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { userId: req.user.id });

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
};



exports.getMaterials = async (req, res) => {
  try {
    const materials = await Material.find();
    res.status(200).json({
      success: true,
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





// 🟢 Create a new material
exports.createMaterial = async (req, res) => {
  try {
    const { 
      name, 
      unit, 
      standardWidth,
      standardLength,
      standardUnit,
      pricePerSqm,
      sizes, 
      foamDensities, 
      foamThicknesses,
      wasteThreshold
    } = req.body;

    // Validation
    if (!name || !unit || !standardWidth || !standardLength || !standardUnit || !pricePerSqm) {
      return res.status(400).json({
        success: false,
        message: "Name, unit, standard dimensions, standard unit, and price per sqm are required"
      });
    }

    const material = new Material({
      name,
      unit,
      standardWidth,
      standardLength,
      standardUnit,
      pricePerSqm,
      sizes: sizes || [],
      foamDensities: foamDensities || [],
      foamThicknesses: foamThicknesses || [],
      types: [],
      wasteThreshold: wasteThreshold || 0.75
    });

    await material.save();

    res.status(201).json({
      success: true,
      data: material
    });

  } catch (error) {
    console.error("Create material error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating material"
    });
  }
};




exports.calculateMaterialCost = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { requiredWidth, requiredLength, requiredUnit, materialType } = req.body;

    // Validation
    if (!requiredWidth || !requiredLength || !requiredUnit) {
      return res.status(400).json({
        success: false,
        message: "Required width, length, and unit are needed"
      });
    }

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

    // Helper function to convert to meters
    const convertToMeters = (value, unit) => {
      switch (unit.toLowerCase()) {
        case 'mm': return value / 1000;
        case 'cm': return value / 100;
        case 'm': return value;
        case 'ft': return value * 0.3048;
        case 'in': return value * 0.0254;
        default: return value;
      }
    };

    // Calculate project area
    const widthM = convertToMeters(requiredWidth, requiredUnit);
    const lengthM = convertToMeters(requiredLength, requiredUnit);
    const projectAreaSqm = widthM * lengthM;

    // Calculate standard material area
    const standardWidthM = convertToMeters(material.standardWidth, material.standardUnit);
    const standardLengthM = convertToMeters(material.standardLength, material.standardUnit);
    const standardAreaSqm = standardWidthM * standardLengthM;

    // Get price (check if specific type has custom price)
    let pricePerSqm = material.pricePerSqm;
    if (materialType && material.types.length > 0) {
      const typeData = material.types.find(t => t.name === materialType);
      if (typeData && typeData.pricePerSqm) {
        pricePerSqm = typeData.pricePerSqm;
      }
    }

    // Calculate minimum units needed
    const fullUnits = Math.floor(projectAreaSqm / standardAreaSqm);
    const remainder = projectAreaSqm - (fullUnits * standardAreaSqm);
    const thresholdArea = standardAreaSqm * material.wasteThreshold;
    const minimumUnits = remainder > thresholdArea ? fullUnits + 1 : fullUnits;

    // Calculate costs
    const totalBoardPrice = standardAreaSqm * pricePerSqm;
    const projectCost = projectAreaSqm * pricePerSqm;

    // Calculate waste info
    const totalAreaUsed = minimumUnits * standardAreaSqm;
    const wasteArea = totalAreaUsed - projectAreaSqm;
    const wastePercentage = totalAreaUsed > 0 ? (wasteArea / totalAreaUsed) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        material: {
          id: material._id,
          name: material.name,
          unit: material.unit,
          standardWidth: material.standardWidth,
          standardLength: material.standardLength,
          standardUnit: material.standardUnit,
        },
        dimensions: {
          requiredWidth,
          requiredLength,
          requiredUnit,
          projectAreaSqm: projectAreaSqm.toFixed(4),
          standardAreaSqm: standardAreaSqm.toFixed(4),
        },
        pricing: {
          pricePerSqm,
          totalBoardPrice: totalBoardPrice.toFixed(2),
          projectCost: projectCost.toFixed(2),
        },
        quantity: {
          minimumUnits,
          wasteThreshold: material.wasteThreshold,
        },
        waste: {
          totalAreaUsed: totalAreaUsed.toFixed(4),
          wasteArea: wasteArea.toFixed(4),
          wastePercentage: wastePercentage.toFixed(2),
        }
      }
    });

  } catch (error) {
    console.error("Calculate material cost error:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating material cost"
    });
  }
};



// 🟢 Update material specifications
exports.updateMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const updateData = req.body;

    const material = await Material.findByIdAndUpdate(
      materialId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

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




// 🟢 Add types to an existing material
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

    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

    // Add new types without duplicates
    // types can be array of strings or objects with name and pricePerSqm
    types.forEach(t => {
      const typeName = typeof t === 'string' ? t : t.name;
      const typePrice = typeof t === 'object' ? t.pricePerSqm : undefined;
      
      if (!material.types.some(mt => mt.name.toLowerCase() === typeName.toLowerCase())) {
        material.types.push({ 
          name: typeName,
          pricePerSqm: typePrice
        });
      }
    });

    await material.save();

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




// 🟢 Delete material


exports.deleteMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;

    const material = await Material.findByIdAndDelete(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found"
      });
    }

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
