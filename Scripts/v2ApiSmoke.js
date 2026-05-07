require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.V2_API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const RUN_ID = Date.now();
const RESULT_PATH = path.join(__dirname, '..', 'tmp', 'v2-smoke-result.json');

const state = {
  platformToken: null,
  ownerToken: null,
  ownerUser: null,
  companyName: `V2 Material Test Co ${RUN_ID}`,
  board: null,
  wood: null,
  nail: null,
  adhesive: null,
  paint: null,
  product: null,
  bom: null,
  quotation: null,
  invoice: null,
  order: null,
  receipt: null
};

const calls = [];

const redact = (value) => {
  if (!value || typeof value !== 'object') return value;
  const json = JSON.parse(JSON.stringify(value));
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    Object.keys(node).forEach((key) => {
      if (/token|password|authorization/i.test(key)) {
        node[key] = '<redacted>';
      } else {
        walk(node[key]);
      }
    });
  };
  walk(json);
  return json;
};

const request = async (label, method, path, { token, body, expected = [200, 201] } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const started = Date.now();
  let status = 0;
  let json = null;
  let error = null;

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    status = response.status;
    const text = await response.text();
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    error = err.message;
  }

  const ok = !error && expected.includes(status);
  calls.push({
    label,
    method,
    path,
    status,
    ok,
    durationMs: Date.now() - started,
    request: redact(body),
    response: redact(json),
    error
  });

  if (!ok) {
    throw new Error(`${label} failed (${method} ${path}) status=${status} error=${error || JSON.stringify(json)}`);
  }

  return json;
};

const requestMultipart = async (label, method, path, { token, form, expected = [200, 201] } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const started = Date.now();
  let status = 0;
  let json = null;
  let error = null;

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: form
    });
    status = response.status;
    const text = await response.text();
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    error = err.message;
  }

  const ok = !error && expected.includes(status);
  calls.push({
    label,
    method,
    path,
    status,
    ok,
    durationMs: Date.now() - started,
    request: '<multipart/form-data>',
    response: redact(json),
    error
  });

  if (!ok) {
    throw new Error(`${label} failed (${method} ${path}) status=${status} error=${error || JSON.stringify(json)}`);
  }

  return json;
};

const dataOf = (response) => response?.data;

const pickMaterial = (materials, predicate, label) => {
  const material = materials.find(predicate);
  if (!material) throw new Error(`Could not find material for ${label}`);
  return material;
};

