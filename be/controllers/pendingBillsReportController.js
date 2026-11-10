const pendingBillsReportService = require('../services/pendingBillsReportService');

const getCustomerPendingBills = async (req, res) => {
    try {
        const data = await pendingBillsReportService.getCustomerPendingBills({
            partyIds: req.query.partyIds,
        });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching customer pending bills:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch customer pending bills',
        });
    }
};

const getSupplierPendingBills = async (req, res) => {
    try {
        const data = await pendingBillsReportService.getSupplierPendingBills({
            partyIds: req.query.partyIds,
        });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching supplier pending bills:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch supplier pending bills',
        });
    }
};

module.exports = {
    getCustomerPendingBills,
    getSupplierPendingBills,
};
