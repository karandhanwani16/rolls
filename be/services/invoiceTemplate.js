module.exports = (invoiceData, documentType = 'bill') => {
    const isChallan = documentType === 'challan';
    const {
        normalizeUnit,
        unitColumnLabel,
        formatUnitTotalsNumeric,
        sumQuantityByUnit,
    } = require('../utils/quantityUnits');
    const { sortRollsByShade } = require('../utils/sortRolls');

    // Max rolls per page. Last page leaves room for totals / challan note when splitting.
    const ROWS_FULL_PAGE = 15;
    const ROWS_LAST_PAGE = isChallan ? 10 : 9;

    const documentUnit = normalizeUnit(
        invoiceData.unit || invoiceData.items?.[0]?.unit || 'm'
    );
    const qtyColumnName = unitColumnLabel(documentUnit);

    const grouped = {};
    (invoiceData.items || []).forEach((item) => {
        const name = `${item.name || ''}`.trim().toLowerCase();
        const width = (item.width || '').trim();
        const unit = normalizeUnit(item.unit);
        const price = parseFloat(item.price);
        const key = isChallan
            ? `${name}||${width}||${unit}`
            : `${name}||${width}||${unit}||${price}`;
        if (!grouped[key]) {
            grouped[key] = {
                name: item.name || '',
                width,
                unit,
                price: item.price,
                roll_nos: [],
                shades: [],
                meters: [],
                total_mts: 0,
                total_amount: 0,
            };
        }
        grouped[key].roll_nos.push(item.roll_no);
        grouped[key].shades.push(item.shade || '');
        grouped[key].meters.push(parseFloat(item.mts || 0));
        grouped[key].total_mts += parseFloat(item.mts || 0);
        grouped[key].total_amount += parseFloat(item.amount || 0);
    });
    const groupedItems = Object.values(grouped);
    groupedItems.forEach((group) => {
        const sorted = sortRollsByShade(
            group.roll_nos.map((roll_no, i) => ({
                roll_no,
                shade: group.shades[i],
                meters: group.meters[i],
            }))
        );
        group.roll_nos = sorted.map((row) => row.roll_no);
        group.shades = sorted.map((row) => row.shade);
        group.meters = sorted.map((row) => row.meters);
    });

    // Flatten to one visual line per roll, keeping group metadata for first/last of group
    const rollLines = [];
    groupedItems.forEach((group) => {
        const count = Math.max(group.roll_nos.length, 1);
        group.roll_nos.forEach((rollNo, idx) => {
            rollLines.push({
                group,
                rollNo,
                shade: (group.shades || [])[idx] || '',
                meters: group.meters[idx] || 0,
                isFirst: idx === 0,
                isLast: idx === count - 1,
                count,
            });
        });
    });

    // Paginate: max ROWS_FULL_PAGE per page. Prefer one page with summary when remaining
    // fits under the max (avoids a second page with 0 roll items / summary-only).
    const pages = [];
    const linesLeft = rollLines.slice();
    if (linesLeft.length === 0) {
        pages.push([]);
    } else {
        while (linesLeft.length > ROWS_LAST_PAGE) {
            if (linesLeft.length <= ROWS_FULL_PAGE) {
                // Keep summary on this page instead of an empty/continuation-only next page.
                break;
            }
            pages.push(linesLeft.splice(0, ROWS_FULL_PAGE));
        }
        pages.push(linesLeft);
    }

    const unitTotals = sumQuantityByUnit(
        invoiceData.items.map((item) => ({ meters: item.mts, unit: item.unit })),
    );
    const totalQtyLabel = formatUnitTotalsNumeric(unitTotals);
    const docNoLabel = isChallan ? 'Chalan No.' : 'Bill No.';

    const formatCurrency = (value) => {
        return typeof value === 'number'
            ? value.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              })
            : value;
    };

    const itemsTotal =
        invoiceData.items.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    const transportCharges = parseFloat(invoiceData.transport_charges) || 0;
    const discount = parseFloat(invoiceData.discount) || 0;
    const actualTotal = itemsTotal + transportCharges - discount;
    const roundedTotal = Math.round(actualTotal);
    const roundOff = (roundedTotal - actualTotal).toFixed(2);
    const heading = isChallan ? 'ON APPROVAL / DELIVERY CHALLAN' : 'SALES BILL';
    const colCount = isChallan ? 6 : 8;

    const colgroup = isChallan
        ? `<col style="width:8%"><col style="width:22%"><col style="width:10%"><col style="width:15%"><col style="width:15%"><col style="width:30%">`
        : `<col style="width:6%"><col style="width:17%"><col style="width:8%"><col style="width:12%"><col style="width:11%"><col style="width:17%"><col style="width:12%"><col style="width:17%">`;

    const columnHeaderRow = isChallan
        ? `
          <tr class="col-heading">
            <th>Rolls</th>
            <th>Sort No.</th>
            <th>Width</th>
            <th>Roll No.</th>
            <th>Shade</th>
            <th class="no-right-border">${qtyColumnName}</th>
          </tr>`
        : `
          <tr class="col-heading">
            <th>Rolls</th>
            <th>Sort No.</th>
            <th>Width</th>
            <th>Roll No.</th>
            <th>Shade</th>
            <th>${qtyColumnName}</th>
            <th>Rate</th>
            <th class="no-right-border">Amount</th>
          </tr>`;

    // Contiguous same-group segments on this page (for rowspan across roll lines)
    const pageGroupSpans = (lines) => {
        const spans = new Array(lines.length).fill(0);
        let i = 0;
        while (i < lines.length) {
            let j = i + 1;
            while (j < lines.length && lines[j].group === lines[i].group) j += 1;
            spans[i] = j - i;
            i = j;
        }
        return spans;
    };

    const renderItemRows = (lines, { fillPage = false } = {}) => {
        if (!lines.length && !fillPage) {
            return `<tr><td colspan="${colCount}" class="no-right-border" style="padding:20px;text-align:center;">No items</td></tr>`;
        }

        const emptyCells = isChallan
            ? `
            <td>&nbsp;</td><td></td><td></td><td></td><td></td>
            <td class="no-right-border"></td>`
            : `
            <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>
            <td class="no-right-border"></td>`;

        const spans = pageGroupSpans(lines);

        const rows = lines
            .map((line, idx) => {
                const { group, rollNo, shade, meters, isLast, count } = line;
                const qtyHtml = `<div class="qty-line">${meters.toFixed(2)}</div>`;
                const groupTotalHtml = isLast
                    ? `<div class="qty-rule">________</div><div class="qty-line qty-total">${group.total_mts.toFixed(2)}</div>`
                    : '';
                const span = spans[idx];
                const groupMetaCells =
                    span > 0
                        ? `<td rowspan="${span}" class="group-meta">${count}</td>
            <td rowspan="${span}" class="group-meta">${group.name || ''}</td>
            <td rowspan="${span}" class="group-meta">${(group.width || '').trim() || '-'}</td>`
                        : '';

                if (isChallan) {
                    return `
          <tr class="item-row">
            ${groupMetaCells}
            <td>${rollNo || '&nbsp;'}</td>
            <td>${shade || '&nbsp;'}</td>
            <td class="qty-cell no-right-border">${qtyHtml}${groupTotalHtml}</td>
          </tr>`;
                }

                let rateAmountCells = '';
                if (span > 0) {
                    const segmentEndsGroup = lines
                        .slice(idx, idx + span)
                        .some((l) => l.isLast);
                    const rateHtml = segmentEndsGroup
                        ? `<div class="qty-rule">______</div>${group.price || ''}`
                        : '';
                    const amountHtml = segmentEndsGroup
                        ? `<div class="qty-rule">_______</div>${formatCurrency(group.total_amount) || ''}`
                        : '';
                    rateAmountCells = `
            <td rowspan="${span}" class="align-bottom group-meta">${rateHtml}</td>
            <td rowspan="${span}" class="align-bottom no-right-border text-right group-meta">${amountHtml}</td>`;
                }

                return `
          <tr class="item-row">
            ${groupMetaCells}
            <td>${rollNo || '&nbsp;'}</td>
            <td>${shade || '&nbsp;'}</td>
            <td class="qty-cell">${qtyHtml}${groupTotalHtml}</td>
            ${rateAmountCells}
          </tr>`;
            })
            .join('');

        // Stretch column lines + bottom border to the end of the page
        const filler = fillPage
            ? `<tr class="filler-row">${emptyCells}</tr>`
            : '';

        return rows + filler;
    };

    const creditDays = parseInt(invoiceData.credit_days, 10) || 0;
    const showInterestNote = Boolean(invoiceData.showInterestNote);
    const interestNoteHtml = showInterestNote
        ? `<div class="bill-note" style="height: 57px;">Please Note : Payment After ${creditDays} Days 1% Interest will Be Charged</div>`
        : '<div class="bill-note" style="height: 57px;"></div>';
    const billNoteHtml = `${interestNoteHtml}<div class="owner-signature">CUSTOMER SIGNATURE : ________________</div>`;

    const footerRows = isChallan
        ? `
        <tr>
          <td colspan="5" class="text-right">Total ${qtyColumnName} : ${totalQtyLabel}</td>
          <td class="no-right-border"></td>
        </tr>`
        : `
        <tr>
          <td colspan="5" class="text-right bottom-border">Total ${qtyColumnName} : ${totalQtyLabel}</td>
          <td colspan="2" class="bottom-border">Sub Total</td>
          <td class="no-right-border text-right bottom-border">${formatCurrency(itemsTotal || 0)}</td>
        </tr>
        <tr>
          <td colspan="5" rowspan="5" class="bill-note-cell">${billNoteHtml}</td>
          <td colspan="2" class="bottom-border">Transport Charges</td>
          <td class="no-right-border text-right bottom-border">${formatCurrency(transportCharges)}</td>
        </tr>
        <tr>
          <td colspan="2" class="bottom-border">Discount</td>
          <td class="no-right-border text-right bottom-border">${formatCurrency(discount)}</td>
        </tr>
        <tr>
          <td colspan="2" class="bottom-border">Round Off</td>
          <td class="no-right-border text-right bottom-border">${formatCurrency(roundOff)}</td>
        </tr>
        <tr>
          <td colspan="2" class="bottom-border"></td>
          <td class="no-right-border bottom-border"></td>
        </tr>
        <tr>
          <td colspan="2">Total Amount</td>
          <td class="no-right-border text-right">${formatCurrency(roundedTotal)}</td>
        </tr>`;

    const pageHtml = pages
        .map((lines, pageIndex) => {
            const isLastPage = pageIndex === pages.length - 1;
            const continuedNext =
                !isLastPage
                    ? `<div class="continued-next">Continued on next page</div>`
                    : '';

            return `
  <div class="page${isLastPage ? ' page-last' : ' page-continue'}">
    <div class="header">
      <div class="sub-header">${heading}</div>
      <div class="company-name">T. A. TEX</div>
      <div class="address">ULHASNAGAR 421005</div>
    </div>
    <div class="details-row">
      <div class="details-col">
        <div><strong>To,</strong></div>
        <div><strong>${invoiceData.customer || ''}</strong></div>
        ${invoiceData.firm_name ? `<div>${invoiceData.firm_name}</div>` : ''}
        <div>Maker : ${invoiceData.maker || '-'}</div>
      </div>
      <div class="details-col right">
        <div>${docNoLabel}: ${invoiceData.sales_no || '-'}</div>
        <div>Date: ${invoiceData.date || ''}</div>
      </div>
    </div>
    <div class="table-shell">
      <table class="items-table">
        <colgroup>${colgroup}</colgroup>
        <thead>
          ${columnHeaderRow}
        </thead>
        <tbody>
          ${renderItemRows(lines, { fillPage: true })}
        </tbody>
      </table>
    </div>
    ${
        isLastPage
            ? `<div class="footer-block">
      <table class="items-table footer-table">
        <colgroup>${colgroup}</colgroup>
        <tbody>
          ${footerRows}
        </tbody>
      </table>
      ${
          isChallan
              ? `<div class="challan-note">
        <div class="challan-terms">
          कृपया हर एक रोल काटने से पहले कपड़ा अच्छी तरह से परख लें<br/>
          रोल काटने के बाद हमारी किसी भी प्रकार की जिम्मेदारी नहीं है।<br/>
          No Claim will be recognised after Cutting the Roll
        </div>
        <div class="challan-signature-row" style="width: 54%;">
          <span style="display: flex;"><span>Maker Signature</span> <span>________________________________________</span></span>
        </div>
      </div>`
              : ''
      }
    </div>`
            : continuedNext
    }
  </div>`;
        })
        .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${heading} - ${invoiceData.sales_no || ''}</title>
  <style>
    @page {
      size: A4;
      margin: 2mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
    }
    .page {
      /* Near-full A4 so frame reaches the bottom even with small print margins */
      width: 206mm;
      height: 293mm;
      margin: 0 auto 12px;
      background: #fff;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .page:last-child,
    .page-last {
      page-break-after: auto;
      break-after: auto;
      margin-bottom: 0;
    }
    .header {
      border: 1px solid #000;
      text-align: center;
      padding: 8px 10px;
      flex-shrink: 0;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #2c3e50;
    }
    .sub-header {
      font-size: 14px;
      font-weight: 700;
    }
    .address {
      font-size: 14px;
    }
    .continued-next {
      flex-shrink: 0;
      border: 1px solid #000;
      border-top: none;
      padding: 8px 10px;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
    }
    .details-row {
      border: 1px solid #000;
      border-top: none;
      display: flex;
      flex-shrink: 0;
    }
    .details-col {
      flex: 1;
      font-size: 18px;
      font-weight: 700;
      padding: 8px 10px;
    }
    .details-col.right {
      border-left: 1px solid #000;
    }
    /* Shell grows so column lines + frame reach the totals / page bottom */
    .table-shell {
      flex: 1 1 auto;
      min-height: 0;
      border: 1px solid #000;
      border-top: none;
      border-bottom: none;
      display: flex;
      flex-direction: column;
    }
    /* Continuation pages (no footer): close the frame at the page bottom */
    .page-continue .table-shell {
      border-bottom: 1px solid #000;
    }
    table.items-table {
      width: 100%;
      height: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: none;
    }
    tr.filler-row td {
      height: 100%;
      border-bottom: none;
      vertical-align: top;
    }
    table.footer-table {
      width: 100%;
      border: 1px solid #000;
      border-top: 1px solid #000;
      flex: 0 0 auto;
      height: auto;
    }
    .footer-block {
      flex-shrink: 0;
      margin-top: auto;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .challan-note {
      margin-top: 0;
      border: 1px solid #000;
      border-top: none;
      padding: 0;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.45;
      display: flex;
      align-items: stretch;
      min-height: 72px;
    }
    .challan-terms {
      flex: 1;
      padding: 14px 12px;
      text-align: left;
    }
    .challan-signature-row {
      flex: 0 0 auto;
      border-left: 1px solid #000;
      padding: 14px 12px;
      display: flex;
      align-items: flex-end;
      text-align: left;
      font-size: 13px;
      font-weight: 700;
      padding-bottom: 8px;
    }
    th, td {
      padding: 4px 8px;
      text-align: left;
      font-size: 21px;
      font-weight: 700;
      vertical-align: top;
      border-right: 1px solid #000;
    }
    th {
      border-bottom: 1px solid #000;
      font-size: 18px;
      padding: 6px 4px 8px;
    }
    tbody tr.item-row td {
      border-bottom: none;
    }
    td.group-meta {
      vertical-align: top;
    }
    td.group-meta.align-bottom {
      vertical-align: bottom;
    }
    .no-right-border { border-right: none !important; }
    .bottom-border { border-bottom: 1px solid #000; }
    .text-right { text-align: right; }
    .align-bottom { vertical-align: bottom; }
    .qty-cell { white-space: nowrap; }
    .qty-line {
      white-space: nowrap !important;
      font-size: 21px;
      line-height: 1.25;
    }
    .qty-total { font-weight: 700; }
    .qty-rule {
      font-size: 18px;
      line-height: 10px;
      padding: 4px 0 8px;
    }
    .words-cell {
      vertical-align: middle;
      font-size: 18px;
    }
    .bill-note-cell {
      vertical-align: top;
      text-align: left;
      padding: 8px 10px;
    }
    .bill-note {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.35;
      text-transform: uppercase;
    }
    .owner-signature {
      margin-top: 48px;
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
    }
    @media print {
      html, body {
        width: auto !important;
        background: #fff;
      }
      .page {
        width: 100% !important;
        height: 293mm;
        margin: 0;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
      }
      .page:last-child,
      .page-last {
        page-break-after: auto;
        break-after: auto;
      }
    }
  </style>
</head>
<body>
  ${pageHtml}
</body>
</html>`;
};

function convertNumberToWords(amount) {
    if (typeof amount !== 'number') amount = parseFloat(amount);
    if (isNaN(amount)) return '';

    const ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function numToWords(n) {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
        return '';
    }

    function splitNumber(num) {
        const res = [];
        res.push(num % 1000);
        num = Math.floor(num / 1000);
        res.push(num % 100);
        num = Math.floor(num / 100);
        res.push(num % 100);
        num = Math.floor(num / 100);
        res.push(num);
        return res;
    }

    let [rupees, paise] = amount.toFixed(2).split('.');
    rupees = parseInt(rupees, 10);
    paise = parseInt(paise, 10);
    if (rupees === 0) return 'Zero Rupees Only';
    const parts = splitNumber(rupees);
    const words = [];
    if (parts[3]) words.push(numToWords(parts[3]) + ' Crore');
    if (parts[2]) words.push(numToWords(parts[2]) + ' Lakh');
    if (parts[1]) words.push(numToWords(parts[1]) + ' Thousand');
    if (parts[0]) words.push(numToWords(parts[0]));
    let result = words.join(' ').replace(/  +/g, ' ').trim() + ' Rupees';
    if (paise) result += ' and ' + numToWords(paise) + ' Paise';
    result += ' Only';
    return result;
}
