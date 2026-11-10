const puppeteer = require('puppeteer');

const generatePDF = async(data) => {
        try {
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();

            // Create HTML content for the PDF
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f2f2f2; }
                    .header { text-align: center; font-size: 24px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="header">Stock Report</div>
                <table>
                    <thead>
                        <tr>
                            <th>Sr. No.</th>
                            <th>Product Name</th>
                            <th>Roll No.</th>
                            <th>Quantity</th>
                            <th>Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.productName}</td>
                                <td>${item.rollNo}</td>
                                <td>${item.meters} ${item.unit || 'm'}</td>
                                <td>${new Intl.NumberFormat('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 0,
                                }).format(item.price)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        await browser.close();
        return pdfBuffer;

    } catch (error) {
        console.error('Error generating PDF:', error);
        throw new Error('Failed to generate PDF');
    }
};

module.exports = { generatePDF };