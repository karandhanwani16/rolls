const prisma = require('../prisma/client');

class ProductService {
    async getAllProducts() {
        try {
            return await prisma.product.findMany();
        } catch (error) {
            console.error('Error fetching products:', error);
            throw error;
        }
    }

    async createProduct(data) {
        try {
            return await prisma.product.create({ data });
        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    }

    async updateProduct(id, data) {
        try {
            return await prisma.product.update({
                where: { id },
                data,
            });
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    }

    async deleteProduct(id) {
        try {
            await prisma.product.delete({ where: { id } });
        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    }

}

module.exports = new ProductService();
