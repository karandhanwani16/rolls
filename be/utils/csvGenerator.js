const { Parser } = require('json2csv');

const generateCSV = (data) => {
    const fields = [
        { label: 'Sr. No.', value: 'srNo' },
        { label: 'Product Name', value: 'productName' },
        { label: 'Roll No.', value: 'rollNo' },
        { label: 'Quantity', value: 'meters' },
        { label: 'Unit', value: (row) => row.unit || 'm' },
        {
            label: 'Price',
            value: (row) => new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0,
            }).format(row.price)
        }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(data);
};

module.exports = { generateCSV };