const main = async () => {
  await request('Health check', 'GET', '/health', { expected: [200] });

  const platformSignin = await request('Platform signin', 'POST', '/api/auth/signin', {
    body: { email: 'admin@woodworker.com', password: 'Admin@2024' }
  });
  state.platformToken = dataOf(platformSignin).token;

  await request('Platform dashboard stats', 'GET', '/api/platform/dashboard/stats', {
    token: state.platformToken
  });

  await request('Reseed materials from material DB catalog', 'POST', '/api/platform/materials/reseed-from-catalog', {
    token: state.platformToken,
    body: { confirm: true }
  });

  await request('Supported material summary', 'GET', '/api/product/materials/supported/summary', {
    token: state.platformToken
  });

  const signup = await request('Owner signup with company', 'POST', '/api/auth/signup', {
    body: {
      fullname: 'V2 Material Owner',
      email: `v2.owner.${RUN_ID}@example.com`,
      phoneNumber: `+23480${String(RUN_ID).slice(-8)}`,
      password: 'Password123!',
      companyName: state.companyName,
      companyEmail: `company.${RUN_ID}@example.com`
    }
  });
  state.ownerToken = dataOf(signup).token;
  state.ownerUser = dataOf(signup).user;

  await request('Owner me', 'GET', '/api/auth/me', { token: state.ownerToken });
  await request('Owner companies embedded', 'GET', '/api/auth/companies', { token: state.ownerToken });
  await request('Switch active company', 'POST', '/api/auth/switch-company', {
    token: state.ownerToken,
    body: { companyIndex: 0 }
  });

  await request('Get settings', 'GET', '/api/settings', { token: state.ownerToken });
  await request('Update settings', 'PUT', '/api/settings', {
    token: state.ownerToken,
    body: {
      cloudSyncEnabled: true,
      autoBackupEnabled: true,
      notifications: {
        emailNotification: false,
        quotationReminders: true,
        projectDeadlines: true
      }
    }
  });

  const materialsResponse = await request('Get approved materials', 'GET', '/api/product/materials?limit=500', {
    token: state.ownerToken
  });
  const materials = dataOf(materialsResponse) || [];
  state.board = pickMaterial(materials, (m) => m.category === 'Board' && m.isPriced && m.standardWidth, 'priced board');
  state.wood = pickMaterial(materials, (m) => m.category === 'Wood' && m.isPriced && m.standardWidth, 'priced wood');
  state.nail = pickMaterial(materials, (m) => m.category === 'Nail' && !m.isPriced, 'unpriced nail');
  state.adhesive = pickMaterial(materials, (m) => m.category === 'Adhensive' && m.isPriced, 'priced adhesive');
  state.paint = pickMaterial(materials, (m) => m.category === 'Paint' && !m.isPriced, 'unpriced paint');

  await request('Get grouped materials', 'GET', '/api/product/materials/grouped?limit=500', {
    token: state.ownerToken
  });
  await request('Get supported materials', 'GET', '/api/product/materials/supported?category=Wood&limit=20', {
    token: state.ownerToken
  });

  const uploadForm = new FormData();
  uploadForm.append('name', `V2 Uploaded Spray ${RUN_ID}`);
  uploadForm.append('category', 'Paint');
  uploadForm.append('subCategory', 'Spray paint');
  uploadForm.append('unit', 'Piece');
  uploadForm.append('pricePerUnit', '2100');
  uploadForm.append('pricingUnit', 'piece');
  uploadForm.append('useCatalog', 'false');
  uploadForm.append('notes', 'Created by v2 upload smoke test');
  uploadForm.append('image', new Blob([Buffer.from('v2-upload-smoke')], { type: 'image/jpeg' }), 'v2-material.jpg');
  const uploadedMaterialResponse = await requestMultipart('Upload/create company material with image', 'POST', '/api/product/creatematerial', {
    token: state.ownerToken,
    form: uploadForm
  });
  const uploadedMaterial = dataOf(uploadedMaterialResponse);

  await request('Reject custom wood material without thickness', 'POST', '/api/product/creatematerial', {
    token: state.ownerToken,
    expected: [400],
    body: {
      name: `V2 Invalid Wood ${RUN_ID}`,
      category: 'Wood',
      subCategory: 'Iroko',
      unit: 'Piece',
      pricePerUnit: 12000,
      pricingUnit: 'piece',
      useCatalog: false,
      notes: 'Created to verify Wood thickness validation'
    }
  });

  const customWoodResponse = await request('Create custom wood material with thickness', 'POST', '/api/product/creatematerial', {
    token: state.ownerToken,
    body: {
      name: `V2 Custom Wood ${RUN_ID}`,
      category: 'Wood',
      subCategory: 'Iroko',
      unit: 'Piece',
      thickness: 0.25,
      thicknessUnit: 'inches',
      standardWidth: 10,
      standardLength: 144,
      standardUnit: 'inches',
      pricePerUnit: 12000,
      pricingUnit: 'piece',
      useCatalog: false,
      notes: 'Created to verify Wood thickness upload'
    }
  });
  const customWoodMaterial = dataOf(customWoodResponse);

  const customBoardResponse = await request('Create custom board material with thickness', 'POST', '/api/product/creatematerial', {
    token: state.ownerToken,
    body: {
      name: `V2 Custom Board ${RUN_ID}`,
      category: 'Board',
      subCategory: 'Foreign Plywood',
      unit: 'Piece',
      thickness: 0.75,
      thicknessUnit: 'inches',
      standardWidth: 48,
      standardLength: 96,
      standardUnit: 'inches',
      pricePerUnit: 10000,
      pricingUnit: 'piece',
      useCatalog: false,
      notes: 'Created to verify Board thickness upload'
    }
  });
  const customBoardMaterial = dataOf(customBoardResponse);

  const approvalMaterialResponse = await request('Create company material for approval', 'POST', '/api/product/creatematerial', {
    token: state.ownerToken,
    body: {
      name: `V2 Approval Material ${RUN_ID}`,
      category: 'Paint',
      subCategory: 'Primer',
      unit: 'Piece',
      pricePerUnit: 1800,
      pricingUnit: 'piece',
      useCatalog: false,
      notes: 'Created for platform approval smoke test'
    }
  });
  const approvalMaterial = dataOf(approvalMaterialResponse);

  const rejectMaterialResponse = await request('Create company material for rejection', 'POST', '/api/product/creatematerial', {
    token: state.ownerToken,
    body: {
      name: `V2 Reject Material ${RUN_ID}`,
      category: 'Paint',
      subCategory: 'Hardner',
      unit: 'Piece',
      pricePerUnit: 900,
      pricingUnit: 'piece',
      useCatalog: false,
      notes: 'Created for platform rejection smoke test'
    }
  });
  const rejectMaterial = dataOf(rejectMaterialResponse);

  const mutableMaterialResponse = await request('Create company material for pricing/update/delete', 'POST', '/api/product/creatematerial', {
    token: state.ownerToken,
    body: {
      name: `V2 Mutable Material ${RUN_ID}`,
      category: 'Paint',
      subCategory: 'Auto base',
      unit: 'Piece',
      pricePerUnit: 1000,
      pricingUnit: 'piece',
      useCatalog: false,
      notes: 'Created for material mutation smoke test'
    }
  });
  const mutableMaterial = dataOf(mutableMaterialResponse);

  await request('Add material types', 'POST', `/api/product/${mutableMaterial._id}/add-types`, {
    token: state.ownerToken,
    body: {
      types: [
        { name: 'Gloss finish', pricePerUnit: 1200, pricePerSqm: 3500, standardWidth: 1, standardLength: 1, dimensionUnit: 'm' }
      ]
    }
  });

  await request('Platform update company material price', 'PATCH', `/api/platform/materials/${mutableMaterial._id}/price`, {
    token: state.platformToken,
    body: {
      pricePerUnit: 1250,
      catalogPrice: 1250,
      pricingUnit: 'piece'
    }
  });

  await request('Database update material type pricing', 'PUT', '/api/database/materials/pricing/type', {
    token: state.ownerToken,
    body: {
      category: 'Paint',
      subCategory: 'Auto base',
      unit: 'Piece',
      pricePerUnit: 1300,
      pricingUnit: 'piece',
      onlyUnpriced: false
    }
  });

  await request('Database update single material', 'PUT', `/api/database/materials/${mutableMaterial._id}`, {
    token: state.ownerToken,
    body: {
      notes: 'Updated by database material smoke test',
      pricePerUnit: 1400,
      pricingUnit: 'piece',
      isActive: true
    }
  });

  await request('Platform approve pending material', 'PATCH', `/api/platform/materials/${approvalMaterial._id}/approve`, {
    token: state.platformToken,
    body: { notes: 'Approved by v2 smoke test' }
  });

  await request('Platform reject pending material', 'PATCH', `/api/platform/materials/${rejectMaterial._id}/reject`, {
    token: state.platformToken,
    body: { reason: 'Rejected by v2 smoke test' }
  });

  await request('Database delete test material', 'DELETE', `/api/database/materials/${mutableMaterial._id}`, {
    token: state.ownerToken
  });

  await request('Database delete uploaded material', 'DELETE', `/api/database/materials/${uploadedMaterial._id}`, {
    token: state.ownerToken
  });

  await request('Database delete custom wood material', 'DELETE', `/api/database/materials/${customWoodMaterial._id}`, {
    token: state.ownerToken
  });

  await request('Database delete custom board material', 'DELETE', `/api/database/materials/${customBoardMaterial._id}`, {
    token: state.ownerToken
  });

  const woodCost = await request('Calculate priced wood area cost', 'POST', `/api/product/material/${state.wood._id}/calculate-cost`, {
    token: state.ownerToken,
    body: { requiredWidth: 20, requiredLength: 48, requiredUnit: 'inches', quantity: 1 }
  });
  const nailCost = await request('Calculate unpriced nail quantity cost', 'POST', `/api/product/material/${state.nail._id}/calculate-cost`, {
    token: state.ownerToken,
    body: { quantity: 1 }
  });
  const gumCost = await request('Calculate priced gum quantity cost', 'POST', `/api/product/material/${state.adhesive._id}/calculate-cost`, {
    token: state.ownerToken,
    body: { quantity: 1 }
  });
  const paintCost = await request('Calculate unpriced paint quantity cost', 'POST', `/api/product/material/${state.paint._id}/calculate-cost`, {
    token: state.ownerToken,
    body: { quantity: 2 }
  });

  const productResponse = await request('Create product', 'POST', '/api/product', {
    token: state.ownerToken,
    body: {
      name: `Sitting Chair ${RUN_ID}`,
      category: 'Furniture',
      subCategory: 'Chair',
      description: 'V2 smoke test chair'
    }
  });
  state.product = dataOf(productResponse);

  await request('Get products', 'GET', '/api/product', { token: state.ownerToken });
  await request('Get product by id', 'GET', `/api/product/${state.product._id}`, { token: state.ownerToken });

  const materialRows = [
    {
      material: state.wood,
      cost: dataOf(woodCost),
      manualUnitPrice: null,
      description: 'Chair frame wood'
    },
    {
      material: state.nail,
      cost: dataOf(nailCost),
      manualUnitPrice: 2500,
      description: 'Nails manually priced because DB has no price'
    },
    {
      material: state.adhesive,
      cost: dataOf(gumCost),
      manualUnitPrice: null,
      description: 'Gum'
    },
    {
      material: state.paint,
      cost: dataOf(paintCost),
      manualUnitPrice: 1800,
      description: 'Spray paint manually priced because DB has no price'
    }
  ].map(({ material, cost, manualUnitPrice, description }) => {
    const pricing = cost.pricing || {};
    const calculation = cost.calculation || {};
    const unitPrice = manualUnitPrice ?? Number(pricing.pricePerFullUnit || pricing.pricePerUnit || 0);
    const quantity = calculation.billableUnits || calculation.quantity || 1;
    const subtotal = manualUnitPrice ? unitPrice * quantity : Number(pricing.totalMaterialCost || 0);
    return {
      materialId: material._id,
      name: material.name,
      category: material.category,
      subCategory: material.subCategory,
      unit: material.unit || material.pricingUnit || 'Piece',
      quantity,
      price: unitPrice,
      squareMeter: Number(cost.project?.projectAreaSqm || 0),
      description,
      calculation: {
        mode: calculation.mode || 'unit_based',
        minimumUnits: calculation.minimumUnits,
        billableUnits: quantity,
        pricePerSqm: pricing.pricePerSqm ? Number(pricing.pricePerSqm) : undefined,
        pricePerFullUnit: pricing.pricePerFullUnit ? Number(pricing.pricePerFullUnit) : undefined,
        totalMaterialCost: subtotal
      }
    };
  });

  const materialCost = materialRows.reduce((sum, row) => sum + row.calculation.totalMaterialCost, 0);
  const workmanship = 15000;
  const costPrice = materialCost + workmanship;
  const sellingPrice = Math.round(costPrice * 1.3);

  const bomResponse = await request('Create BOM', 'POST', '/api/bom', {
    token: state.ownerToken,
    body: {
      name: `Sitting Chair BOM ${RUN_ID}`,
      description: 'Wood, nail, gum and spray based on material DB',
      product: {
        productId: state.product.productId,
        name: state.product.name,
        description: state.product.description
      },
      materials: materialRows,
      additionalCosts: [{ name: 'Workmanship', amount: workmanship }],
      pricing: {
        markupPercentage: 30,
        materialsTotal: materialCost,
        additionalTotal: workmanship,
        costPrice,
        sellingPrice
      }
    }
  });
  state.bom = dataOf(bomResponse);

  await request('Get BOMs', 'GET', '/api/bom', { token: state.ownerToken });
  await request('Get BOM by id', 'GET', `/api/bom/${state.bom._id}`, { token: state.ownerToken });

  const quotationResponse = await request('Create quotation', 'POST', '/api/quotation', {
    token: state.ownerToken,
    body: {
      clientName: 'V2 Customer',
      phoneNumber: '+2348011111111',
      description: 'Quotation for sitting chair',
      items: [{
        woodType: state.wood.name,
        width: 20,
        length: 48,
        unit: 'inch',
        squareMeter: Number(dataOf(woodCost).project.projectAreaSqm),
        quantity: 1,
        costPrice,
        sellingPrice,
        description: 'Sitting chair complete material/workmanship package'
      }],
      costPrice,
      overheadCost: 0,
      discount: 0,
      boms: [{
        name: `Sitting Chair Quote BOM ${RUN_ID}`,
        materials: materialRows,
        additionalCosts: [{ name: 'Workmanship', amount: workmanship }],
        pricing: {
          markupPercentage: 30,
          materialsTotal: materialCost,
          additionalTotal: workmanship,
          costPrice,
          sellingPrice
        }
      }]
    }
  });
  state.quotation = dataOf(quotationResponse);

  await request('Get quotations', 'GET', '/api/quotation', { token: state.ownerToken });
  await request('Get quotation by id', 'GET', `/api/quotation/${state.quotation._id}`, { token: state.ownerToken });

  const invoiceResponse = await request('Create invoice from quotation', 'POST', '/api/invoices/create', {
    token: state.ownerToken,
    body: { quotationId: state.quotation._id, amountPaid: 0, notes: 'V2 invoice smoke test' }
  });
  state.invoice = dataOf(invoiceResponse);
  await request('Get invoices', 'GET', '/api/invoices/invoices', { token: state.ownerToken });
  await request('Get invoice stats', 'GET', '/api/invoices/invoices/stats', { token: state.ownerToken });

  const orderResponse = await request('Create order from quotation', 'POST', '/api/orders/create', {
    token: state.ownerToken,
    body: { quotationId: state.quotation._id, amountPaid: 10000, notes: 'V2 order smoke test' }
  });
  state.order = dataOf(orderResponse);
  await request('Get orders', 'GET', '/api/orders/get-orders', { token: state.ownerToken });
  await request('Get order stats', 'GET', '/api/orders/stats', { token: state.ownerToken });
  await request('Get order by id', 'GET', `/api/orders/get-orders/${state.order._id}`, { token: state.ownerToken });
  await request('Get order receipt', 'GET', `/api/orders/get-orders/${state.order._id}/receipt`, { token: state.ownerToken });

  await request('Get sales clients', 'GET', '/api/sales/get-clients', { token: state.ownerToken });
  await request('Get sales analytics', 'GET', '/api/sales/get-sales', { token: state.ownerToken });
  await request('Get inventory status', 'GET', '/api/sales/get-inventory', { token: state.ownerToken });

  await request('Create overhead cost', 'POST', '/api/oc/create-oc', {
    token: state.ownerToken,
    body: { category: 'Others', description: 'V2 smoke overhead', period: 'Daily', cost: 1000 }
  });
  await request('Get overhead costs', 'GET', '/api/oc/get-oc', { token: state.ownerToken });

  await request('Get notifications', 'GET', '/api/notifications', { token: state.ownerToken });
  await request('Get notification unread count', 'GET', '/api/notifications/unread-count', { token: state.ownerToken });

  await request('Database quotations', 'GET', '/api/database/quotations', { token: state.ownerToken });
  await request('Database BOMs', 'GET', '/api/database/boms', { token: state.ownerToken });
  await request('Database clients', 'GET', '/api/database/clients', { token: state.ownerToken });
  await request('Database staff', 'GET', '/api/database/staff', { token: state.ownerToken });
  await request('Database products', 'GET', '/api/database/products', { token: state.ownerToken });
  await request('Database materials', 'GET', '/api/database/materials', { token: state.ownerToken });
  await request('Database invoices', 'GET', '/api/database/invoices', { token: state.ownerToken });
  await request('Database receipts', 'GET', '/api/database/receipts', { token: state.ownerToken });

  await request('Platform overview', 'GET', '/api/platform/stats/overview', {
    token: state.platformToken
  });
  await request('Platform companies', 'GET', '/api/platform/companies?limit=5', {
    token: state.platformToken
  });
  await request('Platform products all', 'GET', '/api/platform/products/all?limit=5', {
    token: state.platformToken
  });
  await request('Platform materials pending', 'GET', '/api/platform/materials/pending?limit=5', {
    token: state.platformToken
  });

  const result = {
    baseUrl: BASE_URL,
    runId: RUN_ID,
    passed: calls.filter((call) => call.ok).length,
    failed: calls.filter((call) => !call.ok).length,
    calls
  };
  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    baseUrl: result.baseUrl,
    runId: result.runId,
    passed: result.passed,
    failed: result.failed,
    resultPath: RESULT_PATH
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  const result = {
    baseUrl: BASE_URL,
    runId: RUN_ID,
    passed: calls.filter((call) => call.ok).length,
    failed: calls.filter((call) => !call.ok).length,
    calls
  };
  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    baseUrl: result.baseUrl,
    runId: result.runId,
    passed: result.passed,
    failed: result.failed,
    resultPath: RESULT_PATH
  }, null, 2));
  process.exit(1);
});
