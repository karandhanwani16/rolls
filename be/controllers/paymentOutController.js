
const paymentOutService = require('../services/paymentOutService');

class PaymentOutController {
  async getAllPaymentsOut(req, res) {
    try {
      const paymentsOut = await paymentOutService.getAllPaymentsOut();
      return res.json({
        success: true,
        data: paymentsOut
      });
    } catch (error) {
      console.error('Get all payments out error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPaymentOutById(req, res) {
    try {
      const { id } = req.params;
      const paymentOut = await paymentOutService.getPaymentOutById(id);
      return res.json({
        success: true,
        data: paymentOut
      });
    } catch (error) {
      console.error('Get payment out by id error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async createPaymentOut(req, res) {
    try {
      const paymentOutData = req.body;
      const newPaymentOut = await paymentOutService.createPaymentOut(paymentOutData);
      return res.status(201).json({
        success: true,
        data: newPaymentOut
      });
    } catch (error) {
      console.error('Create payment out error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updatePaymentOut(req, res) {
    try {
      const { id } = req.params;
      const paymentOutData = req.body;
      const updatedPaymentOut = await paymentOutService.updatePaymentOut(id, paymentOutData);
      return res.json({
        success: true,
        data: updatedPaymentOut
      });
    } catch (error) {
      console.error('Update payment out error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deletePaymentOut(req, res) {
    try {
      const { id } = req.params;
      const result = await paymentOutService.deletePaymentOut(id);
      return res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Delete payment out error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new PaymentOutController();
