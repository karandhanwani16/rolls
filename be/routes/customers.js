const express = require('express');
const router = express.Router();
const customerService = require('../services/customerService');
const pdfGenerator = require('../services/pdfGenerator');
const { authenticateToken } = require('../middleware/auth');

// ... existing routes ...

router.get('/sales-and-payments', authenticateToken, async(req, res) => {
    try {
        const { customerIds, startDate, endDate, customerType } = req.query;

        if (!customerIds) {
            return res.status(400).json({
                success: false,
                message: 'Customer IDs are required'
            });
        }

        const data = await customerService.getSalesAndPayments({
            customerIds: customerIds.split(','),
            startDate,
            endDate,
            customerType
        });

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error in sales-and-payments route:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sales and payments data'
        });
    }
});

router.get('/report-pdf', authenticateToken, async(req, res) => {
    try {
        const { customerIds, startDate, endDate, customerType } = req.query;

        if (!customerIds) {
            return res.status(400).json({
                success: false,
                message: 'Customer IDs are required'
            });
        }

        const pdf = await pdfGenerator.generateCustomerReport({
            customerIds: customerIds.split(','),
            startDate,
            endDate,
            customerType
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=customer-report.pdf');
        res.send(pdf);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate PDF report'
        });
    }
});

module.exports = router;