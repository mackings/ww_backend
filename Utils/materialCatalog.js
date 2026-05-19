const fs = require('fs');
const path = require('path');

const MATERIALS_CATALOG_PATH = path.join(__dirname, '..', 'materials_all.csv');

const BOARD_STOCK_DIMENSIONS = Object.freeze({
  width: 48,
  length: 96,
  unit: 'inches'
});

let cache = {
  mtimeMs: null,
  rows: []
};

const normalize = (value) => String(value || '').trim();

const normalizeLookup = (value) => normalize(value).toLowerCase();

const normalizeComparable = (value) => normalizeLookup(value).replace(/[^a-z0-9]/g, '');

const parseFraction = (value) => {
  const text = normalize(value);
  if (!text) return null;
  const parts = text.split('/');
  if (parts.length !== 2) return null;
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
};

const parseNumberish = (value) => {
  const text = normalize(value);
  if (!text) return null;
  const fraction = parseFraction(text);
  if (fraction !== null) return fraction;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const toNumber = (value) => {
  const text = normalize(value).replace(/,/g, '');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const convertToMeters = (value, unit) => {
  const normalized = normalizeLookup(unit);
  const conversions = {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    inch: 0.0254,
    inches: 0.0254,
    in: 0.0254,
    ft: 0.3048
  };
  const factor = conversions[normalized];
  if (!factor) return null;
  const numeric = toNumber(value);
  return numeric === null ? null : numeric * factor;
};

const calculateSquareMeters = (width, length, unit) => {
  const widthM = convertToMeters(width, unit);
  const lengthM = convertToMeters(length, unit);
  if (widthM === null || lengthM === null) return null;
  return widthM * lengthM;
};

const deriveThickness = ({ category, size }) => {
  const cat = normalizeLookup(category);
  const rawSize = normalize(size);
  if (!rawSize) return { thickness: null, thicknessUnit: 'inches' };

  // Board thickness examples: 0.25", 5/8", 1"
  if (cat === 'board') {
    const match = rawSize.match(/^\s*([0-9.]+|[0-9]+\/[0-9]+)\s*(\"|in|inch|inches)?\s*$/i);
    if (!match) return { thickness: null, thicknessUnit: 'inches' };
    const thickness = parseNumberish(match[1]);
    return { thickness, thicknessUnit: 'inches' };
  }

  // Wood sizes often start with thickness: 1"x10"x144"
  if (cat === 'wood') {
    const match = rawSize.match(/^\s*([0-9.]+|[0-9]+\/[0-9]+)\s*\"?\s*x/i);
    if (!match) return { thickness: null, thicknessUnit: 'inches' };
    const thickness = parseNumberish(match[1]);
    return { thickness, thicknessUnit: 'inches' };
  }

  return { thickness: null, thicknessUnit: 'inches' };
};

const parseMaterialSize = (size = '') => {
  const raw = normalize(size);
  if (!raw) {
    return {
      pattern: 'empty',
      thickness: null,
      width: null,
      length: null,
      unit: null
    };
  }

  const numberToken = '([0-9]+(?:\\.[0-9]+)?|[0-9]+\\/[0-9]+)';
  const tripleRegex = new RegExp(`^\\s*${numberToken}\\s*"?\\s*x\\s*${numberToken}\\s*"?\\s*x\\s*${numberToken}\\s*"?\\s*$`, 'i');
  const doubleRegex = new RegExp(`^\\s*${numberToken}\\s*"?\\s*x\\s*${numberToken}\\s*"?\\s*$`, 'i');
  const singleRegex = new RegExp(`^\\s*${numberToken}\\s*("|in|inch|inches|ft|mm|cm|m)?\\s*$`, 'i');

  const triple = raw.match(tripleRegex);
  if (triple) {
    return {
      pattern: 'triple',
      thickness: parseNumberish(triple[1]),
      width: parseNumberish(triple[2]),
      length: parseNumberish(triple[3]),
      unit: 'inches'
    };
  }

  const double = raw.match(doubleRegex);
  if (double) {
    return {
      pattern: 'double',
      thickness: null,
      width: parseNumberish(double[1]),
      length: parseNumberish(double[2]),
      unit: 'inches'
    };
  }

  const single = raw.match(singleRegex);
  if (single) {
    return {
      pattern: 'single',
      thickness: parseNumberish(single[1]),
      width: null,
      length: null,
      unit: single[2] ? normalize(single[2]).replace(/^"$/, 'inches') : 'inches'
    };
  }

  return {
    pattern: 'descriptor',
    thickness: null,
    width: null,
    length: null,
    unit: null
  };
};

const normalizePricingUnit = (unit = '') => {
  const normalized = normalizeLookup(unit);
  if (!normalized) return 'piece';
  if (normalized.includes('square meter') || normalized === 'sqm') return 'sqm';
  if (normalized.includes('yard')) return 'yard';
  if (normalized.includes('yard') || normalized.includes('meter')) return 'meter';
  if (normalized.includes('pound')) return 'pound';
  if (normalized.includes('bag')) return 'bag';
  if (normalized.includes('liter') || normalized.includes('ltr')) return 'liter';
  if (normalized.includes('pair')) return 'pair';
  if (normalized.includes('pack')) return 'pack';
  if (normalized.includes('set')) return 'set';
  if (normalized.includes('roll')) return 'roll';
  if (normalized.includes('bucket')) return 'bucket';
  return 'piece';
};

const deriveStockDimensions = ({ category, size, unit }) => {
  const cat = normalizeLookup(category);
  const parsedSize = parseMaterialSize(size);

  if (cat === 'board' || cat === 'cushion') {
    return {
      ...BOARD_STOCK_DIMENSIONS,
      source: 'material_database_default_sheet_48x96'
    };
  }

  if (parsedSize.width !== null && parsedSize.length !== null && parsedSize.unit) {
    return {
      width: parsedSize.width,
      length: parsedSize.length,
      unit: parsedSize.unit,
      source: 'material_database_size'
    };
  }

  if (normalizePricingUnit(unit) === 'sqm') {
    return {
      width: 1,
      length: 1,
      unit: 'm',
      source: 'square_meter_unit'
    };
  }

  return null;
};

const parseCsvLine = (line) => {
  const columns = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      columns.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  columns.push(current);
  return columns.map((item) => normalize(item));
};

const loadCatalog = () => {
  const stat = fs.statSync(MATERIALS_CATALOG_PATH);
  if (cache.mtimeMs === stat.mtimeMs && cache.rows.length > 0) {
    return cache.rows;
  }

  const file = fs.readFileSync(MATERIALS_CATALOG_PATH, 'utf8');
  const lines = file.split(/\r?\n/).filter((line) => normalize(line));
  if (lines.length <= 1) {
    cache = { mtimeMs: stat.mtimeMs, rows: [] };
    return cache.rows;
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const raw = {};
    headers.forEach((header, columnIndex) => {
      raw[header] = normalize(values[columnIndex]);
    });

    const material = normalize(raw.material);
    const category = normalize(raw.category);
    const subCategory = normalize(raw.subcategory);
    const size = normalize(raw.size);
    const unit = normalize(raw.unit);
    const color = normalize(raw.color);
    const priceRaw = normalize(raw.price_raw);
    const priceNumeric = toNumber(raw.price_numeric || priceRaw);
    const thicknessInfo = deriveThickness({ category, size });
    const parsedSize = parseMaterialSize(size);
    const stockDimensions = deriveStockDimensions({ category, size, unit });
    const stockAreaSqm = stockDimensions
      ? calculateSquareMeters(stockDimensions.width, stockDimensions.length, stockDimensions.unit)
      : null;
    const pricingUnit = normalizePricingUnit(unit);
    const pricePerSqm = priceNumeric !== null && stockAreaSqm
      ? Number((priceNumeric / stockAreaSqm).toFixed(2))
      : (pricingUnit === 'sqm' ? priceNumeric : null);

    const key = [
      normalizeLookup(material),
      normalizeLookup(category),
      normalizeLookup(subCategory),
      normalizeLookup(size),
      normalizeLookup(unit),
      normalizeLookup(color)
    ].join('|');

    return {
      id: rowIndex + 1,
      key,
      material,
      category,
      subCategory,
      size,
      unit,
      color,
      priceRaw,
      priceNumeric,
      isPriced: priceNumeric !== null,
      thickness: thicknessInfo.thickness,
      thicknessUnit: thicknessInfo.thicknessUnit,
      pricingUnit,
      sizePattern: parsedSize.pattern,
      standardWidth: stockDimensions?.width ?? null,
      standardLength: stockDimensions?.length ?? null,
      standardUnit: stockDimensions?.unit ?? null,
      stockDimensionSource: stockDimensions?.source ?? null,
      stockAreaSqm,
      pricePerSqm
    };
  });

  cache = { mtimeMs: stat.mtimeMs, rows };
  return rows;
};

const isSameValue = (left, right) => normalizeComparable(left) === normalizeComparable(right);

const getCatalogMaterials = () => loadCatalog();

const findCatalogMaterial = ({ material, category, subCategory, size, unit, color }) => {
  const rows = loadCatalog();

  const matches = rows.filter((row) => {
    if (!material || !isSameValue(row.material, material)) return false;
    if (category && !isSameValue(row.category, category)) return false;
    if (subCategory && !isSameValue(row.subCategory, subCategory)) return false;
    if (size && !isSameValue(row.size, size)) return false;
    if (unit && !isSameValue(row.unit, unit)) return false;
    if (color && !isSameValue(row.color, color)) return false;
    return true;
  });

  return {
    matches,
    exact: matches.length === 1 ? matches[0] : null
  };
};

const getCatalogSummary = () => {
  const rows = loadCatalog();
  const categoryMap = new Map();

  rows.forEach((row) => {
    const categoryKey = row.category;
    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, {
        category: row.category,
        subCategories: new Set(),
        total: 0,
        priced: 0,
        unpriced: 0
      });
    }

    const category = categoryMap.get(categoryKey);
    if (row.subCategory) category.subCategories.add(row.subCategory);
    category.total += 1;
    if (row.isPriced) category.priced += 1;
    else category.unpriced += 1;
  });

  return Array.from(categoryMap.values())
    .map((entry) => ({
      category: entry.category,
      total: entry.total,
      priced: entry.priced,
      unpriced: entry.unpriced,
      subCategories: Array.from(entry.subCategories).sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
};

const getCatalogCacheInfo = () => {
  // Ensure loaded so mtimeMs is current
  loadCatalog();
  return {
    mtimeMs: cache.mtimeMs,
    rowCount: cache.rows.length
  };
};

module.exports = {
  getCatalogMaterials,
  findCatalogMaterial,
  getCatalogSummary,
  getCatalogCacheInfo,
  normalizePricingUnit,
  calculateSquareMeters
};
