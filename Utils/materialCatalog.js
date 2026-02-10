const fs = require('fs');
const path = require('path');

const MATERIALS_CATALOG_PATH = path.join(__dirname, '..', 'materials_all.csv');

let cache = {
  mtimeMs: null,
  rows: []
};

const normalize = (value) => String(value || '').trim();

const normalizeLookup = (value) => normalize(value).toLowerCase();

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
      thicknessUnit: thicknessInfo.thicknessUnit
    };
  });

  cache = { mtimeMs: stat.mtimeMs, rows };
  return rows;
};

const isSameValue = (left, right) => normalizeLookup(left) === normalizeLookup(right);

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
  getCatalogCacheInfo
};
