const puppeteer = require('puppeteer');
const { format } = require('date-fns');
const customerService = require('./customerService');

async function generateCustomerReport({ customerIds, startDate, endDate, customerType }) {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Get the data
        const data = await customerService.getSalesAndPayments({
            customerIds,
            startDate,
            endDate,
            customerType
        });

        // Generate HTML content
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .section { margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; }
                    .text-right { text-align: right; }
                    .filters { margin-bottom: 20px; }
                    .filter-item { margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Customer Report</h1>
                    <div class="filters">
                        <div class="filter-item">
                            <strong>Date Range:</strong> 
                            ${startDate ? format(new Date(startDate), 'dd/MM/yyyy') : 'All'} - 
                            ${endDate ? format(new Date(endDate), 'dd/MM/yyyy') : 'All'}
                        </div>
                        ${customerType ? `<div class="filter-item"><strong>Customer Type:</strong> ${customerType}</div>` : ''}
                    </div>
                </div>

                <div class="section">
                    <h2>Sales</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Invoice</th>
                                <th>Customer</th>
                                <th>Type</th>
                                <th class="text-right">Total Amount</th>
                                <th class="text-right">Paid Amount</th>
                                <th class="text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.sales.map(sale => `
                                <tr>
                                    <td>${format(new Date(sale.date), 'dd/MM/yyyy')}</td>
                                    <td>${sale.invoice_number}</td>
                                    <td>${sale.customer_name}</td>
                                    <td>${sale.customer_type}</td>
                                    <td class="text-right">${sale.total_amount.toFixed(2)}</td>
                                    <td class="text-right">${sale.paid_amount.toFixed(2)}</td>
                                    <td class="text-right">${sale.balance_amount.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <h2>Payments</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Type</th>
                                <th>Method</th>
                                <th>Reference</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.payments.map(payment => `
                                <tr>
                                    <td>${format(new Date(payment.date), 'dd/MM/yyyy')}</td>
                                    <td>${payment.customer_name}</td>
                                    <td>${payment.customer_type}</td>
                                    <td>${payment.payment_method}</td>
                                    <td>${payment.reference_number}</td>
                                    <td class="text-right">${payment.amount.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;

        await page.setContent(html);
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        return pdf;
    } finally {
        await browser.close();
    }
}

module.exports = {
    generateCustomerReport
};