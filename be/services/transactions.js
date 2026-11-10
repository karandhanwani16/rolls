const prisma = require('../prisma/client');

class TransactionService {
    async getAll() {
        try {
            const transactions = await prisma.transaction.findMany({
                include: {
                    customer: true,
                    supplier: true
                },
                orderBy: {
                    created_at: 'desc'
                }
            });
            return transactions;
        } catch (error) {
            throw error;
        }
    }

    async getById(id) {
        try {
            const transaction = await prisma.transaction.findUnique({
                where: { id },
                include: {
                    customer: true,
                    supplier: true
                }
            });
            return transaction;
        } catch (error) {
            throw error;
        }
    }

    async create(data) {
        try {
            const transaction = await prisma.transaction.create({
                data: {
                    type: data.type,
                    description: data.description,
                    customer_id: data.customer_id,
                    supplier_id: data.supplier_id,
                    amount: data.amount
                },
                include: {
                    customer: true,
                    supplier: true
                }
            });
            return transaction;
        } catch (error) {
            throw error;
        }
    }

    async update(id, data) {
        try {
            const transaction = await prisma.transaction.update({
                where: { id },
                data: {
                    type: data.type,
                    description: data.description,
                    customer_id: data.customer_id,
                    supplier_id: data.supplier_id,
                    amount: data.amount
                },
                include: {
                    customer: true,
                    supplier: true
                }
            });
            return transaction;
        } catch (error) {
            throw error;
        }
    }

    async delete(id) {
        try {
            await prisma.transaction.delete({
                where: { id }
            });
            return { message: 'Transaction deleted successfully' };
        } catch (error) {
            throw error;
        }
    }

    // Helper method to create a transaction record
    async createTransactionRecord(type, description, customer_id, supplier_id, amount) {
        try {
            return await this.create({
                type,
                description,
                customer_id,
                supplier_id,
                amount
            });
        } catch (error) {
            console.error('Error creating transaction record:', error);
            // Don't throw the error to prevent breaking the main operation
            return null;
        }
    }
}

module.exports = new TransactionService();