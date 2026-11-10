const prisma = require('../prisma/client');
const { format, startOfMonth, endOfMonth, subMonths, subQuarters } = require('date-fns');

class DashboardService {
    async getDashboardData(startDate, endDate) {
        // Set default date range if not provided
        if (!startDate) {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
        }
        if (!endDate) {
            endDate = new Date();
        }

        // Convert string dates to Date objects
        startDate = new Date(startDate);
        endDate = new Date(endDate);

        // Get total sales
        const totalSales = await prisma.sale.aggregate({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _sum: {
                total: true
            }
        }) || { _sum: { total: null } };

        // Get total purchases
        const totalPurchases = await prisma.purchase.aggregate({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _sum: {
                total: true
            }
        });

        // Get total payments received
        const totalPaymentsIn = await prisma.paymentIn.aggregate({
            where: {
                payment_date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _sum: {
                actual_amount: true
            }
        });

        // Get total payments made
        const totalPaymentsOut = await prisma.paymentOut.aggregate({
            where: {
                payment_date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _sum: {
                amount: true
            }
        });

        // Get recent sales
        const recentSales = await prisma.sale.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                customer: true
            },
            orderBy: {
                date: 'desc'
            },
            take: 5
        });

        // Get recent purchases
        const recentPurchases = await prisma.purchase.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                supplier: true
            },
            orderBy: {
                date: 'desc'
            },
            take: 5
        });

        // Get pending payments (exclude settlement FULL and direct full-bill payments)
        const pendingPayments = await prisma.sale.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                },
                bill_payments: {
                    none: {
                        status: 'FULL'
                    }
                },
                bill_linked_payments: {
                    none: {},
                },
            },
            include: {
                customer: true,
                bill_payments: true
            },
            orderBy: {
                date: 'desc'
            }
        });

        const totalSalesReturns = await prisma.saleReturn.aggregate({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _sum: { total: true }
        });

        const totalPurchaseReturns = await prisma.purchaseReturn.aggregate({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _sum: { total: true }
        });

        const netSales = (totalSales._sum.total || 0) - (totalSalesReturns._sum.total || 0);
        const netPurchases = (totalPurchases._sum.total || 0) - (totalPurchaseReturns._sum.total || 0);

        return {
            summary: {
                totalSales: netSales,
                totalPurchases: netPurchases,
                netProfit: netSales - netPurchases,
                totalPaymentsIn: totalPaymentsIn._sum.amount || 0,
                totalPaymentsOut: totalPaymentsOut._sum.amount || 0
            },
            recentSales,
            recentPurchases,
            pendingPayments
        };
    }

    async getTotalSales(userId) {
        try {
            const result = await prisma.sale.aggregate({
                where: { user_id: userId },
                _sum: {
                    total_amount: true
                }
            });
            return result._sum.total_amount || 0;
        } catch (error) {
            console.error('Error calculating total sales:', error);
            return 0;
        }
    }

    async getTotalSalesInRange(startDate, endDate, userId) {
        try {
            const result = await prisma.sale.aggregate({
                where: {
                    user_id: userId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _sum: {
                    total_amount: true
                }
            });
            return result._sum.total_amount || 0;
        } catch (error) {
            console.error('Error calculating sales in range:', error);
            return 0;
        }
    }

    async getPendingPayments(userId) {
        try {
            // Sum all sales amounts with status not 'Paid'
            const totalSales = await prisma.sale.aggregate({
                _sum: {
                    total_amount: true
                },
                where: {
                    user_id: userId,
                    status: {
                        not: 'Paid'
                    }
                }
            });

            return totalSales._sum.total_amount || 0;
        } catch (error) {
            console.error('Error calculating pending payments:', error);
            return 0;
        }
    }

    async getPendingPaymentsInRange(startDate, endDate, userId) {
        try {
            const totalSales = await prisma.sale.aggregate({
                _sum: {
                    total_amount: true
                },
                where: {
                    user_id: userId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    },
                    status: {
                        not: 'Paid'
                    }
                }
            });

            return totalSales._sum.total_amount || 0;
        } catch (error) {
            console.error('Error calculating pending payments in range:', error);
            return 0;
        }
    }

    async getCollectionRate(startDate, endDate, userId) {
        try {
            // Total sales in period
            const totalSales = await prisma.sale.aggregate({
                where: {
                    user_id: userId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _sum: {
                    total_amount: true
                }
            });

            // Total payments in period
            const totalPayments = await prisma.paymentIn.aggregate({
                where: {
                    user_id: userId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _sum: {
                    amount: true
                }
            });

            const salesAmount = totalSales._sum.total_amount || 0;
            const paymentsAmount = totalPayments._sum.amount || 0;

            if (salesAmount === 0) return 100; // If no sales, collection rate is 100%

            // Calculate collection rate
            const rate = (paymentsAmount / salesAmount) * 100;
            return Math.min(rate, 100); // Cap at 100%
        } catch (error) {
            console.error('Error calculating collection rate:', error);
            return 0;
        }
    }

    async getPaymentBreakdown(userId) {
        try {
            // Get payments by mode
            const paymentModes = ['Online', 'Cash', 'Cheque'];
            const result = {};

            for (const mode of paymentModes) {
                const payments = await prisma.paymentIn.aggregate({
                    where: {
                        user_id: userId,
                        payment_mode: mode
                    },
                    _sum: {
                        amount: true
                    }
                });

                result[mode] = payments._sum.amount || 0;
            }

            return {
                onlineTransfers: result['Online'] || 0,
                cashPayments: result['Cash'] || 0,
                chequePayments: result['Cheque'] || 0,
            };
        } catch (error) {
            console.error('Error calculating payment breakdown:', error);
            return {
                onlineTransfers: 0,
                cashPayments: 0,
                chequePayments: 0,
            };
        }
    }
}

module.exports = new DashboardService();