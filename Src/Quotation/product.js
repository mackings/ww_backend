const Product = require('../../Models/productModel');
const ImageKit = require("imagekit");
const Material = require("../../Models/MaterialModel");

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
    const { category, isActive = true } = req.query;
    
    const filter = { isActive };
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

// exports.getMaterials = async (req, res) => {
//   try {
//     const materials = await Material.find();
//     res.status(200).json({
//       success: true,
//       data: materials
//     });
//   } catch (error) {
//     console.error("Get materials error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching materials"
//     });
//   }
// };





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
      commonThicknesses, // Add this
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



// 🟢 Create a new material
// exports.createMaterial = async (req, res) => {
//   try {
//     const { 
//       name, 
//       unit, 
//       standardWidth,
//       standardLength,
//       standardUnit,
//       pricePerSqm,
//       sizes, 
//       foamDensities, 
//       foamThicknesses,
//       wasteThreshold
//     } = req.body;

//     // Validation
//     if (!name || !unit || !standardWidth || !standardLength || !standardUnit || !pricePerSqm) {
//       return res.status(400).json({
//         success: false,
//         message: "Name, unit, standard dimensions, standard unit, and price per sqm are required"
//       });
//     }

//     const material = new Material({
//       name,
//       unit,
//       standardWidth,
//       standardLength,
//       standardUnit,
//       pricePerSqm,
//       sizes: sizes || [],
//       foamDensities: foamDensities || [],
//       foamThicknesses: foamThicknesses || [],
//       types: [],
//       wasteThreshold: wasteThreshold || 0.75
//     });

//     await material.save();

//     res.status(201).json({
//       success: true,
//       data: material
//     });

//   } catch (error) {
//     console.error("Create material error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error creating material"
//     });
//   }
// };





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
      quantity = 1 // For piece-based items
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

    const material = await Material.findById(materialId);
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

    // Check for size variant (e.g., Full Sheet, Half Sheet)
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

    // Calculate standard sheet area in square meters
    const standardAreaSqm = calculateSquareMeters(
      standardWidth,
      standardLength,
      standardUnit
    );

    // ===== EXCEL-STYLE CALCULATION =====
    // This matches the Excel waste threshold logic:
    // 1. First calculate minimum sheets needed (round up)
    // 2. Check if the remainder on the last sheet exceeds waste threshold
    // 3. If yes, add one more sheet to minimize waste
    
    let minimumUnits = Math.ceil(projectAreaSqm / standardAreaSqm);
    
    // Calculate the actual remainder from the last sheet
    const rawRemainder = projectAreaSqm % standardAreaSqm;
    
    // Calculate waste threshold area (75% of standard sheet by default)
    const wasteThresholdArea = standardAreaSqm * material.wasteThreshold;
    
    // If there's a remainder AND it exceeds the threshold, we need an extra sheet
    // This prevents excessive waste on the last sheet
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




// exports.calculateMaterialCost = async (req, res) => {
//   try {
//     const { materialId } = req.params;
//     const { requiredWidth, requiredLength, requiredUnit, materialType } = req.body;

//     if (!requiredWidth || !requiredLength || !requiredUnit) {
//       return res.status(400).json({
//         success: false,
//         message: "Required width, length, and unit are needed"
//       });
//     }

//     const material = await Material.findById(materialId);
//     if (!material) {
//       return res.status(404).json({
//         success: false,
//         message: "Material not found"
//       });
//     }

//     /* ✅ Unit conversion */
//     const convertToMeters = (value, unit) => {
//       switch (unit.toLowerCase()) {
//         case 'mm': return value / 1000;
//         case 'cm': return value / 100;
//         case 'm': return value;
//         case 'ft': return value * 0.3048;
//         case 'in': return value * 0.0254;
//         default: return value;
//       }
//     };

//     const widthM = convertToMeters(requiredWidth, requiredUnit);
//     const lengthM = convertToMeters(requiredLength, requiredUnit);
//     const projectAreaSqm = widthM * lengthM;

//     const standardWidthM = convertToMeters(material.standardWidth, material.standardUnit);
//     const standardLengthM = convertToMeters(material.standardLength, material.standardUnit);
//     const standardAreaSqm = standardWidthM * standardLengthM;

//     /* ✅ Price override per type */
//     let pricePerSqm = material.pricePerSqm;
//     if (materialType && material.types?.length) {
//       const typeData = material.types.find(t => t.name === materialType);
//       if (typeData?.pricePerSqm) pricePerSqm = typeData.pricePerSqm;
//     }

//     /* ✅ ✅ EXCEL-CORRECT UNIT COUNT */
//     let minimumUnits = Math.ceil(projectAreaSqm / standardAreaSqm);

//     /* ✅ Apply waste threshold logic */
//     const extraWasteLimit = standardAreaSqm * material.wasteThreshold;
//     const rawRemainder = projectAreaSqm % standardAreaSqm;

//     if (rawRemainder > extraWasteLimit) {
//       minimumUnits += 1;
//     }

//     /* ✅ ✅ EXCEL-CORRECT PRICING */
//     const pricePerFullUnit = standardAreaSqm * pricePerSqm;
//     const totalMaterialCost = minimumUnits * pricePerFullUnit;

//     /* ✅ Waste */
//     const totalAreaUsed = minimumUnits * standardAreaSqm;
//     const wasteArea = totalAreaUsed - projectAreaSqm;
//     const wastePercentage = (wasteArea / totalAreaUsed) * 100;

//     return res.status(200).json({
//       success: true,
//       data: {
//         material: {
//           id: material._id,
//           name: material.name,
//           unit: material.unit
//         },
//         dimensions: {
//           requiredWidth,
//           requiredLength,
//           requiredUnit,
//           projectAreaSqm: projectAreaSqm.toFixed(4),
//           standardAreaSqm: standardAreaSqm.toFixed(4)
//         },
//         pricing: {
//           pricePerSqm,
//           pricePerFullUnit: pricePerFullUnit.toFixed(2),
//           totalMaterialCost: totalMaterialCost.toFixed(2)
//         },
//         quantity: {
//           minimumUnits,
//           wasteThreshold: material.wasteThreshold
//         },
//         waste: {
//           totalAreaUsed: totalAreaUsed.toFixed(4),
//           wasteArea: wasteArea.toFixed(4),
//           wastePercentage: wastePercentage.toFixed(2)
//         }
//       }
//     });

//   } catch (error) {
//     console.error("Calculate material cost error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error calculating material cost"
//     });
//   }
// };




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


// 🟢 Add types to an existing material
// exports.addMaterialTypes = async (req, res) => {
//   try {
//     const { materialId } = req.params;
//     const { types } = req.body;

//     if (!types || !Array.isArray(types)) {
//       return res.status(400).json({
//         success: false,
//         message: "Types must be an array"
//       });
//     }

//     const material = await Material.findById(materialId);
//     if (!material) {
//       return res.status(404).json({
//         success: false,
//         message: "Material not found"
//       });
//     }

//     // Add new types without duplicates
//     // types can be array of strings or objects with name and pricePerSqm
//     types.forEach(t => {
//       const typeName = typeof t === 'string' ? t : t.name;
//       const typePrice = typeof t === 'object' ? t.pricePerSqm : undefined;
      
//       if (!material.types.some(mt => mt.name.toLowerCase() === typeName.toLowerCase())) {
//         material.types.push({ 
//           name: typeName,
//           pricePerSqm: typePrice
//         });
//       }
//     });

//     await material.save();

//     res.status(200).json({
//       success: true,
//       data: material
//     });

//   } catch (error) {
//     console.error("Add material types error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error adding material types"
//     });
//   }
// };




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
