const productService = require('../services/productService');

class ProductController {
    async getAllProducts(req, res) {
        try {
            const products = await productService.getAllProducts();
            res.json({
                status: 'success',
                message: 'Products retrieved successfully',
                data: products
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async createProduct(req, res) {
        try {
            const { name, description, price, color, width } = req.body;
            const product = await productService.createProduct({
                name,
                description,
                price: price ? parseFloat(price) : null,
                color,
                width
            });
            res.status(201).json({
                status: 'success',
                message: 'Product created successfully',
                data: product
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async updateProduct(req, res) {
        try {
            const { name, description, price, color, width } = req.body;
            const product = await productService.updateProduct(req.params.id, {
                name,
                description,
                price: price ? parseFloat(price) : null,
                color,
                width
            });
            res.json({
                status: 'success',
                message: 'Product updated successfully',
                data: product
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async deleteProduct(req, res) {
        try {
            await productService.deleteProduct(req.params.id);
            res.status(200).json({
                status: 'success',
                message: 'Product deleted successfully',
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

    async getProductById(req, res) {
        try {
            const product = await productService.getProductById(req.params.id);
            res.status(200).json({
                status: 'success',
                message: 'Product retrieved successfully',
                data: product
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

module.exports = new ProductController();