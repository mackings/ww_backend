const crypto = require('crypto');

const normalizeHeader = (value) => String(value || '').trim();

const buildWeakEtag = (parts) => {
  const content = Array.isArray(parts) ? parts.join('|') : String(parts || '');
  const hash = crypto.createHash('sha1').update(content).digest('hex');
  return `W/\"${hash}\"`;
};

const setJsonCacheHeaders = (res, { etag, cacheControl, vary } = {}) => {
  if (etag) res.setHeader('ETag', etag);
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Vary', vary || 'Authorization, Accept-Encoding');
};

const sendNotModifiedIfMatch = (req, res, etag) => {
  if (!etag) return false;
  const candidate = normalizeHeader(req.headers['if-none-match']);
  if (candidate && candidate === etag) {
    res.status(304).end();
    return true;
  }
  return false;
};

module.exports = {
  buildWeakEtag,
  setJsonCacheHeaders,
  sendNotModifiedIfMatch
};

