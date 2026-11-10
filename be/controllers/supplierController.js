const supplierService = require('../services/supplierService');

class SupplierController {
    async getAllSuppliers(req, res) {
        try {
            const suppliers = await supplierService.getAllSuppliers();
            res.json({
                status: 'success',
                message: 'Suppliers retrieved successfully',
                data: suppliers
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async createSupplier(req, res) {
        try {
            const {
                supplier_name,
                supplier_city,
                supplier_description,
                supplier_phone,
                opening_balance,
                opening_balance_date,
                credit_days,
            } = req.body;

            if (opening_balance && Number(opening_balance) !== 0 && !opening_balance_date) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Opening balance date is required when opening balance is set',
                    data: null,
                });
            }

            const supplier = await supplierService.createSupplier({
                name: supplier_name,
                city: supplier_city,
                description: supplier_description,
                phone: supplier_phone,
                opening_balance: opening_balance ? Number(opening_balance) : 0,
                opening_balance_date: opening_balance_date ? new Date(opening_balance_date + 'T00:00:00.000Z') : null,
                credit_days: credit_days !== undefined && credit_days !== null ? parseInt(credit_days, 10) || 0 : 0,
            });
            res.status(201).json({
                status: 'success',
                message: 'Supplier created successfully',
                data: supplier
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async updateSupplier(req, res) {
        try {
            const {
                supplier_name,
                supplier_city,
                supplier_description,
                supplier_phone,
                opening_balance,
                opening_balance_date,
                credit_days,
            } = req.body;

            if (opening_balance !== undefined && Number(opening_balance) !== 0 && !opening_balance_date) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Opening balance date is required when opening balance is set',
                    data: null,
                });
            }

            const supplier = await supplierService.updateSupplier(req.params.id, {
                name: supplier_name,
                city: supplier_city,
                description: supplier_description,
                phone: supplier_phone,
                opening_balance: opening_balance !== undefined ? Number(opening_balance) : undefined,
                opening_balance_date: opening_balance_date !== undefined
                    ? (opening_balance_date ? new Date(opening_balance_date + 'T00:00:00.000Z') : null)
                    : undefined,
                credit_days: credit_days !== undefined && credit_days !== null
                    ? parseInt(credit_days, 10) || 0
                    : undefined,
            });
            res.json({
                status: 'success',
                message: 'Supplier updated successfully',
                data: supplier
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async deleteSupplier(req, res) {
        try {
            await supplierService.deleteSupplier(req.params.id);
            res.status(200).json({
                status: 'success',
                message: 'Supplier deleted successfully',
                data: null
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async getPurchasesAndPayments(req, res) {
        try {
            const { supplierIds, startDate, endDate } = req.query;
            const result = await supplierService.getPurchasesAndPaymentsService(supplierIds, startDate, endDate);
            res.json({
                status: 'success',
                message: 'Purchases and payments retrieved successfully',
                data: result.transactions,
                summary: result.summary,
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }
}

module.exports = new SupplierController();