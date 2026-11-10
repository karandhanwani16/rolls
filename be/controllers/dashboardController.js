const dashboardService = require('../services/dashboardService');

const getDashboardData = async(req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Start date and end date are required'
            });
        }

        const data = await dashboardService.getDashboardData(startDate, endDate);
        return res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error in getDashboardData:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data'
        });
    }
};

module.exports = {
    getDashboardData
};