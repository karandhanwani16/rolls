const QUANTITY_UNITS = {
  m: { value: 'm', label: 'Meters', short: 'Mtr', abbr: 'm' },
  yd: { value: 'yd', label: 'Yards', short: 'Yd', abbr: 'yd' },
  kg: { value: 'kg', label: 'Kilograms', short: 'Kg', abbr: 'kg' },
};

const DEFAULT_UNIT = 'm';

function normalizeUnit(unit) {
  if (!unit) return DEFAULT_UNIT;
  const key = String(unit).toLowerCase().trim();
  if (QUANTITY_UNITS[key]) return key;
  if (key === 'meter' || key === 'meters' || key === 'mts' || key === 'mtr') return 'm';
  if (key === 'yard' || key === 'yards') return 'yd';
  if (key === 'kilogram' || key === 'kilograms' || key === 'kgs') return 'kg';
  return DEFAULT_UNIT;
}

function unitLabel(unit) {
  return QUANTITY_UNITS[normalizeUnit(unit)].label;
}

/** Column header on bill/challan: Meters, Yards, or KGs */
function unitColumnLabel(unit) {
  const key = normalizeUnit(unit);
  if (key === 'yd') return 'Yards';
  if (key === 'kg') return 'KGs';
  return 'Meters';
}

function unitShort(unit) {
  return QUANTITY_UNITS[normalizeUnit(unit)].short;
}

function unitAbbr(unit) {
  return QUANTITY_UNITS[normalizeUnit(unit)].abbr;
}

function formatQuantity(qty, unit) {
  const value = parseFloat(qty) || 0;
  return `${value.toFixed(2)} ${unitAbbr(unit)}`;
}

function sumQuantityByUnit(items, qtyKey = 'meters', unitKey = 'unit') {
  const totals = { m: 0, yd: 0, kg: 0 };
  for (const item of items || []) {
    const unit = normalizeUnit(item[unitKey]);
    totals[unit] += parseFloat(item[qtyKey]) || 0;
  }
  return totals;
}

function formatUnitTotals(totals) {
  return Object.entries(totals || {})
    .filter(([, qty]) => qty > 0)
    .map(([unit, qty]) => `${Number(qty).toFixed(2)} ${unitAbbr(unit)}`)
    .join(' + ') || `0 ${unitAbbr(DEFAULT_UNIT)}`;
}

/** Numeric totals only (no yd/m/kg suffixes) — for bill/challan print */
function formatUnitTotalsNumeric(totals) {
  return Object.entries(totals || {})
    .filter(([, qty]) => qty > 0)
    .map(([, qty]) => Number(qty).toFixed(2))
    .join(' + ') || '0.00';
}

module.exports = {
  QUANTITY_UNITS,
  DEFAULT_UNIT,
  normalizeUnit,
  unitLabel,
  unitColumnLabel,
  unitShort,
  unitAbbr,
  formatQuantity,
  sumQuantityByUnit,
  formatUnitTotals,
  formatUnitTotalsNumeric,
};
