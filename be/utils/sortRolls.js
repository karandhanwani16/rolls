/**
 * Natural, numeric-aware ordering for shade / roll labels
 * ("2" before "10", "A1" before "A10", "S-2" before "S-12").
 * Missing / blank values sort last.
 */
function compareNatural(a, b) {
    const sa = a == null ? '' : String(a).trim();
    const sb = b == null ? '' : String(b).trim();
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
}

function shadeOf(item) {
    if (!item || typeof item !== 'object') return '';
    return item.shade ?? item.shade_no ?? item.shadeNo ?? '';
}

function rollNoOf(item) {
    if (!item || typeof item !== 'object') return '';
    return item.roll_no ?? item.rollNo ?? '';
}

function compareRollsByShade(a, b) {
    const shadeCmp = compareNatural(shadeOf(a), shadeOf(b));
    if (shadeCmp !== 0) return shadeCmp;
    const rollCmp = compareNatural(rollNoOf(a), rollNoOf(b));
    if (rollCmp !== 0) return rollCmp;
    return compareNatural(a && a.id, b && b.id);
}

function sortRollsByShade(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            const cmp = compareRollsByShade(a.item, b.item);
            return cmp !== 0 ? cmp : a.index - b.index;
        })
        .map(({ item }) => item);
}

module.exports = {
    compareNatural,
    compareRollsByShade,
    sortRollsByShade,
};
