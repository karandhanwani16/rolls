const XLSX = require('xlsx');

const generateExcel = (data) => {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Format the data for Excel
    const excelData = data.map(item => ({
        'Sr. No.': item.srNo,
        'Product Name': item.productName,
        'Roll No.': item.rollNo,
        'Quantity': item.meters,
        'Unit': item.unit || 'm',
        'Price': new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(item.price)
    }));

    // Create a worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
        { wch: 8 }, // Sr. No.
        { wch: 30 }, // Product Name
        { wch: 15 }, // Roll No.
        { wch: 10 }, // Meters
        { wch: 15 } // Price
    ];
    worksheet['!cols'] = colWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Report');

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    return excelBuffer;
};

module.exports = { generateExcel };